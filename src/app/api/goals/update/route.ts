import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { id?: string; [key: string]: unknown };
  const { id } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  // Whitelist updatable fields — prevents injecting user_id or id to transfer
  // ownership of the goal to another user's account.
  const ALLOWED = ["name", "target_amount", "current_amount", "deadline", "color", "icon"] as const;
  const fields: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body && body[key] !== undefined) fields[key] = body[key];
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("savings_goals")
    .update(fields)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[api/goals/update]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
