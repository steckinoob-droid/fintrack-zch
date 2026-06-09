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

  const admin = createAdminClient();

  let q = admin
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("date", { ascending })
    .range(offset, offset + limit - 1);

  if (dateFrom)                               q = q.gte("date", dateFrom);
  if (dateTo)                                 q = q.lte("date", dateTo);
  if (type && type !== "all")                 q = q.eq("type", type);
  if (categoryId && categoryId !== "__all__") q = q.eq("category_id", categoryId);
  if (search)                                 q = q.ilike("title", `%${search}%`);
  if (!isNaN(minValue) && minValue > 0)       q = q.gte("amount", minValue);
  if (!isNaN(maxValue) && maxValue > 0)       q = q.lte("amount", maxValue);

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
