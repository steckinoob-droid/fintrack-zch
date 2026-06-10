import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { merchantTokens } from "@/lib/utils/merchant-key";

/**
 * GET /api/transactions/categorize-similar
 * Query params: title, type ("income" | "expense"), excludeId?
 *
 * Returns { count: number } — number of similar transactions that have no
 * category yet and would receive the bulk update if the user confirms.
 *
 * Only income/expense types are supported (not "saving" — those are goal deposits).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const title     = searchParams.get("title")     ?? "";
  const type      = searchParams.get("type")      ?? "";
  const excludeId = searchParams.get("excludeId") ?? "";

  if (!title || !["income", "expense"].includes(type)) {
    return NextResponse.json({ count: 0 });
  }

  const tokens = merchantTokens(title);
  if (tokens.length === 0) return NextResponse.json({ count: 0 });

  const admin = createAdminClient();

  // Build a count-only query: head:true avoids fetching actual rows
  let q = admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", type)
    .is("category_id", null);

  if (excludeId) q = q.neq("id", excludeId);

  // Each token adds an AND ILIKE condition
  for (const token of tokens) {
    q = q.ilike("title", `%${token}%`);
  }

  const { count, error } = await q;
  if (error) {
    console.error("[categorize-similar GET]", error.message);
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count ?? 0 });
}

/**
 * POST /api/transactions/categorize-similar
 * Body: { title, type, categoryId, excludeId? }
 *
 * Applies categoryId to all similar transactions that currently have no category
 * (category_id IS NULL). Only touches transactions owned by the authenticated user.
 *
 * Returns { updated: number; ids: string[] }
 *
 * Safety guarantees:
 *  - Only updates category_id IS NULL rows (never overwrites existing manual categories)
 *  - Always validates user_id (both in SELECT and UPDATE)
 *  - Never mixes income/expense (type filter)
 *  - Never touches "saving" type (goal deposits)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json() as {
    title?: string; type?: string; categoryId?: string; excludeId?: string;
  };
  const { title, type, categoryId, excludeId } = body;

  if (!title || !categoryId || !["income", "expense"].includes(type ?? "")) {
    return NextResponse.json({ error: "missing or invalid fields" }, { status: 400 });
  }

  const tokens = merchantTokens(title);
  if (tokens.length === 0) return NextResponse.json({ updated: 0, ids: [] });

  const admin = createAdminClient();

  // Verify the target category belongs to the authenticated user.
  const { data: ownedCat } = await admin
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ownedCat) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  // Step 1: SELECT matching IDs (validates user ownership + criteria)
  let q = admin
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", type!)
    .is("category_id", null);

  if (excludeId) q = q.neq("id", excludeId);

  for (const token of tokens) {
    q = q.ilike("title", `%${token}%`);
  }

  const { data: matches, error: findError } = await q;
  if (findError) {
    console.error("[categorize-similar POST find]", findError.message);
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!matches || matches.length === 0) {
    return NextResponse.json({ updated: 0, ids: [] });
  }

  const ids = (matches as { id: string }[]).map((m) => m.id);

  // Step 2: bulk UPDATE — restricted to the exact IDs found above + user_id double-check
  const { error: updateError } = await admin
    .from("transactions")
    .update({ category_id: categoryId })
    .in("id", ids)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[categorize-similar POST update]", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ updated: ids.length, ids });
}
