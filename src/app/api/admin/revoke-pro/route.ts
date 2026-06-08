import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";

/**
 * POST /api/admin/revoke-pro
 *
 * Revokes active manual Pro grants for a user identified by email.
 * Does NOT touch Mercado Pago subscriptions or Pix grants.
 * Sets revoked_at = now() — records are never deleted.
 *
 * Body: { email: string; reason?: string }
 */
export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Admin guard ───────────────────────────────────────────────────────────
  if (!isAdminEmail(user.email)) {
    console.warn("[admin/revoke-pro] Unauthorized attempt", { callerEmail: user.email });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { email?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email  = body.email?.trim().toLowerCase() ?? "";
  const reason = body.reason?.trim() ?? "";

  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Find target user by email ─────────────────────────────────────────────
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    console.error("[admin/revoke-pro] listUsers failed:", listError.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  const targetUser = listData.users.find(
    u => u.email?.toLowerCase() === email,
  );
  if (!targetUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const now = new Date();

  // ── Find active manual grants (exclude automated Pix grants) ───────────────
  // We do NOT revoke mercado_pago_pix grants — those are managed by the Pix flow.
  const { data: grants, error: fetchError } = await admin
    .from("plan_grants")
    .select("id, expires_at, granted_by")
    .eq("user_id", targetUser.id)
    .eq("plan_id", "pro")
    .is("revoked_at", null)
    .neq("granted_by", "mercado_pago_pix");

  if (fetchError) {
    console.error("[admin/revoke-pro] fetch grants failed:", fetchError.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  const activeManualGrants = (grants ?? []).filter(
    g => g.expires_at === null || new Date(g.expires_at) > now,
  );

  if (activeManualGrants.length === 0) {
    return NextResponse.json({ error: "no_active_grant" }, { status: 404 });
  }

  // ── Revoke all matching grants ────────────────────────────────────────────
  const grantIds = activeManualGrants.map(g => g.id);
  const { error: updateError } = await admin
    .from("plan_grants")
    .update({ revoked_at: now.toISOString() })
    .in("id", grantIds);

  if (updateError) {
    console.error("[admin/revoke-pro] update failed:", updateError.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  console.log("[admin/revoke-pro] Grants revoked", {
    adminEmail:    user.email,
    targetEmail:   email,
    targetUserId:  targetUser.id,
    revokedCount:  grantIds.length,
    reason:        reason || "(no reason)",
  });

  return NextResponse.json({
    ok:            true,
    user_id:       targetUser.id,
    email:         targetUser.email,
    revoked_count: grantIds.length,
  });
}
