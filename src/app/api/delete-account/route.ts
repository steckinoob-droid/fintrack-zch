import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * DELETE /api/delete-account
 *
 * Server-side account deletion. Steps:
 *  1. Guard: SUPABASE_SERVICE_ROLE_KEY MUST exist — fail fast with 503 if not.
 *     (Checked before any data changes so we never reach a partial-deletion state.)
 *  2. Verify the caller has a valid session.
 *  3. Explicitly delete all user data via the user's own session (respects RLS).
 *  4. Delete the Supabase Auth record via the admin client (service-role key).
 *     ON DELETE CASCADE from auth.users also removes any remaining rows.
 *  5. Return success ONLY when the auth record is confirmed gone.
 *     Any failure at step 4 returns HTTP 500 — NEVER reports success.
 */
export async function DELETE() {
  // ── Guard: service-role key required ──────────────────────────────────────
  // Must be set in Vercel env vars (NOT prefixed NEXT_PUBLIC_).
  // Without it we have no admin client and cannot call deleteUser.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    console.error(
      "[delete-account] SUPABASE_SERVICE_ROLE_KEY is not configured — " +
      "add it to Vercel environment variables (Settings → Environment Variables)."
    );
    return NextResponse.json(
      { error: "Account deletion unavailable: server configuration error. Contact support." },
      { status: 503 }
    );
  }

  try {
    // ── Authenticate caller ───────────────────────────────────────────────
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Capture user ID immediately — before any session or data changes
    const uid = user.id;

    // ── Explicit data deletion (belt-and-suspenders) ─────────────────────
    // All tables have ON DELETE CASCADE from auth.users, so admin.deleteUser
    // would cascade-delete everything anyway. We also do it explicitly here
    // so the deletion is scoped to the user's own RLS context.
    await Promise.all([
      supabase.from("transactions").delete().eq("user_id", uid),
      supabase.from("budgets").delete().eq("user_id", uid),
      supabase.from("savings_goals").delete().eq("user_id", uid),
    ]);
    await supabase.from("categories").delete().eq("user_id", uid);
    await supabase.from("profiles").delete().eq("id", uid);

    // ── Delete the Auth record — critical step ────────────────────────────
    // admin.deleteUser removes the row from auth.users.
    // Any remaining DB rows are cleaned by FK cascade.
    // If this step fails, we return HTTP 500 — NOT success.
    // The user's data may be partially gone, but the auth record still exists
    // so they can log in and recreate data. The client must surface this error.
    const admin = createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);

    if (deleteError) {
      console.error("[delete-account] admin.deleteUser failed:", deleteError.message);
      return NextResponse.json(
        { error: `Failed to delete account: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Auth record is confirmed gone — report success
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[delete-account] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
