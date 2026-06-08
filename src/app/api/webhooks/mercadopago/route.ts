import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyMpSignature,
  getMpPreApproval,
  getMpPayment,
  getMpEnv,
  getTokenPrefix,
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

  // Safe diagnostic: log mode without exposing token value
  console.log("[webhook/mp] Received notification", {
    mpMode:            getMpEnv(),
    accessTokenPrefix: getTokenPrefix(process.env.MERCADOPAGO_ACCESS_TOKEN),
    hasWebhookSecret:  !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
  });

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
    updated_at:         new Date().toISOString(),
  };

  // Only update plan_id for terminal state changes; leave it untouched for paused/incomplete
  if (newStatus === "active")   update.plan_id = "pro";
  if (newStatus === "canceled") update.plan_id = "free";

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
    update.current_period_start = new Date().toISOString();
  }

  // A stale "pending→incomplete" event must not overwrite an already-active subscription.
  // Race: payment webhook arrives and sets active, then the original pending preapproval
  // event is retried/replayed — without this guard it would downgrade to incomplete.
  let query = supabase
    .from("subscriptions")
    .update(update)
    .eq("user_id", userId);

  if (newStatus === "incomplete") {
    query = query.not("status", "eq", "active");
  }

  const { error } = await query;

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

  // Pix payments: identified by payment_method_id or by the metadata we set in /api/billing/pix
  const metadata    = p.metadata as Record<string, unknown> | undefined;
  const isPixPayment =
    p.payment_method_id === "pix" ||
    metadata?.billing_reason === "pix_monthly";

  // For card payments only: get the subscription row to link billing_payments.subscription_id
  let subId: string | null = null;
  if (!isPixPayment) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single();
    subId = sub?.id ?? null;
  }

  const mpStatus = mapPaymentStatus(p.status ?? "pending");
  const amount   = p.transaction_amount ?? 0;
  const currency = p.currency_id ?? "BRL";

  // Check if this payment was already recorded as approved (for idempotent grant logic).
  // Must happen BEFORE the upsert so we can detect a pending→approved transition.
  const { data: existingRecord } = await supabase
    .from("billing_payments")
    .select("status")
    .eq("mp_payment_id", String(p.id))
    .maybeSingle();
  const wasAlreadyApproved = existingRecord?.status === "approved";

  // Upsert billing_payments — ignoreDuplicates: false so pending Pix records
  // created by /api/billing/pix get their status updated to "approved" here.
  const { error: payUpsertErr } = await supabase
    .from("billing_payments")
    .upsert(
      {
        user_id:          userId,
        subscription_id:  subId,
        mp_payment_id:    String(p.id),
        mp_preference_id: (metadata?.preference_id as string) ?? null,
        amount,
        currency,
        status:           mpStatus,
        payment_method:   p.payment_method_id ?? null,
        payment_type:     p.payment_type_id   ?? null,
        plan_id:          "pro",
        period_start:     p.date_approved     ?? null,
        period_end:       computePeriodEnd(p.date_approved),
        raw_webhook:      p as unknown as Record<string, unknown>,
      },
      { onConflict: "mp_payment_id", ignoreDuplicates: false },
    );
  if (payUpsertErr) throw new Error(`billing_payments upsert failed: ${payUpsertErr.message}`);

  console.log("[webhook/mp] Payment processed", {
    mpPaymentId:    String(p.id),
    userId,
    paymentMethod:  p.payment_method_id ?? "unknown",
    paymentStatus:  mpStatus,
    isPixPayment,
  });

  if (mpStatus === "approved") {
    if (isPixPayment) {
      // Pix path: grant Pro for 30 days via plan_grants.
      // Skip if we already processed this payment (idempotency).
      if (!wasAlreadyApproved) {
        await handlePixGrant(supabase, userId);
      }
    } else {
      // Card subscription path: update subscriptions table.
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
    }
  } else if (mpStatus === "rejected" && !isPixPayment) {
    // Only downgrade for card subscriptions — Pix rejection doesn't affect subscriptions.
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("status", ["incomplete", "past_due"]);
    if (error) throw new Error(`subscriptions update (rejected) failed: ${error.message}`);
  }
}

// ── Pix grant handler ─────────────────────────────────────────────────────────

/**
 * Creates or extends a 30-day Pro grant via plan_grants when a Pix payment is approved.
 * If the user already has an active Pix grant, the new 30 days are stacked on top
 * (new expiry = max(now, current_expires_at) + 30 days).
 */
async function handlePixGrant(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const now = new Date();

  // Look for an existing unexpired Pix grant to stack on
  const { data: existingGrant } = await supabase
    .from("plan_grants")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("granted_by", "mercado_pago_pix")
    .is("revoked_at", null)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // New expiry = max(now, current_expires_at) + 30 days
  const base = existingGrant?.expires_at && new Date(existingGrant.expires_at) > now
    ? new Date(existingGrant.expires_at)
    : now;

  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + 30);

  if (existingGrant) {
    const { error } = await supabase
      .from("plan_grants")
      .update({ expires_at: newExpiry.toISOString(), granted_at: now.toISOString() })
      .eq("id", existingGrant.id);
    if (error) throw new Error(`plan_grants update failed: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("plan_grants")
      .insert({
        user_id:    userId,
        plan_id:    "pro",
        reason:     "Pro via Pix Mercado Pago",
        granted_by: "mercado_pago_pix",
        granted_at: now.toISOString(),
        expires_at: newExpiry.toISOString(),
      });
    if (error) throw new Error(`plan_grants insert failed: ${error.message}`);
  }

  console.log("[webhook/mp] Pix grant applied", {
    userId,
    newExpiry: newExpiry.toISOString(),
    extended: !!existingGrant,
  });
}

function computePeriodEnd(dateApproved?: string | null): string {
  const base = dateApproved ? new Date(dateApproved) : new Date();
  base.setMonth(base.getMonth() + 1);
  return base.toISOString();
}
