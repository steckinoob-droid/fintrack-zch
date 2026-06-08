"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Star, ArrowLeft, Loader2, Shield, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

interface Props {
  currentPlan: string;
  isLoggedIn: boolean;
}

export function PricingClient({ currentPlan, isLoggedIn }: Props) {
  const { lang } = useLang();
  const tx        = appT[lang].pricing;
  const billingTx = appT[lang].billing;
  const [upgrading, setUpgrading] = useState(false);

  async function handleUpgrade() {
    if (!isLoggedIn) { window.location.href = `/login?next=/pricing`; return; }
    setUpgrading(true);
    try {
      const res  = await fetch("/api/billing/subscribe", { method: "POST" });
      const json = await res.json() as { init_point?: string; error?: string };
      if (res.status === 409) { toast({ title: billingTx.alreadyPro }); return; }
      if (!res.ok || !json.init_point) { toast.error(billingTx.upgradeError); return; }
      window.location.href = json.init_point;
    } catch {
      toast.error(billingTx.upgradeError);
    } finally {
      setUpgrading(false);
    }
  }

  const isPro = currentPlan === "pro";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border/40 px-6 py-4 flex items-center gap-3 bg-background/80 backdrop-blur-sm">
        <Link
          href={isLoggedIn ? "/dashboard" : "/"}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          {tx.backToApp}
        </Link>
        <span className="text-border/60 select-none">|</span>
        <span className="font-display font-bold text-primary text-sm">FinTrack</span>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center px-4 py-14 sm:py-20 gap-12">

        {/* Hero */}
        <div className="text-center space-y-4 max-w-xl animate-fade-in">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Zap size={10} className="fill-current" />
            {tx.mostPopular}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {tx.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">{tx.subtitle}</p>
        </div>

        {/* ── Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-3xl">

          {/* Free card */}
          <div
            className="glass-card p-7 sm:p-8 flex flex-col gap-7 animate-slide-up"
            style={{ animationDelay: "0.05s", animationFillMode: "both" }}
          >
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                {tx.freeName}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-foreground">{tx.freePrice}</span>
                <span className="text-sm text-muted-foreground">{tx.perMonth}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{tx.freeDesc}</p>
            </div>

            <ul className="space-y-3 flex-1">
              {tx.features.freeList.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/60">
                    <Check size={10} className="text-muted-foreground" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              disabled
              className="w-full opacity-60 cursor-default"
            >
              {!isPro ? tx.currentPlan : tx.ctaFree}
            </Button>
          </div>

          {/* Pro card */}
          <div
            className={cn(
              "relative flex flex-col gap-7 rounded-2xl p-7 sm:p-8",
              "bg-gradient-to-b from-primary/10 via-card/60 to-card/80",
              "border border-primary/40",
              "shadow-[0_0_56px_-8px_rgba(16,185,129,0.22)]",
              "animate-slide-up",
            )}
            style={{ animationDelay: "0.12s", animationFillMode: "both" }}
          >
            {/* Top glow line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent rounded-t-2xl" />

            {/* Most popular badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1 text-[11px] font-bold text-primary-foreground shadow-lg shadow-primary/40 whitespace-nowrap">
              <Star size={10} className="fill-current" />
              {tx.mostPopular}
            </div>

            {/* Plan info */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5">
                <Star size={12} className="text-primary fill-primary" />
                <p className="text-[11px] font-semibold text-primary uppercase tracking-widest">
                  {tx.proName}
                </p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-foreground">{tx.proPrice}</span>
                <span className="text-sm text-muted-foreground">{tx.perMonth}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{tx.proDesc}</p>
            </div>

            {/* Features */}
            <div className="flex-1 space-y-4">
              {/* Free features included */}
              <ul className="space-y-2.5">
                {tx.features.freeList.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-foreground/70">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      <Check size={10} className="text-primary/60" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Pro-exclusive separator */}
              <div className="border-t border-primary/15 pt-3 space-y-2.5">
                <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider">
                  {tx.proExclusiveLabel}
                </p>
                {tx.features.proList.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-foreground">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/25">
                      <Check size={10} className="text-primary" />
                    </span>
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            {isPro ? (
              <Button disabled className="w-full bg-primary/20 text-primary border border-primary/30 gap-2">
                <Star size={13} className="fill-current" />
                {tx.currentPlan}
              </Button>
            ) : (
              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                className={cn(
                  "w-full gap-2 font-semibold",
                  "bg-primary hover:bg-primary/90 text-primary-foreground",
                  "shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40",
                  "transition-all duration-200",
                )}
              >
                {upgrading
                  ? <><Loader2 size={14} className="animate-spin" />{billingTx.upgrading}</>
                  : <><Star size={14} />{isLoggedIn ? tx.upgrade : tx.loginToUpgrade}</>}
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
              {tx.guarantee}
            </p>
          </div>
        </div>

        {/* ── Trust row ───────────────────────────────────────────────── */}
        <div
          className="flex flex-wrap justify-center gap-6 sm:gap-10 animate-fade-in"
          style={{ animationDelay: "0.22s", animationFillMode: "both" }}
        >
          {[
            { icon: Shield,     label: tx.trustSecure  },
            { icon: RefreshCw,  label: tx.trustCancel  },
            { icon: Zap,        label: tx.trustCurrency },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon size={13} className="text-primary/60" />
              {label}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}
