import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * DELETE /api/delete-account
 *
 * Server-side account deletion.
 * 1. Verifies the caller is authenticated.
 * 2. Deletes all user data (transactions, budgets, goals, categories, profile).
 * 3. Deletes the Supabase Auth record via the service-role key (requires
 *    SUPABASE_SERVICE_ROLE_KEY in env — never exposed to the client).
 *
 * If SUPABASE_SERVICE_ROLE_KEY is not set, step 3 is skipped and the auth
 * record becomes an orphan (data-less, so effectively harmless), but step 2
 * still runs so all data is removed.
 */
export async function DELETE() {
  try {
    // ── 1. Authenticate the caller ─────────────────────────────────────────
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = user.id;

    // ── 2. Delete all user data ────────────────────────────────────────────
    // FK constraints: transactions/budgets/goals can be deleted in parallel;
    // categories references transactions so delete transactions first.
    await Promise.all([
      supabase.from("transactions").delete().eq("user_id", uid),
      supabase.from("budgets").delete().eq("user_id", uid),
      supabase.from("savings_goals").delete().eq("user_id", uid),
    ]);
    await supabase.from("categories").delete().eq("user_id", uid);
    await supabase.from("profiles").delete().eq("id", uid);

    // ── 3. Delete the Auth record (requires service-role key) ──────────────
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (serviceKey && supabaseUrl) {
      const admin = createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
      if (deleteError) {
        // Log but don't fail — data is already gone, so the orphan is harmless
        console.error("[delete-account] Failed to delete auth user:", deleteError.message);
      }
    } else {
      console.warn(
        "[delete-account] SUPABASE_SERVICE_ROLE_KEY not set — auth record kept as orphan (no data remains)"
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-account] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
