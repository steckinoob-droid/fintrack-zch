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
