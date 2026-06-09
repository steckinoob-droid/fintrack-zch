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
  const month = searchParams.get("month"); // "YYYY-MM-01"

  const admin = createAdminClient();

  let budgetsQ = admin.from("budgets").select("*").eq("user_id", user.id);
  if (month) budgetsQ = budgetsQ.eq("month", month);

  const [budgetsRes, catsRes] = await Promise.all([
    budgetsQ,
    admin.from("categories").select("*").eq("user_id", user.id).eq("type", "expense").order("name"),
  ]);

  if (budgetsRes.error) {
    console.error("[api/budgets/list]", budgetsRes.error.message);
    return NextResponse.json({ error: budgetsRes.error.message }, { status: 500 });
  }

  const catMap = new Map((catsRes.data ?? []).map(c => [c.id, c]));
  const budgets = (budgetsRes.data ?? []).map(b => ({
    ...b,
    category: b.category_id ? (catMap.get(b.category_id) ?? null) : null,
  }));

  return NextResponse.json({ budgets, categories: catsRes.data ?? [] });
}
