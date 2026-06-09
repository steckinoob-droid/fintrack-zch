import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [goalsRes, autoRes] = await Promise.all([
    admin
      .from("savings_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("transactions")
      .select("notes, amount")
      .eq("user_id", user.id)
      .eq("type", "saving")
      .eq("is_recurring", true)
      .is("recurrence_parent_id", null),
  ]);

  if (goalsRes.error) {
    console.error("[api/goals/list]", goalsRes.error.message);
    return NextResponse.json({ error: goalsRes.error.message }, { status: 500 });
  }

  const autoDeposits: Record<string, number> = {};
  for (const t of autoRes.data ?? []) {
    if (t.notes?.startsWith("goal_id:")) {
      const gid = t.notes.replace("goal_id:", "").trim();
      autoDeposits[gid] = Number(t.amount);
    }
  }

  return NextResponse.json({ goals: goalsRes.data ?? [], autoDeposits });
}
