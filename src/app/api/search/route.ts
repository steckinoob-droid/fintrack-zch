import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/search?q=<query>
 *
 * Global search across transactions, categories and savings goals.
 * Uses service-role client so it works regardless of browser JWT state.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ transactions: [], categories: [], goals: [] });
  }

  const admin = createAdminClient();

  const [txRes, catRes, goalRes] = await Promise.all([
    admin
      .from("transactions")
      .select("id, title, amount, type, date, category_id")
      .eq("user_id", user.id)
      .ilike("title", `%${q}%`)
      .order("date", { ascending: false })
      .limit(6),
    admin
      .from("categories")
      .select("id, name, type, color")
      .eq("user_id", user.id)
      .ilike("name", `%${q}%`)
      .limit(4),
    admin
      .from("savings_goals")
      .select("id, name, current_amount, target_amount, color")
      .eq("user_id", user.id)
      .ilike("name", `%${q}%`)
      .limit(3),
  ]);

  // Attach category names to the transaction results without a second join
  const catIds = [...new Set(
    (txRes.data ?? []).map(t => t.category_id).filter(Boolean)
  )] as string[];

  let catNames: Record<string, string> = {};
  if (catIds.length > 0) {
    const { data: cats } = await admin
      .from("categories")
      .select("id, name")
      .in("id", catIds)
      .eq("user_id", user.id);
    catNames = Object.fromEntries((cats ?? []).map(c => [c.id, c.name]));
  }

  return NextResponse.json({
    transactions: (txRes.data ?? []).map(t => ({
      id:           t.id,
      title:        t.title,
      amount:       Number(t.amount),
      type:         t.type,
      date:         t.date,
      categoryName: t.category_id ? (catNames[t.category_id] ?? null) : null,
    })),
    categories: catRes.data ?? [],
    goals: (goalRes.data ?? []).map(g => ({
      ...g,
      current_amount: Number(g.current_amount),
      target_amount:  Number(g.target_amount),
    })),
  });
}
