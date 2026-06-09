import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMpPayment, mapPaymentStatus } from "@/lib/billing/mercadopago";
import { applyPixGrant } from "@/lib/billing/pix-grant";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/pix/status?payment_id=<mp_payment_id>
 *
 * Polls the Mercado Pago API for the current payment status.
 *
 * If the payment is approved but no Pro grant exists yet (i.e. the webhook
 * fired but failed), this route creates the grant inline — self-healing path
 * so the user does not need to contact support.
 *
 * Used by the Pix QR dialog to poll every few seconds and auto-confirm.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const paymentId = req.nextUrl.searchParams.get("payment_id");
  if (!paymentId) {
    return NextResponse.json({ error: "payment_id_required" }, { status: 400 });
  }

  try {
    const paymentClient = getMpPayment();
    const p = await paymentClient.get({ id: paymentId });

    // Verify this payment belongs to the requesting user
    if (p.external_reference !== user.id) {
      console.warn("[billing/pix/status] external_reference mismatch", {
        paymentId,
        userId: user.id,
        externalRef: p.external_reference,
      });
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const mpStatus = mapPaymentStatus(p.status ?? "pending");

    console.log("[billing/pix/status] Polled payment", {
      paymentId,
      userId:  user.id,
      status:  mpStatus,
      method:  p.payment_method_id,
    });

    if (mpStatus !== "approved") {
      return NextResponse.json({ status: mpStatus, isPro: false });
    }

    // ── Payment is approved — check for existing grant ────────────────────
    const admin = createAdminClient();
    const now   = new Date().toISOString();

    const { data: existingGrant } = await admin
      .from("plan_grants")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .eq("granted_by", "mercado_pago_pix")
      .is("revoked_at", null)
      .gt("expires_at", now)
      .limit(1)
      .maybeSingle();

    if (existingGrant) {
      return NextResponse.json({
        status:       "approved",
        isPro:        true,
        grantCreated: false,
        expiresAt:    existingGrant.expires_at,
      });
    }

    // ── No grant yet — create it (webhook failed to fire) ─────────────────
    console.log("[billing/pix/status] Approved payment has no grant — reconciling", {
      paymentId,
      userId: user.id,
    });

    // Update billing_payments from pending → approved
    await admin
      .from("billing_payments")
      .update({
        status:       "approved",
        period_start: p.date_approved ?? null,
        period_end:   computePeriodEnd(p.date_approved),
      })
      .eq("mp_payment_id", String(p.id))
      .eq("user_id", user.id)
      .eq("status", "pending");

    const { newExpiry, extended } = await applyPixGrant(admin, user.id);

    console.log("[billing/pix/status] Grant created via reconciliation", {
      paymentId,
      userId:   user.id,
      expiresAt: newExpiry,
      extended,
    });

    return NextResponse.json({
      status:       "approved",
      isPro:        true,
      grantCreated: true,
      expiresAt:    newExpiry,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billing/pix/status] Error", {
      paymentId,
      userId: user.id,
      error:  msg,
    });
    return NextResponse.json({ error: "mp_error", detail: msg }, { status: 502 });
  }
}

function computePeriodEnd(dateApproved?: string | null): string {
  const base = dateApproved ? new Date(dateApproved) : new Date();
  base.setMonth(base.getMonth() + 1);
  return base.toISOString();
}
