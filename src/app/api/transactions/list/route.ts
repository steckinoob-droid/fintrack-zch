import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offset     = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit      = parseInt(searchParams.get("limit") ?? "200", 10);
  const dateFrom   = searchParams.get("dateFrom");
  const dateTo     = searchParams.get("dateTo");
  const type       = searchParams.get("type");
  const categoryId = searchParams.get("categoryId");
  const search     = searchParams.get("search");
  const minValue   = parseFloat(searchParams.get("minValue") ?? "");
  const maxValue   = parseFloat(searchParams.get("maxValue") ?? "");
  const ascending  = searchParams.get("order") === "asc";
  const scope      = searchParams.get("scope"); // "reports" | null

  // ── Reports scope: enforce 3-month window for Free users ──────────────────
  // When scope=reports the server guarantees Free users can't retrieve data
  // older than the Free reports window, regardless of the dateFrom they send.
  // Pro users are unrestricted. Other scopes (transactions page, dashboard,
  // export CSV) do not pass scope=reports and are completely unaffected.
  // Strategy: clamp (not 403) — silently restricts the window so the caller
  // never needs to handle an error for a valid Free-user reports load.
  let qDateFrom = dateFrom;
  if (scope === "reports") {
    const { data: plan } = await supabase.rpc("get_my_plan");
    if ((plan as string | null) !== "pro") {
      const today = new Date();
      // Start of the month 2 months before current = first day of a 3-month window
      // e.g. today = 2026-06-10 → limit = 2026-04-01 (Apr + May + Jun = 3 months)
      const limitStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const minDate = `${limitStart.getFullYear()}-${String(limitStart.getMonth() + 1).padStart(2, "0")}-01`;
      if (!qDateFrom || qDateFrom < minDate) qDateFrom = minDate;
    }
  }

  const admin = createAdminClient();
  const isRecurring = searchParams.get("isRecurring");

  // PostgREST caps every response at the project's max-rows setting (1000 by
  // default). A single .range(0, 99999) therefore returns at most 1000 rows —
  // and with ascending order those are the OLDEST 1000, so callers that load the
  // full history (reports use limit=100000) silently lose the most RECENT
  // transactions, making short windows (3m/6m) look empty. Page through
  // server-side so every requested row is returned, regardless of the cap.
  const PAGE = 1000;

  const buildTxQuery = (from: number, to: number) => {
    let q = admin
      .from("transactions")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("date", { ascending })
      .order("id",   { ascending })   // deterministic tiebreaker for paging
      .range(from, to);

    if (qDateFrom)                              q = q.gte("date", qDateFrom);
    if (dateTo)                                 q = q.lte("date", dateTo);
    if (type && type !== "all")                 q = q.eq("type", type);
    if (categoryId && categoryId !== "__all__") q = q.eq("category_id", categoryId);
    if (search)                                 q = q.ilike("title", `%${search}%`);
    if (!isNaN(minValue) && minValue > 0)       q = q.gte("amount", minValue);
    if (!isNaN(maxValue) && maxValue > 0)       q = q.lte("amount", maxValue);
    if (isRecurring === "true")                 q = q.eq("is_recurring", true).is("recurrence_parent_id", null);
    return q;
  };

  // Walk pages until the caller's limit is met or a short page signals the end.
  // For ordinary calls (transactions page, limit≤1000) this runs exactly once,
  // identical to the previous single-query behavior.
  const transactions: unknown[] = [];
  let total = 0;
  const pageSize = Math.min(limit, PAGE);
  const hardEnd  = offset + limit; // never return more than was asked for

  for (let pageFrom = offset; pageSize > 0 && pageFrom < hardEnd; pageFrom += pageSize) {
    const pageTo = Math.min(pageFrom + pageSize - 1, hardEnd - 1);
    const { data, count, error } = await buildTxQuery(pageFrom, pageTo);
    if (error) {
      console.error("[api/transactions/list]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (count != null) total = count;
    const batch = data ?? [];
    transactions.push(...batch);
    if (batch.length < pageSize) break; // last page reached
  }

  const catRes = await admin.from("categories").select("*").eq("user_id", user.id).order("name");

  return NextResponse.json({
    transactions,
    total,
    categories: catRes.data ?? [],
  });
}
