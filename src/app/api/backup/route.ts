import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
