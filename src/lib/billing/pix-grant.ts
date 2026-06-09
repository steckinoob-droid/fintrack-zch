/**
 * Shared Pix grant logic — used by both the webhook handler and the
 * /api/billing/pix/status reconciliation path.
 *
 * Server-only. Never import from client components.
 */
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates or extends a 30-day Pro grant via plan_grants when a Pix payment
 * is confirmed approved. If the user already has an active Pix grant, the new
 * 30 days are stacked on top (new expiry = max(now, current_expires_at) + 30d).
 *
 * Idempotent: safe to call multiple times for the same payment — will UPDATE
 * the existing grant rather than inserting a duplicate.
 */
export async function applyPixGrant(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ extended: boolean; newExpiry: string }> {
  const now = new Date();

  // Find the most recent un-revoked Pix grant to stack on
  const { data: existingGrant, error: lookupErr } = await supabase
    .from("plan_grants")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("granted_by", "mercado_pago_pix")
    .is("revoked_at", null)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupErr) throw new Error(`plan_grants lookup failed: ${lookupErr.message}`);

  // New expiry = max(now, existing expiry) + 30 days
  const base =
    existingGrant?.expires_at && new Date(existingGrant.expires_at) > now
      ? new Date(existingGrant.expires_at)
      : now;

  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + 30);
  const newExpiryIso = newExpiry.toISOString();

  if (existingGrant) {
    const { error } = await supabase
      .from("plan_grants")
      .update({ expires_at: newExpiryIso, granted_at: now.toISOString() })
      .eq("id", existingGrant.id);
    if (error) throw new Error(`plan_grants update failed: ${error.message}`);
    return { extended: true, newExpiry: newExpiryIso };
  }

  const { error } = await supabase.from("plan_grants").insert({
    user_id:    userId,
    plan_id:    "pro",
    reason:     "Pro via Pix Mercado Pago",
    granted_by: "mercado_pago_pix",
    granted_at: now.toISOString(),
    expires_at: newExpiryIso,
  });
  if (error) throw new Error(`plan_grants insert failed: ${error.message}`);
  return { extended: false, newExpiry: newExpiryIso };
}
