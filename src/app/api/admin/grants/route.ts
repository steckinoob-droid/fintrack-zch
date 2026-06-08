import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";

export interface AdminGrant {
  id:         string;
  user_id:    string;
  user_email: string;
  plan_id:    string;
  reason:     string | null;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/**
 * GET /api/admin/grants
 *
 * Returns the 50 most recent plan_grants with resolved user emails.
 * Requires admin authorization.
 */
export async function GET() {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Admin guard ───────────────────────────────────────────────────────────
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // ── Fetch recent grants ───────────────────────────────────────────────────
  const { data: grants, error: grantsError } = await admin
    .from("plan_grants")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (grantsError) {
    console.error("[admin/grants] fetch failed:", grantsError.message);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  if (!grants || grants.length === 0) {
    return NextResponse.json({ grants: [] });
  }

  // ── Resolve user emails in parallel ──────────────────────────────────────
  const uniqueUserIds = [...new Set(grants.map(g => g.user_id as string))];
  const emailMap: Record<string, string> = {};

  await Promise.all(
    uniqueUserIds.map(async (uid) => {
      try {
        const { data } = await admin.auth.admin.getUserById(uid);
        if (data?.user?.email) {
          emailMap[uid] = data.user.email;
        }
      } catch {
        // User deleted or not found — keep user_id as fallback
      }
    }),
  );

  const enriched: AdminGrant[] = (grants as AdminGrant[]).map(g => ({
    ...g,
    user_email: emailMap[g.user_id] ?? g.user_id,
  }));

  return NextResponse.json({ grants: enriched });
}
