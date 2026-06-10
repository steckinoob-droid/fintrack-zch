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
import { applyPixGrant } from "@/lib/billing/pix-grant";

export const dynamic = "force-dynamic";

// ── GET: healthcheck ──────────────────────────────────────────────────────────

/**
 * GET /api/webhooks/mercadopago
 *
 * Lightweight diagnostic — confirms the route is reachable and shows which
 * env vars are configured. Never exposes secret values.
 */
export function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      hasMpToken:       !!process.env.MERCADOPAGO_ACCESS_TOKEN,
      hasWebhookSecret: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
      mpMode:           getMpEnv(),
      hasServiceRole:   !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      appUrl:           process.env.NEXT_PUBLIC_APP_URL ?? "(not set)",
    },
  });
}

// ── Webhook body shape ────────────────────────────────────────────────────────

/**
 * Both the modern webhook format and legacy IPN format are handled:
 *
 * Modern webhook (MP dashboard / notification_url, signed with x-signature):
 *   { id: number, type: "payment", action: "payment.created", data: { id: "12345" } }
 *
 * Legacy IPN (notification_url without dashboard config, no x-signature):
 *   { id: "12345", topic: "payment" }  — OR — query params ?id=12345&topic=payment
 */
interface MpNotificationBody {
  id?:       number | string;
  type?:     string;  // webhook format
  topic?:    string;  // IPN format
  action?:   string;
  data?:     { id: string };
  live_mode?: boolean;
}

// ── POST: receive notification ────────────────────────────────────────────────

/**
 * POST /api/webhooks/mercadopago
 *
 * Handles both signed webhooks (x-signature present) and unsigned IPN
 * notifications (no x-signature, notification_url based).
 *
 * Idempotency: deduplicated via webhook_events(provider, event_id) UNIQUE.
 * The event row is inserted BEFORE signature validation so every arriving
 * notification is visible, even ones that fail validation.
 */
