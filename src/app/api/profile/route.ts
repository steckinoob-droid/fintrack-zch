import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/profile — fetch the authenticated user's profile (service role). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // PGRST116 = no rows — that's OK (profile may not exist yet)
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

/**
 * PATCH /api/profile — upsert the current user's profile fields.
 * Body: { name?: string; currency?: string }
 * Uses upsert so a missing profile row is created on first save.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { name?: string; currency?: string };

  // Build the patch — only include fields that were actually sent
  const patch: Record<string, string> = { id: user.id };
  if (typeof body.name     === "string") patch.name     = body.name.trim();
  if (typeof body.currency === "string") patch.currency = body.currency;

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .upsert(patch, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
