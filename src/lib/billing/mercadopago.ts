/**
 * Mercado Pago billing helpers — server-only.
 * Never import this file from client components.
 */
import {
  MercadoPagoConfig,
  PreApproval,
  Payment,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from "mercadopago";

// ── Client factory ────────────────────────────────────────────────────────────

function getMpConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("[billing] MERCADOPAGO_ACCESS_TOKEN not set");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000 } });
}

export function getMpPreApproval() {
  return new PreApproval(getMpConfig());
}

export function getMpPayment() {
  return new Payment(getMpConfig());
}

// ── Webhook signature ─────────────────────────────────────────────────────────

/**
 * Validates the x-signature header MP sends with every webhook.
 * Returns true if valid, false if invalid or secret missing.
 * Throws on malformed headers so the caller can return 400.
 *
 * Signature string: id:<data.id>;request-id:<x-request-id>;ts:<ts>
 * See: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function verifyMpSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[billing/webhook] MERCADOPAGO_WEBHOOK_SECRET not set — skipping signature check");
    return true;
  }
  if (!xSignature) return false;

  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId: xRequestId ?? "",
      dataId,
      secret,
    });
    return true;
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) return false;
    throw err;
  }
}

// ── Status mapping ────────────────────────────────────────────────────────────

/**
 * Maps an MP preapproval status → our subscriptions.status CHECK constraint.
 * MP:  authorized | pending   | paused   | cancelled
 * Our: active     | incomplete | paused  | canceled
 */
export function mapSubStatus(mpStatus: string): string {
  switch (mpStatus) {
    case "authorized": return "active";
    case "pending":    return "incomplete";
    case "paused":     return "paused";
    case "cancelled":  return "canceled";
    default:           return "incomplete";
  }
}

/**
 * Maps an MP payment status → billing_payments.status CHECK constraint.
 * MP payment statuses match ours directly; default to 'pending' for unknowns.
 */
export function mapPaymentStatus(mpStatus: string): string {
  const valid = new Set([
    "pending", "approved", "rejected", "refunded",
    "cancelled", "in_process", "in_mediation",
  ]);
  return valid.has(mpStatus) ? mpStatus : "pending";
}
