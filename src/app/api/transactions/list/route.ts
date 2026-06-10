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

  let q = admin
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("date", { ascending })
    .range(offset, offset + limit - 1);

  const isRecurring = searchParams.get("isRecurring");

  if (qDateFrom)                              q = q.gte("date", qDateFrom);
  if (dateTo)                                 q = q.lte("date", dateTo);
  if (type && type !== "all")                 q = q.eq("type", type);
  if (categoryId && categoryId !== "__all__") q = q.eq("category_id", categoryId);
  if (search)                                 q = q.ilike("title", `%${search}%`);
  if (!isNaN(minValue) && minValue > 0)       q = q.gte("amount", minValue);
  if (!isNaN(maxValue) && maxValue > 0)       q = q.lte("amount", maxValue);
  if (isRecurring === "true")                 q = q.eq("is_recurring", true).is("recurrence_parent_id", null);

  const [txRes, catRes] = await Promise.all([
    q,
    admin.from("categories").select("*").eq("user_id", user.id).order("name"),
  ]);

  if (txRes.error) {
    console.error("[api/transactions/list]", txRes.error.message);
    return NextResponse.json({ error: txRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    transactions: txRes.data ?? [],
    total: txRes.count ?? 0,
    categories: catRes.data ?? [],
  });
}
