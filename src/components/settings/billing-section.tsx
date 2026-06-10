"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  CreditCard, Loader2, Star, ExternalLink,
  AlertCircle, CheckCircle2, Clock, Zap, ArrowRight, QrCode, Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";
import type { BillingInfo, Subscription, PlanGrant } from "@/lib/types";

function formatDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function resolveSource(
  plan: string,
  sub: Subscription | null,
  grant: PlanGrant | null,
): BillingInfo["source"] {
  if (plan !== "pro") return "free";
  if (grant?.granted_by === "mercado_pago_pix") return "pix";
  if (grant) return "manual_grant";
  if (sub?.provider === "mercado_pago") return "mercado_pago";
  return "free";
}

export function BillingSection() {
  const { lang } = useLang();
  const tx        = appT[lang].billing;
  const pricingTx = appT[lang].pricing;
  const searchParams  = useSearchParams();
  const showCallback  = searchParams.get("billing") === "callback";

  const [info, setInfo]         = useState<BillingInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [planRes, subRes, grantRes, pixRes] = await Promise.all([
        supabase.rpc("get_my_plan"),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).single(),
        supabase.from("plan_grants").select("*").eq("user_id", user.id)
          .is("revoked_at", null).order("granted_at", { ascending: false }).limit(1),
        supabase.from("billing_payments")
          .select("mp_payment_id")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .eq("payment_method", "pix")
          .limit(1)
          .maybeSingle(),
      ]);

      const plan  = (planRes.data as string | null) ?? "free";
      const sub   = subRes.data as Subscription | null;
      const now   = new Date().toISOString();
      const grant = ((grantRes.data ?? []) as PlanGrant[])
        .find(g => g.expires_at === null || g.expires_at > now) ?? null;
      const pendingPixPayment = (pixRes.data as { mp_payment_id: string } | null) ?? null;

      setInfo({ plan: plan as "free" | "pro", source: resolveSource(plan, sub, grant), subscription: sub, activeGrant: grant, pendingPixPayment });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const res  = await fetch("/api/billing/subscribe", { method: "POST" });
      const json = await res.json() as { init_point?: string; error?: string };
      if (res.status === 409) { toast({ title: tx.alreadyPro }); await load(); return; }
      if (!res.ok || !json.init_point) { toast.error(tx.upgradeError); return; }
      window.location.href = json.init_point;
    } catch {
      toast.error(tx.upgradeError);
    } finally {
      setUpgrading(false);
    }
  }

  function statusLabel(status: string | undefined): string {
    switch (status) {
      case "active":     return tx.statusActive;
      case "canceled":   return tx.statusCanceled;
      case "past_due":   return tx.statusPastDue;
      case "trialing":   return tx.statusTrialing;
      case "incomplete": return tx.statusIncomplete;
      case "paused":     return tx.statusPaused;
      case "unpaid":     return tx.statusUnpaid;
      default:           return status ?? "";
    }
  }

  const isPro   = info?.plan === "pro";
  const isActive = info?.subscription?.status === "active";

  return (
    <section className="space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <CreditCard size={15} className="text-primary" />
        <h2 className="font-display font-semibold text-foreground text-sm">{tx.title}</h2>
      </div>

      {/* Callback banner */}
      {showCallback && (
        <div className="flex items-start gap-2.5 rounded-xl bg-primary/10 border border-primary/25 px-4 py-3 text-sm text-primary">
          <Clock size={15} className="shrink-0 mt-0.5" />
          <p>{tx.callbackBanner}</p>
        </div>
      )}

      {loading ? (
        <div className="glass-card p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          {lang === "en" ? "Loading…" : "Carregando…"}
        </div>
      ) : !info ? null : isPro ? (
        /* ── Pro plan card ──────────────────────────────────────────── */
        <div className={cn(
          "rounded-2xl border border-primary/35 overflow-hidden",
          "bg-gradient-to-br from-primary/10 via-card/70 to-card/90",
          "shadow-[0_0_32px_-8px_rgba(16,185,129,0.18)]",
        )}>
          {/* Top accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="p-5 space-y-4">
            {/* Plan badge row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                  {info.source === "pix"
                    ? <QrCode size={15} className="text-primary" />
                    : <Star size={15} className="text-primary fill-current" />}
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    Pro
                    {isActive && info.source !== "pix" && (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        {tx.statusActive}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {info.source === "mercado_pago" && tx.sourceMp}
                    {info.source === "manual_grant"  && tx.sourceGrant}
                    {info.source === "pix"            && tx.sourcePix}
                  </p>
                </div>
              </div>
              {info.source !== "pix" && (
                <span className="text-sm font-semibold text-primary">{tx.price}</span>
              )}
            </div>

            {/* Subscription details */}
            {info.source === "mercado_pago" && info.subscription && (
              <div className="rounded-xl bg-muted/20 border border-border/30 p-3 space-y-1.5 text-xs text-muted-foreground">
                {info.subscription.status !== "active" && (
                  <p className="text-foreground/80 font-medium">
                    {statusLabel(info.subscription.status)}
                  </p>
                )}
                {info.subscription.current_period_end && isActive && (
                  <p>{tx.nextBilling}: <span className="text-foreground/80">{formatDate(info.subscription.current_period_end, lang)}</span></p>
                )}
                {info.subscription.status === "trialing" && info.subscription.trial_end && (
                  <p>{tx.trialNote} {tx.validUntil}: <span className="text-foreground/80">{formatDate(info.subscription.trial_end, lang)}</span></p>
                )}
                {info.subscription.status === "canceled" && (
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <AlertCircle size={11} /> {tx.cancelledNote}
                  </div>
                )}
              </div>
            )}

            {/* Pix grant details */}
            {info.source === "pix" && info.activeGrant && (
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 flex items-start gap-2 text-xs">
                <QrCode size={13} className="text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-primary font-medium">{tx.sourcePix}</p>
                  {info.activeGrant.expires_at && (
                    <p className="text-muted-foreground">
                      {tx.pixExpiresOn}:{" "}
                      <span className="text-foreground/80">
                        {formatDate(info.activeGrant.expires_at, lang)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Manual grant details */}
            {info.source === "manual_grant" && info.activeGrant && (
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 flex items-start gap-2 text-xs">
                <CheckCircle2 size={13} className="text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-primary font-medium">{tx.manualNote}</p>
                  <p className="text-muted-foreground">
                    {info.activeGrant.expires_at
                      ? `${tx.validUntil}: ${formatDate(info.activeGrant.expires_at, lang)}`
                      : tx.noExpiry}
                  </p>
                </div>
              </div>
            )}

            {/* Past due warning */}
            {info.subscription?.status === "past_due" && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                {tx.statusPastDue}
              </div>
            )}

            {/* Active Pro benefits — shown for all Pro sources */}
            <div className="border-t border-primary/15 pt-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                {lang === "en" ? "Included in your plan" : "Incluído no seu plano"}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {(pricingTx.features.proUnlocks as readonly string[]).map((benefit, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Check size={10} className="text-primary/80 shrink-0 mt-0.5" />
                    <span className="leading-snug">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Manage link — only for recurring subscriptions */}
            {info.source === "mercado_pago" && (
              <a
                href="https://www.mercadopago.com.br/subscriptions"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <ExternalLink size={11} />
                {tx.managePlan}
              </a>
            )}
          </div>
        </div>
      ) : (
        /* ── Free plan card ─────────────────────────────────────────── */
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card">

          {/* Current plan row */}
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 border border-border/40">
                <CreditCard size={15} className="text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{tx.free}</p>
                <p className="text-xs text-muted-foreground">{tx.sourceFree}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-muted-foreground/60 tabular-nums">{pricingTx.freePrice}</span>
          </div>

          {/* Pending Pix payment banner */}
          {info.pendingPixPayment && (
            <div className="flex items-start gap-2.5 px-5 py-3 border-t border-border/30 bg-primary/5">
              <QrCode size={14} className="text-primary shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-primary">{tx.pixPending}</p>
                <p className="text-muted-foreground">{tx.pixPendingNote}</p>
              </div>
            </div>
          )}

          {/* Upgrade spotlight */}
          <div className="relative overflow-hidden border-t border-primary/20 px-5 py-5 bg-gradient-to-br from-primary/10 via-primary/5 to-card">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />

            {/* Pro badge + price row */}
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 border border-primary/35 px-3 py-1 text-xs font-bold text-primary">
                  <Zap size={10} className="fill-current" />
                  Pro
                </span>
                <span className="text-xs text-muted-foreground">{pricingTx.proDesc}</span>
              </div>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {pricingTx.proPrice}
                <span className="text-xs font-normal text-muted-foreground">{pricingTx.perMonth}</span>
              </span>
            </div>

            {/* Features grid */}
            <div className="relative grid grid-cols-2 gap-x-4 gap-y-2 mb-5">
              {(pricingTx.features.proUnlocks as readonly string[]).map((benefit, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Check size={11} className="text-primary/80 shrink-0 mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-snug">{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="relative w-full h-11 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-primary/35"
            >
              {upgrading
                ? <><Loader2 size={14} className="animate-spin" />{tx.upgrading}</>
                : <><Star size={14} className="fill-current" />{tx.upgradeBtn}</>}
            </Button>

            {/* View pricing link */}
            <div className="relative flex items-center justify-center mt-3">
              <a
                href="/pricing"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {tx.viewPricing}
                <ArrowRight size={11} />
              </a>
            </div>

            {/* Cancelled warning */}
            {info.subscription?.status === "canceled" && (
              <div className="relative flex items-center gap-1.5 text-xs text-amber-400 mt-2">
                <AlertCircle size={11} />
                {tx.cancelledNote}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
