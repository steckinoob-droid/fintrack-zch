import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/transactions/import
 *
 * Handles the full import pipeline server-side:
 *   1. Authenticate via server client (cookie-based session)
 *   2. Deduplicate via service-role client (OFX FITID + fingerprint)
 *   3. Insert via service-role client (bypasses RLS)
 *
 * Why service role for SELECT and INSERT?
 *   In Next.js Route Handlers, the anon client's in-flight requests may
 *   carry a stale JWT even after getUser() refreshes the token, because the
 *   new token is written to the *response* cookie store while the existing
 *   connection still reads from the *request* store.  This causes auth.uid()
 *   to return NULL in PostgREST → RLS violation on both SELECT and INSERT.
 *
 *   Using the service role eliminates this entirely.  Security is preserved:
 *   - getUser() (anon client) validates the session before any DB access
 *   - user_id is stamped from the verified session, never from the body
 *   - service-role key lives only in server env vars (SUPABASE_SERVICE_ROLE_KEY)
 */

// ── Fingerprint (mirrors the client-side version in csv-import-dialog) ──────

function fingerprint(date: string, amount: number, title: string): string {
  const norm = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${date}|${Math.round(amount * 100)}|${norm}`;
}

// ── Request / response types ──────────────────────────────────────────────────

interface IncomingRow {
  title: string;
  amount: number;
  type: "income" | "expense" | "saving";
  date: string;
  categoryId: string;    // "__none__" or a category UUID
  goalId: string;        // "__none__" or a savings-goal UUID
  fitId?: string;        // OFX FITID for deduplication
}

interface ImportBody {
  rows: IncomingRow[];
  fileMode: "csv" | "pdf" | "ofx";
  force: boolean;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Authenticate — use server client (reads JWT from request cookies)
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Normalize: browser-cached JS from a previous deploy sends an array directly;
  // current dialog sends { rows, fileMode, force }.  Handle both.
  let rows: IncomingRow[];
  let fileMode: "csv" | "pdf" | "ofx" = "csv";
  let force = false;

  if (Array.isArray(rawBody)) {
    // Legacy format: array of DB-shaped rows with snake_case fields
    rows = (rawBody as Array<Record<string, unknown>>)
      .filter(r => typeof r.amount === "number" && Number(r.amount) > 0)
      .map(r => {
        const notes = (r.notes as string | null) ?? null;
        return {
          title:      String(r.title ?? ""),
          amount:     Number(r.amount),
          type:       (r.type as "income" | "expense" | "saving") ?? "expense",
          date:       String(r.date ?? ""),
          categoryId: String(r.category_id ?? "__none__"),
          goalId:     notes?.startsWith("goal_id:") ? notes.slice(8) : "__none__",
          fitId:      notes?.startsWith("ofx:") ? notes.slice(4) : undefined,
        };
      });
  } else {
    const b = rawBody as ImportBody;
    rows     = Array.isArray(b?.rows) ? b.rows : [];
    fileMode = (b?.fileMode ?? "csv") as "csv" | "pdf" | "ofx";
    force    = b?.force ?? false;
  }

  if (!rows.length) {
    return NextResponse.json({ error: "empty_payload" }, { status: 400 });
  }

  // Service-role client for all DB operations (bypasses RLS stale-JWT issues)
  const admin = createAdminClient();

  // Safety: skip zero-amount rows (DB has CHECK amount > 0)
  let newOnly = rows.filter(r => r.amount > 0);
  let skipped = 0;
  const examples: { date: string; title: string; amount: number }[] = [];

  // 3. Deduplication
  if (!force && newOnly.length > 0) {

    // ── OFX FITID deduplication ───────────────────────────────────────────
    if (fileMode === "ofx") {
      const fitIdNotes = newOnly.filter(r => r.fitId).map(r => `ofx:${r.fitId!}`);

      if (fitIdNotes.length > 0) {
        const { data: existingOFX } = await admin
          .from("transactions")
          .select("notes")
          .eq("user_id", user.id)
          .in("notes", fitIdNotes);

        const foundNotes = new Set<string>(
          (existingOFX ?? []).map((t: { notes: string | null }) => t.notes ?? "")
        );

        const fitBlocked = newOnly.filter(r => r.fitId && foundNotes.has(`ofx:${r.fitId}`));
        newOnly  = newOnly.filter(r => !r.fitId || !foundNotes.has(`ofx:${r.fitId}`));
        skipped += fitBlocked.length;
        examples.push(...fitBlocked.slice(0, 6).map(r => ({ date: r.date, title: r.title, amount: r.amount })));
      }
    }

    // ── Fingerprint deduplication ────────────────────────────────────────
    if (newOnly.length > 0) {
      const sortedDates = newOnly.map(r => r.date).sort();
      const minDate = sortedDates[0];
      const maxDate = sortedDates[sortedDates.length - 1];

      const { data: existing } = await admin
        .from("transactions")
        .select("date, amount, title")
        .eq("user_id", user.id)
        .gte("date", minDate)
        .lte("date", maxDate);

      const existingSet = new Set<string>(
        (existing ?? []).map((t: { date: string; amount: number; title: string }) =>
          fingerprint(t.date, t.amount, t.title)
        )
      );

      const fpBlocked = newOnly.filter(r => existingSet.has(fingerprint(r.date, r.amount, r.title)));
      newOnly  = newOnly.filter(r => !existingSet.has(fingerprint(r.date, r.amount, r.title)));
      skipped += fpBlocked.length;
      examples.push(
        ...fpBlocked
          .slice(0, Math.max(0, 6 - examples.length))
          .map(r => ({ date: r.date, title: r.title, amount: r.amount }))
      );
    }

    // All rows were duplicates
    if (!newOnly.length) {
      return NextResponse.json({ ok: true, imported: 0, skipped, examples });
    }
  }

  // 4. Build insert payload
  const payload = newOnly.map(r => ({
    user_id: user.id,
    title:   r.title,
    amount:  r.amount,
    type:    r.type,
    date:    r.date,
    category_id: (r.categoryId && r.categoryId !== "__none__") ? r.categoryId : null,
    notes: (r.type === "saving" && r.goalId && r.goalId !== "__none__")
      ? `goal_id:${r.goalId}`
      : r.fitId
      ? `ofx:${r.fitId}`
      : null,
    is_recurring:        false,
    recurrence_interval: null as string | null,
  }));

  // 5. Insert via service role
  const { error: insertError } = await admin.from("transactions").insert(payload);

  if (insertError) {
    console.error("[import-api] Insert failed:", {
      code:    insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint:    insertError.hint,
    });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: newOnly.length, skipped, examples });
}
