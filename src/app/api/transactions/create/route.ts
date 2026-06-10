import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_RECURRING_LIMIT } from "@/lib/utils/plan-limits";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json() as Record<string, unknown>;

  const admin = createAdminClient();

  // Server-side Free-tier limit — only applies to recurring templates (not edits,
  // not regular transactions, not generated instances). Pro bypasses entirely.
  if (body.is_recurring === true) {
    const { data: plan } = await supabase.rpc("get_my_plan");
    if ((plan as string | null) !== "pro") {
      // Count templates only: is_recurring=true AND recurrence_parent_id IS NULL
      // (instances created by the scheduler have a parent_id set)
      const { count } = await admin
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_recurring", true)
        .is("recurrence_parent_id", null);
      if ((count ?? 0) >= FREE_RECURRING_LIMIT) {
        return NextResponse.json({ error: "recurring_limit_reached" }, { status: 403 });
      }
    }
  }

  // Explicit field mapping — never trust the full body spread.
  // Prevents injecting protected fields (user_id is always from auth token).
  const {
    title, amount, type, date, notes,
    category_id, is_recurring, recurrence_interval, recurrence_parent_id,
  } = body as Record<string, unknown>;

  const { data: transaction, error } = await admin
    .from("transactions")
    .insert({
      user_id:              user.id,
      title, amount, type, date,
      notes:                notes                ?? null,
      category_id:          category_id          ?? null,
      is_recurring:         is_recurring         ?? false,
      recurrence_interval:  recurrence_interval  ?? null,
      recurrence_parent_id: recurrence_parent_id ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/transactions/create]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction });
}
