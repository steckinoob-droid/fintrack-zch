import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyMpSignature,
  getMpPreApproval,
  getMpPayment,
  mapSubStatus,
  mapPaymentStatus,
} from "@/lib/billing/mercadopago";

interface MpWebhookBody {
  id:         number;          // MP notification ID — idempotency key
  type:       string;          // "subscription_preapproval" | "payment"
  action:     string;          // "updated" | "payment.created" | etc.
  data:       { id: string };  // resource ID (preapproval ID or payment ID)
  live_mode:  boolean;
}

/**
 * POST /api/webhooks/mercadopago
 *
 * Receives Mercado Pago webhook notifications.
 *
 * Idempotency: every notification is deduplicated via webhook_events
 * (provider, event_id) — ON CONFLICT returns 200 immediately.
 *
 * DB writes are service-role only; no user session involved.
 *
 * IMPORTANT: event_id = String(body.id) — the notification ID, NOT body.data.id
 * (which is the resource ID used to fetch details from the MP API).
 */
export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("[webhook/mp] Service role not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: MpWebhookBody;
  try {
    body = await req.json() as MpWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const dataId     = body.data?.id ?? "";
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  // ── Verify signature ──────────────────────────────────────────────────────
  if (!verifyMpSignature(xSignature, xRequestId, dataId)) {
    console.warn("[webhook/mp] Signature verification failed for notification", body.id);
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const supabase  = createAdminClient();
  const eventId   = String(body.id);
  const provider  = "mercado_pago";

  // ── Idempotency: insert webhook_events ────────────────────────────────────
  // uq_webhook_events_idempotency = UNIQUE(provider, event_id)
  const { error: insertErr } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_type: body.type,
      event_id:   eventId,
      payload:    body as unknown as Record<string, unknown>,
      processed:  false,
    });

  if (insertErr) {
    if (insertErr.code === "23505") {
      // Already inserted — check if it was successfully processed
      const { data: existing } = await supabase
        .from("webhook_events")
        .select("processed")
        .eq("provider", provider)
        .eq("event_id", eventId)
        .single();

      if (existing?.processed) {
        return NextResponse.json({ ok: true, status: "already_processed" });
      }
      // Not yet processed (previous attempt may have errored) — fall through
    } else {
      console.error("[webhook/mp] DB insert error:", insertErr.message);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  // ── Process event ─────────────────────────────────────────────────────────
  let processingError: string | null = null;
  try {
    if (body.type === "subscription_preapproval") {
      await handleSubscriptionEvent(supabase, dataId);
    } else if (body.type === "payment") {
      await handlePaymentEvent(supabase, dataId);
    }
    // Other event types are logged but not acted on
  } catch (err) {
    processingError = err instanceof Error ? err.message : String(err);
    console.error("[webhook/mp] Processing error for event", eventId, ":", processingError);
  }

  // ── Mark webhook_events as processed ─────────────────────────────────────
  await supabase
    .from("webhook_events")
    .update({
      processed:    processingError === null,
      processed_at: new Date().toISOString(),
      error:        processingError,
    })
    .eq("provider", provider)
    .eq("event_id", eventId);

  if (processingError) {
    // Return 500 so MP retries; duplicate insert guard prevents infinite loops
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── Subscription preapproval handler ─────────────────────────────────────────

async function handleSubscriptionEvent(
  supabase: ReturnType<typeof createAdminClient>,
  preApprovalId: string,
) {
  const preApproval = getMpPreApproval();
  const pa = await preApproval.get({ id: preApprovalId });

  const userId = pa.external_reference;
  if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) {
    throw new Error(`Invalid external_reference: ${userId}`);
  }

  const newStatus = mapSubStatus(pa.status ?? "");

  const update: Record<string, unknown> = {
    provider:           "mercado_pago",
    mp_subscription_id: pa.id,
    status:             newStatus,
    plan_id:            newStatus === "active" ? "pro" : "free",
    updated_at:         new Date().toISOString(),
  };

  if (pa.payer_id)   update.mp_customer_id = String(pa.payer_id);
  if (newStatus === "canceled") {
    update.canceled_at   = new Date().toISOString();
    update.cancel_reason = "subscription_cancelled";
  }
  if (newStatus === "active") {
    // next_payment_date is the next billing date — use it as period end
    if (pa.next_payment_date) {
      update.current_period_end = pa.next_payment_date;
    }
    // Start date = now if not set
    update.current_period_start = new Date().toISOString();
  }

  const { error } = await supabase
    .from("subscriptions")
    .update(update)
    .eq("user_id", userId);

  if (error) throw new Error(`subscriptions update failed: ${error.message}`);
}

// ── Payment handler ───────────────────────────────────────────────────────────

async function handlePaymentEvent(
  supabase: ReturnType<typeof createAdminClient>,
  paymentId: string,
) {
  const paymentClient = getMpPayment();
  const p = await paymentClient.get({ id: paymentId });

  const userId = p.external_reference;
  if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) {
    throw new Error(`Invalid external_reference on payment ${paymentId}: ${userId}`);
  }

  // Get the subscription row to link billing_payments.subscription_id
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, mp_subscription_id")
    .eq("user_id", userId)
    .single();

  const mpStatus  = mapPaymentStatus(p.status ?? "pending");
  const amount    = p.transaction_amount ?? 0;
  const currency  = p.currency_id ?? "BRL";

  // Insert payment record (idempotent: skip if mp_payment_id already exists)
  const { data: existingPayment } = await supabase
    .from("billing_payments")
    .select("id")
    .eq("mp_payment_id", String(p.id))
    .maybeSingle();

  if (!existingPayment) {
    const { error: payInsertErr } = await supabase
      .from("billing_payments")
      .insert({
        user_id:          userId,
        subscription_id:  sub?.id ?? null,
        mp_payment_id:    String(p.id),
        mp_preference_id: p.metadata?.preference_id as string ?? null,
        amount,
        currency,
        status:           mpStatus,
        payment_method:   p.payment_method_id ?? null,
        payment_type:     p.payment_type_id   ?? null,
        plan_id:          "pro",
        period_start:     p.date_approved     ?? null,
        period_end:       computePeriodEnd(p.date_approved),
        raw_webhook:      p as unknown as Record<string, unknown>,
      });
    if (payInsertErr) throw new Error(`billing_payments insert failed: ${payInsertErr.message}`);
  }

  // Update subscription status based on payment result
  if (mpStatus === "approved") {
    const periodEnd = computePeriodEnd(p.date_approved);
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status:               "active",
        plan_id:              "pro",
        provider:             "mercado_pago",
        current_period_start: p.date_approved ?? new Date().toISOString(),
        current_period_end:   periodEnd,
        canceled_at:          null,
        cancel_reason:        null,
        updated_at:           new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) throw new Error(`subscriptions update (approved) failed: ${error.message}`);

  } else if (mpStatus === "rejected") {
    // Only update if currently incomplete/past_due — don't downgrade an active subscription
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("status", ["incomplete", "past_due"]);
    if (error) throw new Error(`subscriptions update (rejected) failed: ${error.message}`);
  }
}

function computePeriodEnd(dateApproved?: string | null): string {
  const base = dateApproved ? new Date(dateApproved) : new Date();
  base.setMonth(base.getMonth() + 1);
  return base.toISOString();
}
