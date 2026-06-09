import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { getMpPayment, mapPaymentStatus } from "@/lib/billing/mercadopago";
import { applyPixGrant } from "@/lib/billing/pix-grant";

/**
 * GET /api/admin/reconcile-pix?email=...
 *
 * Lists all Pix billing_payments for the given user email.
 * Used by the admin UI to find the right mp_payment_id before reconciling.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return NextResponse.json({ error: "internal", detail: listErr.message }, { status: 500 });

  const target = listData.users.find(u => u.email?.toLowerCase() === email);
  if (!target) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const { data: payments, error: payErr } = await admin
    .from("billing_payments")
    .select("mp_payment_id, status, amount, currency, created_at")
    .eq("user_id", target.id)
    .eq("payment_method", "pix")
    .order("created_at", { ascending: false })
    .limit(20);

  if (payErr) return NextResponse.json({ error: "db_error", detail: payErr.message }, { status: 500 });

  return NextResponse.json({ userId: target.id, payments: payments ?? [] });
}

/**
 * POST /api/admin/reconcile-pix
 *
 * Manually reconciles a Pix payment that was approved but never triggered
 * a Pro grant (e.g. because the webhook failed or MERCADOPAGO_WEBHOOK_SECRET
 * was missing from Vercel at the time of payment).
 *
 * Fetches fresh payment status from the MP API — only creates a grant if MP
 * confirms the payment is "approved". Safe to call multiple times (idempotent).
 *
 * Body: { mp_payment_id: string }
 *
 * How to find mp_payment_id:
 *   SELECT mp_payment_id, status, created_at
 *   FROM billing_payments
 *   WHERE user_id = '<uuid>' AND payment_method = 'pix'
 *   ORDER BY created_at DESC;
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    console.warn("[admin/reconcile-pix] Unauthorized attempt", { callerEmail: user.email });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { mp_payment_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const mpPaymentId = body.mp_payment_id?.trim();
  if (!mpPaymentId) {
    return NextResponse.json({ error: "mp_payment_id_required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find billing_payments to get the user_id
  const { data: payment, error: payLookupErr } = await admin
    .from("billing_payments")
    .select("user_id, status, mp_payment_id")
    .eq("mp_payment_id", mpPaymentId)
    .maybeSingle();

  if (payLookupErr) {
    return NextResponse.json({ error: "db_error", detail: payLookupErr.message }, { status: 500 });
  }
  if (!payment) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  const userId = payment.user_id as string;

  // Fetch fresh status from MP
  let p: Awaited<ReturnType<ReturnType<typeof getMpPayment>["get"]>>;
  try {
    p = await getMpPayment().get({ id: mpPaymentId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/reconcile-pix] MP API error", { mpPaymentId, error: msg });
    return NextResponse.json({ error: "mp_api_error", detail: msg }, { status: 502 });
  }

  const mpStatus = mapPaymentStatus(p.status ?? "pending");

  console.log("[admin/reconcile-pix] MP payment status", {
    mpPaymentId,
    userId,
    mpStatus,
    paymentMethodId: p.payment_method_id,
    dateApproved:    p.date_approved,
    adminEmail:      user.email,
  });

  if (mpStatus !== "approved") {
    return NextResponse.json({
      ok:           false,
      mpPaymentId,
      userId,
      mpStatus,
      message:      `Payment is ${mpStatus}, not approved — no grant created`,
    });
  }

  // Update billing_payments from pending → approved (no-op if already approved)
  await admin
    .from("billing_payments")
    .update({
      status:       "approved",
      period_start: p.date_approved ?? null,
      period_end:   computePeriodEnd(p.date_approved),
    })
    .eq("mp_payment_id", mpPaymentId)
    .neq("status", "approved");

  // Create or extend the grant
  const { extended, newExpiry } = await applyPixGrant(admin, userId);

  console.log("[admin/reconcile-pix] Grant applied", {
    mpPaymentId,
    userId,
    newExpiry,
    extended,
    adminEmail: user.email,
  });

  return NextResponse.json({
    ok:           true,
    mpPaymentId,
    userId,
    mpStatus,
    grantExtended: extended,
    expiresAt:     newExpiry,
  });
}

function computePeriodEnd(dateApproved?: string | null): string {
  const base = dateApproved ? new Date(dateApproved) : new Date();
  base.setMonth(base.getMonth() + 1);
  return base.toISOString();
}
