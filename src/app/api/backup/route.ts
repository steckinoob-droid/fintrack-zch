import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/utils/rate-limit";

/**
 * GET /api/backup
 *
 * Returns all user data as JSON for the backup export.
 * Uses service-role client so RLS never silently returns empty results.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Server-side plan check — backup is a Pro-only feature.
  // This prevents API-level bypass even if the client-side gate is circumvented.
  const { data: planData } = await supabase.rpc("get_my_plan");
  const userPlan = (planData as string | null) ?? "free";
  if (userPlan !== "pro") {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const rl = checkRateLimit(`rl:backup:${user.id}`, 3, 5 * 60_000);
  if (!rl.allowed) {
    console.warn("[backup] Rate limit exceeded", { userId: user.id });
    return NextResponse.json({ error: "too_many_requests" }, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  const admin = createAdminClient();

  const [txRes, budgetsRes, goalsRes, catsRes, profileRes] = await Promise.all([
    admin
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(100_000),
    admin.from("budgets").select("*").eq("user_id", user.id),
    admin.from("savings_goals").select("*").eq("user_id", user.id),
    admin.from("categories").select("*").eq("user_id", user.id),
    admin.from("profiles").select("name, currency").eq("id", user.id).single(),
  ]);

  return NextResponse.json({
    exported_at:  new Date().toISOString(),
    profile:      profileRes.data ?? null,
    transactions: txRes.data      ?? [],
    budgets:      budgetsRes.data ?? [],
    goals:        goalsRes.data   ?? [],
    categories:   catsRes.data    ?? [],
  });
}
