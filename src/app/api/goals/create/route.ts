import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
