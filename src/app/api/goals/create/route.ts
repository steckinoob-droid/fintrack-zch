import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_GOALS_LIMIT } from "@/lib/utils/plan-limits";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    name: string;
    target_amount: number;
    current_amount: number;
    deadline: string | null;
    color: string;
    icon: string;
  };

  const admin = createAdminClient();

  // Server-side Free-tier limit — Pro users bypass this check entirely.
  const { data: plan } = await supabase.rpc("get_my_plan");
  if ((plan as string | null) !== "pro") {
    const { count } = await admin
      .from("savings_goals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= FREE_GOALS_LIMIT) {
      return NextResponse.json({ error: "goals_limit_reached" }, { status: 403 });
    }
  }

  const { data: goal, error } = await admin
    .from("savings_goals")
    .insert({ ...body, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("[api/goals/create]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal });
}
