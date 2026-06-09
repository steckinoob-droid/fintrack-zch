import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/transactions/update
 * Body: { id: string; [field]: value }
 *
 * Updates any subset of transaction fields for the authenticated user.
 * Uses service role so the write never silently fails due to a stale JWT
 * in the browser client (auth.uid() = null → 0 rows, no error).
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { id?: string; [key: string]: unknown };
  const { id, ...fields } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("transactions")
    .update(fields)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[api/transactions/update]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
