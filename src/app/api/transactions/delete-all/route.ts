import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DELETE /api/transactions/delete-all
 *
 * Deletes ALL transactions for the authenticated user.
 * Uses the service-role client to bypass RLS so the delete works
 * regardless of the anon-client stale-JWT issue in Route Handlers.
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Count before delete for the response
  const { count: before } = await admin
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  console.log(`[delete-all] user=${user.id.slice(0, 8)} before=${before}`);

  const { error: deleteError } = await admin
    .from("transactions")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("[delete-all] delete FAILED:", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  console.log(`[delete-all] deleted ${before ?? 0} transactions for user=${user.id.slice(0, 8)}`);
  return NextResponse.json({ ok: true, deleted: before ?? 0 });
}
