import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMpPreApproval } from "@/lib/billing/mercadopago";

/**
 * POST /api/billing/subscribe
 *
 * Creates a Mercado Pago PreApproval (recurring subscription) for the
 * authenticated user and returns the init_point URL for redirect.
 *
 * Security:
 * - Requires authenticated session.
 * - Price and plan are set server-side; client cannot influence them.
 * - Access token is never exposed to the client.
 */
export async function POST() {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL;
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!appUrl || !mpToken || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[billing/subscribe] Missing required env vars");
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Guard: already has active MP subscription ─────────────────────────────
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, provider, mp_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (
    sub?.provider === "mercado_pago" &&
    sub?.status === "active" &&
    sub?.mp_subscription_id
  ) {
    return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
  }

  // ── Create MP PreApproval ─────────────────────────────────────────────────
  try {
    const preApproval = getMpPreApproval();
    // notification_url is a valid MP REST field but absent from SDK types — use unknown cast
    type MpBody = Parameters<typeof preApproval.create>[0]["body"] & { notification_url?: string };
    const result = await preApproval.create({
      body: {
        payer_email:      user.email!,
        back_url:         `${appUrl}/settings?billing=callback`,
        reason:           "FinTrack Pro — Assinatura Mensal",
        auto_recurring: {
          frequency:          1,
          frequency_type:     "months",
          transaction_amount: 19.90,
          currency_id:        "BRL",
        },
        external_reference: user.id,
        notification_url:   `${appUrl}/api/webhooks/mercadopago`,
        status:             "pending",
      } as unknown as MpBody,
    });

    if (!result.init_point) {
      throw new Error("MP did not return init_point");
    }

    // Record intent in DB via service role (users have no UPDATE policy)
    const admin = createAdminClient();
    await admin
      .from("subscriptions")
      .update({
        provider:           "mercado_pago",
        mp_subscription_id: result.id,
        status:             "incomplete",
        updated_at:         new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({ init_point: result.init_point });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billing/subscribe]", msg);
    return NextResponse.json({ error: "mp_error", detail: msg }, { status: 502 });
  }
}
