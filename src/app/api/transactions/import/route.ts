import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/transactions/import
 *
 * Receives a batch of pre-processed transaction rows from the CSV/PDF/OFX
 * import dialog and inserts them using the **server-side** Supabase client.
 *
 * Using the server client is critical: it reads the auth session from the
 * request cookies (kept fresh by proxy.ts), so auth.uid() is always correct
 * in PostgREST RLS checks.  Direct browser-client inserts can fail with an
 * RLS violation when the access-token cookie has silently expired.
 *
 * Security: user_id is NEVER trusted from the request body — it is always
 * overwritten with the authenticated user's ID from the server session.
 */

interface ImportRow {
  title: string;
  amount: number;
  type: "income" | "expense" | "saving";
  date: string;
  category_id: string | null;
  notes: string | null;
  is_recurring: boolean;
  recurrence_interval: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rows: ImportRow[];
  try {
    rows = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "empty_payload" }, { status: 400 });
  }

  // Stamp every row with the server-verified user_id.
  const payload = rows.map((r) => ({
    user_id: user.id,
    title:                r.title,
    amount:               r.amount,
    type:                 r.type,
    date:                 r.date,
    category_id:          r.category_id ?? null,
    notes:                r.notes ?? null,
    is_recurring:         r.is_recurring ?? false,
    recurrence_interval:  r.recurrence_interval ?? null,
  }));

  const { error: insertError } = await supabase.from("transactions").insert(payload);

  if (insertError) {
    console.error("[import-api] Insert failed:", {
      code:    insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint:    insertError.hint,
    });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: payload.length });
}
