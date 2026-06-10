import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json() as
    | { id?: string; category_id: string; amount: number; month: string }
    | Array<{ category_id: string; amount: number; month: string }>;

  // Validate month format — must be YYYY-MM-01 (first day of a calendar month).
  // An invalid format breaks the upsert unique constraint (user_id,category_id,month).
  // The id-based update path only writes `amount` and never uses month, so skip it.
  const MONTH_RE = /^\d{4}-\d{2}-01$/;
  if (Array.isArray(body)) {
    if (body.some(b => !b.month || !MONTH_RE.test(b.month))) {
      return NextResponse.json({ error: "invalid_month_format" }, { status: 400 });
    }
  } else if (!body.id) {
    if (!body.month || !MONTH_RE.test(body.month)) {
      return NextResponse.json({ error: "invalid_month_format" }, { status: 400 });
    }
  }

  const admin = createAdminClient();

  if (Array.isArray(body)) {
    const records = body.map(b => ({ ...b, user_id: user.id }));
    const { error } = await admin.from("budgets").insert(records);
    if (error) {
      console.error("[api/budgets/save] bulk:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: records.length });
  }

  if (body.id) {
    const { error } = await admin
      .from("budgets")
      .update({ amount: body.amount })
      .eq("id", body.id)
      .eq("user_id", user.id);
    if (error) {
      console.error("[api/budgets/save] update:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await admin
      .from("budgets")
      .upsert({ ...body, user_id: user.id }, { onConflict: "user_id,category_id,month" });
    if (error) {
      console.error("[api/budgets/save] upsert:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
