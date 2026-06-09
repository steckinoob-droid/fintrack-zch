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
  const dateFrom   = searchParams.get("dateFrom");
  const dateTo     = searchParams.get("dateTo");
  const type       = searchParams.get("type");
  const categoryId = searchParams.get("categoryId");
  const search     = searchParams.get("search");
  const minValue   = parseFloat(searchParams.get("minValue") ?? "");
  const maxValue   = parseFloat(searchParams.get("maxValue") ?? "");

  const admin = createAdminClient();
  let q = admin
    .from("transactions")
    .select("type, amount")
    .eq("user_id", user.id)
    .limit(100_000);

  if (dateFrom)                               q = q.gte("date", dateFrom);
  if (dateTo)                                 q = q.lte("date", dateTo);
  if (type && type !== "all")                 q = q.eq("type", type);
  if (categoryId && categoryId !== "__all__") q = q.eq("category_id", categoryId);
  if (search)                                 q = q.ilike("title", `%${search}%`);
  if (!isNaN(minValue) && minValue > 0)       q = q.gte("amount", minValue);
  if (!isNaN(maxValue) && maxValue > 0)       q = q.lte("amount", maxValue);

  const { data, error } = await q;
  if (error) {
    console.error("[api/transactions/totals]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let income = 0, expense = 0;
  for (const t of data ?? []) {
    if (t.type === "income") income += Number(t.amount);
    else expense += Number(t.amount);
  }

  return NextResponse.json({ income, expense, count: data?.length ?? 0 });
}
