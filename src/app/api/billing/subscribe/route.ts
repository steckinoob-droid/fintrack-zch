import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMpPreApproval, getMpEnv, getTokenPrefix } from "@/lib/billing/mercadopago";

/**
 * POST /api/billing/subscribe
 *
 * Creates a Mercado Pago PreApproval and returns the correct checkout URL.
 * Sandbox mode  → sandbox_init_point (avoids "test environment" MP error)
 * Production    → init_point
 *
 * Safe diagnostics are logged; the token value is never logged.
 */

// MP returns sandbox_init_point but the SDK types don't declare it.
type PreApprovalResult = Awaited<ReturnType<ReturnType<typeof getMpPreApproval>["create"]>> & {
  sandbox_init_point?: string | null;
};

export async function POST() {
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL;
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const pubKey  = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

  // ── Env guard ────────────────────────────────────────────────────────────
  if (!appUrl || !mpToken || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[billing/subscribe] Missing required env vars", {
      hasAppUrl:          !!appUrl,
      hasMpToken:         !!mpToken,
      hasServiceRoleKey:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  // ── Environment detection ────────────────────────────────────────────────
  const mpEnv           = getMpEnv();
  const accessPrefix    = getTokenPrefix(mpToken);
  const publicKeyPrefix = getTokenPrefix(pubKey);

  // Detect mismatched credentials (TEST access token + APP_USR public key or vice-versa)
  if (
    accessPrefix    !== "unknown" &&
    publicKeyPrefix !== "unknown" &&
    accessPrefix    !== publicKeyPrefix
  ) {
    console.error("[billing/subscribe] Credential environment mismatch — aborting", {
      accessTokenPrefix: accessPrefix,
      publicKeyPrefix,
    });
    return NextResponse.json(
      { error: "mp_env_mismatch", detail: "Access token and public key are from different MP environments" },
      { status: 503 },
    );
  }

  console.log("[billing/subscribe] Checkout initiated", {
    mpMode:            mpEnv,
    accessTokenPrefix: accessPrefix,
    publicKeyPrefix,
    appUrl,
  });

  // ── Auth ─────────────────────────────────────────────────────────────────
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
    sub?.status   === "active"       &&
    sub?.mp_subscription_id
  ) {
    return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
  }

  // ── Create MP PreApproval ─────────────────────────────────────────────────
  try {
    const preApproval = getMpPreApproval();

    // notification_url is a valid MP REST field but absent from SDK types.
    type MpBody = Parameters<typeof preApproval.create>[0]["body"] & {
      notification_url?: string;
    };

    const result = (await preApproval.create({
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
    })) as PreApprovalResult;

    // Pick the correct redirect URL based on detected environment.
    // Sandbox credentials must use sandbox_init_point; mixing URLs with
    // production accounts triggers MP's "test environment" error.
    const isSandbox   = mpEnv === "sandbox";
    const redirectUrl = isSandbox
      ? (result.sandbox_init_point ?? result.init_point)
      : result.init_point;

    const urlField = isSandbox && result.sandbox_init_point
      ? "sandbox_init_point"
      : "init_point";

    console.log("[billing/subscribe] PreApproval created", {
      preApprovalId: result.id,
      mpMode:        mpEnv,
      usingField:    urlField,
      hasRedirectUrl: !!redirectUrl,
    });

    if (!redirectUrl) {
      throw new Error(`MP did not return a usable URL (tried ${urlField})`);
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

    return NextResponse.json({ init_point: redirectUrl });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billing/subscribe] PreApproval creation failed", {
      mpMode: mpEnv,
      error:  msg,
    });
    return NextResponse.json({ error: "mp_error", detail: msg }, { status: 502 });
  }
}
