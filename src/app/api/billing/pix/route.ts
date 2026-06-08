import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMpPayment, getMpEnv, getTokenPrefix } from "@/lib/billing/mercadopago";

/**
 * POST /api/billing/pix
 *
 * Creates a Mercado Pago one-time Pix payment for Pro (30 days).
 * Does NOT grant Pro — that happens via the /api/webhooks/mercadopago handler
 * when MP confirms the payment as "approved".
 *
 * Returns the Pix QR code data to display in the UI.
 */

type PixPaymentResult = {
  id: number;
  status: string;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export async function POST() {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL;
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!appUrl || !mpToken || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[billing/pix] Missing required env vars", {
      hasAppUrl:         !!appUrl,
      hasMpToken:        !!mpToken,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const mpEnv = getMpEnv();

  console.log("[billing/pix] Payment initiated", {
    mpMode:            mpEnv,
    accessTokenPrefix: getTokenPrefix(mpToken),
    userId:            user.id,
  });

  try {
    const paymentClient = getMpPayment();

    // QR code expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // SDK types don't cover Pix-specific fields — cast through unknown.
    const result = (await (paymentClient as unknown as {
      create: (opts: { body: unknown }) => Promise<unknown>;
    }).create({
      body: {
        transaction_amount:   9.99,
        description:          "FinTrack Pro — 30 dias",
        payment_method_id:    "pix",
        payer:                { email: user.email! },
        external_reference:   user.id,
        metadata: {
          user_id:        user.id,
          plan_id:        "pro",
          billing_reason: "pix_monthly",
          period_days:    30,
        },
        notification_url:   `${appUrl}/api/webhooks/mercadopago`,
        date_of_expiration: expiresAt,
      },
    })) as PixPaymentResult;

    const qrData = result.point_of_interaction?.transaction_data;
    if (!qrData?.qr_code) {
      throw new Error("MP did not return a Pix QR code");
    }

    // Record as pending so billing section can detect "awaiting payment" state.
    // The webhook will upsert this to "approved" when MP confirms.
    const admin = createAdminClient();
    await admin.from("billing_payments").upsert(
      {
        user_id:        user.id,
        subscription_id: null,
        mp_payment_id:   String(result.id),
        amount:          9.99,
        currency:        "BRL",
        status:          "pending",
        payment_method:  "pix",
        payment_type:    "pix",
        plan_id:         "pro",
        period_start:    null,
        period_end:      null,
        raw_webhook:     result as unknown as Record<string, unknown>,
      },
      { onConflict: "mp_payment_id", ignoreDuplicates: true },
    );

    console.log("[billing/pix] Payment created", {
      mpMode:        mpEnv,
      userId:        user.id,
      mpPaymentId:   result.id,
      paymentStatus: result.status,
    });

    return NextResponse.json({
      payment_id:     result.id,
      qr_code:        qrData.qr_code,
      qr_code_base64: qrData.qr_code_base64 ?? null,
      ticket_url:     qrData.ticket_url ?? null,
      expires_at:     result.date_of_expiration ?? expiresAt,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billing/pix] Failed to create payment", {
      mpMode: getMpEnv(),
      userId: user.id,
      error:  msg,
    });
    return NextResponse.json({ error: "mp_error", detail: msg }, { status: 502 });
  }
}
