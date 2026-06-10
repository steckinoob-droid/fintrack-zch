import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/imports/count
 *
 * Returns the number of successful imports (transaction_count > 0)
 * made by the calling user in the current calendar month, plus their plan.
 *
 * Free users are limited to 1 successful import per month.
 * Pro users always receive { count: 0, isPro: true } — no limit applies.
 *
 * Response: { count: number; isPro: boolean }
 */
export async function GET() {
  // 1. Authenticate
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Resolve plan
  const { data: planData } = await supabase.rpc("get_my_plan");
  const userIsPro = (planData as string | null) === "pro";

  if (userIsPro) {
    // No limit for Pro — skip the DB query entirely
    return NextResponse.json({ count: 0, isPro: true });
  }

  // 3. Count successful imports this calendar month (service role for reliability)
  const admin = createAdminClient();
  const now = new Date();
  // Use UTC to match database timestamps regardless of server timezone.
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { count, error: countError } = await admin
    .from("import_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gt("transaction_count", 0)
    .gte("created_at", firstOfMonth);

  if (countError) {
    console.error("[imports/count] query failed:", countError.message);
    // Fail closed — a failed rate-limit check must block, not allow.
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ count: count ?? 0, isPro: false });
}
