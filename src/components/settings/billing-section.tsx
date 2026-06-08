"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Loader2, Star, ExternalLink, AlertCircle, CheckCircle2, Clock } from "lucide-react";
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
  if (grant) return "manual_grant";
  if (sub?.provider === "mercado_pago") return "mercado_pago";
  return "free";
}

export function BillingSection() {
  const { lang } = useLang();
  const tx        = appT[lang].billing;
  const searchParams = useSearchParams();
  const showCallback = searchParams.get("billing") === "callback";

  const [info, setInfo]         = useState<BillingInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [planRes, subRes, grantRes] = await Promise.all([
        supabase.rpc("get_my_plan"),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("plan_grants")
          .select("*")
          .eq("user_id", user.id)
          .is("revoked_at", null)
          .order("granted_at", { ascending: false })
          .limit(1),
      ]);

      const plan  = (planRes.data as string | null) ?? "free";
      const sub   = subRes.data as Subscription | null;
      // filter to active (non-expired) grants only
      const now   = new Date().toISOString();
      const grants = (grantRes.data ?? []) as PlanGrant[];
      const grant = grants.find(g =>
        g.expires_at === null || g.expires_at > now
      ) ?? null;

      setInfo({
        plan:        plan as "free" | "pro",
        source:      resolveSource(plan, sub, grant),
        subscription: sub,
        activeGrant: grant,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/billing/subscribe", { method: "POST" });
      const json = await res.json() as { init_point?: string; error?: string };

      if (res.status === 409) {
        toast({ title: tx.alreadyPro });
        await load();
        return;
      }
      if (!res.ok || !json.init_point) {
        toast.error(tx.upgradeError);
        return;
      }
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

  return (
    <section className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard size={16} className="text-primary" />
        <h2 className="font-display font-semibold text-foreground">{tx.title}</h2>
      </div>

      {/* Callback banner */}
      {showCallback && (
        <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/30 px-3 py-2.5 text-sm text-primary">
          <Clock size={15} className="shrink-0 mt-0.5" />
          {tx.callbackBanner}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          {lang === "en" ? "Loading…" : "Carregando…"}
        </div>
      ) : !info ? null : (
        <div className="space-y-3">
          {/* Plan badge + name */}
          <div className="flex items-center gap-3">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
              info.plan === "pro"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-muted/40 text-muted-foreground border border-border/60",
            )}>
              {info.plan === "pro" && <Star size={12} className="fill-current" />}
              {info.plan === "pro" ? tx.pro : tx.free}
            </span>

            {/* Source chip */}
            <span className="text-xs text-muted-foreground">
              {info.source === "mercado_pago" && tx.sourceMp}
              {info.source === "manual_grant"  && tx.sourceGrant}
              {info.source === "free"          && tx.sourceFree}
            </span>
          </div>

          {/* Manual grant details */}
          {info.source === "manual_grant" && info.activeGrant && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 space-y-1 text-sm">
              <div className="flex items-center gap-1.5 text-primary font-medium">
                <CheckCircle2 size={14} />
                {tx.manualNote}
              </div>
              {info.activeGrant.expires_at ? (
                <p className="text-xs text-muted-foreground">
                  {tx.validUntil}: {formatDate(info.activeGrant.expires_at, lang)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{tx.noExpiry}</p>
              )}
            </div>
          )}

          {/* MP subscription details */}
          {info.source === "mercado_pago" && info.subscription && (
            <div className="rounded-lg bg-muted/20 border border-border/40 px-3 py-2.5 space-y-1 text-sm">
              <p className="text-muted-foreground">
                {tx.currentPlan}: <span className="text-foreground font-medium">{statusLabel(info.subscription.status)}</span>
              </p>
              {info.subscription.current_period_end && info.subscription.status === "active" && (
                <p className="text-xs text-muted-foreground">
                  {tx.nextBilling}: {formatDate(info.subscription.current_period_end, lang)}
                </p>
              )}
              {info.subscription.status === "trialing" && info.subscription.trial_end && (
                <p className="text-xs text-muted-foreground">
                  {tx.trialNote} {tx.validUntil}: {formatDate(info.subscription.trial_end, lang)}
                </p>
              )}
              {info.subscription.status === "canceled" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle size={12} />
                  {tx.cancelledNote}
                </div>
              )}
            </div>
          )}

          {/* Past due warning */}
          {info.subscription?.status === "past_due" && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2.5 text-sm text-amber-400">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {tx.statusPastDue}
            </div>
          )}

          {/* Upgrade button — shown for Free users or cancelled/past_due subscriptions */}
          {(info.plan === "free" ||
            info.subscription?.status === "canceled" ||
            info.subscription?.status === "past_due") && (
            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {upgrading
                  ? <><Loader2 size={14} className="animate-spin" />{tx.upgrading}</>
                  : <><Star size={14} />{tx.upgradeBtn}</>}
              </Button>
              <a
                href="/pricing"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {tx.viewPricing} <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