export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("[webhook/mp] Service role not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: MpNotificationBody = {};
  try {
    body = await req.json() as MpNotificationBody;
  } catch {
    // Some IPN formats have no JSON body — fall through and rely on query params
  }

  const qs         = req.nextUrl.searchParams;
  const qsId       = qs.get("id");
  const qsTopic    = qs.get("topic") ?? qs.get("type");
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  // Unified event type — modern webhook uses `type`, IPN uses `topic`
  const eventType = body.type ?? body.topic ?? qsTopic ?? "unknown";

  // event_id for deduplication — modern webhook: body.id (notification ID)
  // IPN: body.id or qsId (both resolve to the payment ID in IPN)
  const rawId   = body.id ?? qsId;
  const eventId = rawId ? String(rawId) : `malformed_${Date.now()}`;

  // resourceId = the ID passed to the MP payments/preapprovals API
  // - Modern webhook: body.data.id
  // - IPN:            body.id (IS the resource ID in IPN format)
  const resourceId: string = body.data?.id ?? (body.id != null ? String(body.id) : (qsId ?? ""));

  console.log("[webhook/mp] Notification received", {
    eventId,
    eventType,
    resourceId,
    hasSignature:     !!xSignature,
    hasWebhookSecret: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
    mpMode:           getMpEnv(),
    tokenPrefix:      getTokenPrefix(process.env.MERCADOPAGO_ACCESS_TOKEN),
  });

  const supabase = createAdminClient();
  const provider = "mercado_pago";

  // ── Idempotency: insert webhook_events FIRST ───────────────────────────────
  // Must happen before signature check so every arriving notification is stored,
  // including ones that fail validation (visible for debugging).
  const { error: insertErr } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_type: eventType,
      event_id:   eventId,
      payload:    { ...body, _qs: Object.fromEntries(qs.entries()) } as unknown as Record<string, unknown>,
      processed:  false,
    });

  if (insertErr) {
    if (insertErr.code === "23505") {
      // Already seen this event_id — check if it was successfully processed
      const { data: existing } = await supabase
        .from("webhook_events")
        .select("processed")
        .eq("provider", provider)
        .eq("event_id", eventId)
        .single();

      if (existing?.processed) {
        return NextResponse.json({ ok: true, status: "already_processed" });
      }
      // processed = false → previous attempt errored, fall through to retry
    } else {
      console.error("[webhook/mp] webhook_events insert error:", insertErr.message);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }
  }

  // ── Signature validation ───────────────────────────────────────────────────
  //
  // Two cases:
  // 1. x-signature present → MUST validate. If MERCADOPAGO_WEBHOOK_SECRET is
  //    missing, reject (fail closed). An attacker can forge signed webhooks if
  //    the secret is absent and we continue, granting Pro access fraudulently.
  // 2. No x-signature → unsigned IPN (notification_url without dashboard config)
  //    → continue. Legitimate MP flow; no signature to validate.

  if (xSignature) {
    if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      console.error(
        "[webhook/mp] x-signature received but MERCADOPAGO_WEBHOOK_SECRET is not set" +
        " — rejecting (fail closed). Configure this env var in production.",
      );
      await supabase
        .from("webhook_events")
        .update({
          processed:    false,
          processed_at: new Date().toISOString(),
          error:        "secret_not_configured",
        })
        .eq("provider", provider)
        .eq("event_id", eventId);
      return NextResponse.json({ error: "secret_not_configured" }, { status: 500 });
    }
    if (!verifyMpSignature(xSignature, xRequestId, resourceId)) {
      console.warn("[webhook/mp] Signature INVALID — rejecting", { eventId, resourceId });
      await supabase
        .from("webhook_events")
        .update({
          processed:    false,
          processed_at: new Date().toISOString(),
          error:        "invalid_signature",
        })
        .eq("provider", provider)
        .eq("event_id", eventId);
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
  } else {
    console.warn("[webhook/mp] No x-signature — proceeding as unsigned IPN notification", {
      eventType, eventId, resourceId,
    });
  }

  // ── Process event ──────────────────────────────────────────────────────────
  let processingError: string | null = null;
  try {
    if (eventType === "payment") {
      if (!resourceId) throw new Error("Payment event missing resource ID");
      await handlePaymentEvent(supabase, resourceId);
    } else if (eventType === "subscription_preapproval") {
      if (!resourceId) throw new Error("Preapproval event missing resource ID");
      await handleSubscriptionEvent(supabase, resourceId);
    } else {
      console.log("[webhook/mp] Unhandled event type (not an error):", eventType);
    }
  } catch (err) {
    processingError = err instanceof Error ? err.message : String(err);
    console.error("[webhook/mp] Processing error — event", eventId, ":", processingError);
  }

  // ── Mark webhook_events ────────────────────────────────────────────────────
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
    // Return 500 so MP retries; dedup guard prevents infinite loops
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
    throw new Error(`Invalid external_reference on preapproval ${preApprovalId}: ${userId}`);
  }

  const newStatus = mapSubStatus(pa.status ?? "");

  const update: Record<string, unknown> = {
    provider:           "mercado_pago",
    mp_subscription_id: pa.id,
    status:             newStatus,
    updated_at:         new Date().toISOString(),
  };

  if (newStatus === "active")   update.plan_id = "pro";
  if (newStatus === "canceled") update.plan_id = "free";
  if (pa.payer_id)              update.mp_customer_id = String(pa.payer_id);

  if (newStatus === "canceled") {
    update.canceled_at   = new Date().toISOString();
    update.cancel_reason = "subscription_cancelled";
  }
  if (newStatus === "active" && pa.next_payment_date) {
    update.current_period_end   = pa.next_payment_date;
    update.current_period_start = new Date().toISOString();
  }

  let query = supabase.from("subscriptions").update(update).eq("user_id", userId);
  if (newStatus === "incomplete") query = query.not("status", "eq", "active");

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

  const metadata     = p.metadata as Record<string, unknown> | undefined;
  const isPixPayment =
    p.payment_method_id === "pix" ||
    metadata?.billing_reason === "pix_monthly";

  const mpStatus = mapPaymentStatus(p.status ?? "pending");
  const amount   = p.transaction_amount ?? 0;
  const currency = p.currency_id ?? "BRL";

  console.log("[webhook/mp] Payment details", {
    paymentId,
    userId,
    paymentMethodId: p.payment_method_id,
    paymentStatus:   p.status,
    mpStatus,
    isPixPayment,
    dateApproved:    p.date_approved ?? null,
  });

  // Must read billing_payments status BEFORE upsert to detect pending→approved.
  const { data: existingRecord } = await supabase
    .from("billing_payments")
    .select("status")
    .eq("mp_payment_id", String(p.id))
    .maybeSingle();
  const wasAlreadyApproved = existingRecord?.status === "approved";

  // Only link to subscription for card payments
  let subId: string | null = null;
  if (!isPixPayment) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single();
    subId = sub?.id ?? null;
  }

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

  if (mpStatus === "approved") {
    if (isPixPayment) {
      if (!wasAlreadyApproved) {
        const result = await applyPixGrant(supabase, userId);
        console.log("[webhook/mp] Pix grant applied", {
          userId,
          newExpiry: result.newExpiry,
          extended:  result.extended,
        });
      } else {
        console.log("[webhook/mp] Pix already approved — skipping duplicate grant", { userId });
      }
    } else {
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
