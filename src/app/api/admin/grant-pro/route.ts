import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";

/**
 * POST /api/admin/grant-pro
 *
 * Grants Pro access to a user identified by email.
 * Requires the caller to be an admin (ADMIN_EMAILS env var).
 *
 * Body: { email: string; duration: "30d" | "1y" | "lifetime"; reason?: string }
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
    console.warn("[admin/grant-pro] Unauthorized attempt", { callerEmail: user.email });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { email?: string; duration?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email    = body.email?.trim().toLowerCase() ?? "";
  const duration = body.duration ?? "30d";
  const reason   = body.reason?.trim() ?? "";

  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }
  if (!["30d", "1y", "lifetime"].includes(duration)) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Find target user by email ─────────────────────────────────────────────
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    console.error("[admin/grant-pro] listUsers failed:", listError.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  const targetUser = listData.users.find(
    u => u.email?.toLowerCase() === email,
  );
  if (!targetUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // ── Check existing active Pro grant ───────────────────────────────────────
  const { data: existingGrants } = await admin
    .from("plan_grants")
    .select("id, expires_at")
    .eq("user_id", targetUser.id)
    .eq("plan_id", "pro")
    .is("revoked_at", null);

  const now = new Date();
  const activeGrant = (existingGrants ?? []).find(g =>
    g.expires_at === null || new Date(g.expires_at) > now,
  );

  if (activeGrant) {
    if (activeGrant.expires_at === null) {
      return NextResponse.json({ error: "already_pro_lifetime" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "already_pro", expires_at: activeGrant.expires_at },
      { status: 409 },
    );
  }

  // ── Compute expires_at ────────────────────────────────────────────────────
  let expiresAt: string | null;
  if (duration === "30d") {
    expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (duration === "1y") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() + 1);
    expiresAt = d.toISOString();
  } else {
    expiresAt = null; // lifetime
  }

  const grantReason = reason || "Pro manual concedido pelo admin";

  // ── Insert grant ──────────────────────────────────────────────────────────
  const { data: newGrant, error: insertError } = await admin
    .from("plan_grants")
    .insert({
      user_id:    targetUser.id,
      plan_id:    "pro",
      reason:     grantReason,
      granted_by: user.email!,
      granted_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[admin/grant-pro] insert failed:", insertError.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  console.log("[admin/grant-pro] Grant created", {
    adminEmail:   user.email,
    targetEmail:  email,
    targetUserId: targetUser.id,
    duration,
    expiresAt,
    grantId:      newGrant.id,
  });

  return NextResponse.json({
    ok:         true,
    user_id:    targetUser.id,
    email:      targetUser.email,
    plan_id:    "pro",
    duration,
    expires_at: expiresAt,
    grant_id:   newGrant.id,
  });
}
