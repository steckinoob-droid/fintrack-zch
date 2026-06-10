import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { id?: string; name: string; type: string; color: string; icon: string };
  const admin = createAdminClient();

  if (body.id) {
    const { id, ...fields } = body;
    const { error } = await admin
      .from("categories")
      .update(fields)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      console.error("[api/categories/save] update:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await admin
      .from("categories")
      .insert({ ...body, user_id: user.id });
    if (error) {
      console.error("[api/categories/save] insert:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
