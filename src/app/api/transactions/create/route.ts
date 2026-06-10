import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown>;

  const admin = createAdminClient();
  const { data: transaction, error } = await admin
    .from("transactions")
    .insert({ ...body, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("[api/transactions/create]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction });
}
