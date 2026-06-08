"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check, Star, ArrowLeft, Loader2,
  Shield, RefreshCw, Zap, Unlock, Sparkles, Minus,
} from "lucide-react";
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
      <main className="flex-1 flex flex-col items-center px-4 py-14 sm:py-20 gap-14">

        {/* Hero */}
        <div className="text-center space-y-3 max-w-xl animate-fade-in">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {tx.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">{tx.subtitle}</p>
        </div>

        {/* ── Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-3xl">

          {/* ── Free card ─────────────────────────────────────────────── */}
          <div
            className="glass-card p-7 sm:p-8 flex flex-col gap-6 animate-slide-up"
            style={{ animationDelay: "0.05s", animationFillMode: "both" }}
          >
            {/* Plan info */}
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

            {/* Features */}
            <div className="flex-1 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
                {tx.freeLimitsLabel}
              </p>
              {tx.features.freeList.map((f, i) => (
                <div key={f} className="flex items-center gap-3 text-sm">
                  <span className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                    i < 2 ? "bg-primary/15" : "bg-amber-500/12",
                  )}>
                    <Check size={10} className={i < 2 ? "text-primary/70" : "text-amber-400/80"} />
                  </span>
                  <span className={i < 2 ? "text-foreground/75" : "text-muted-foreground"}>
                    {f}
                  </span>
                </div>
              ))}
            </div>

            <Button variant="outline" disabled className="w-full opacity-60 cursor-default">
              {!isPro ? tx.currentPlan : tx.ctaFree}
            </Button>
          </div>

          {/* ── Pro card ──────────────────────────────────────────────── */}
          <div
            className={cn(
              "relative flex flex-col gap-6 rounded-2xl p-7 sm:p-8",
              "bg-gradient-to-b from-primary/12 via-card/60 to-card/80",
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

              {/* Unlocks section */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest flex items-center gap-1.5">
                  <Unlock size={10} />
                  {tx.proUnlocksLabel}
                </p>
                {tx.features.proUnlocks.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-foreground/90">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <Unlock size={9} className="text-primary" />
                    </span>
                    {f}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-primary/15" />

              {/* Exclusive section */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={10} />
                  {tx.proExclusiveLabel}
                </p>
                {tx.features.proExclusive.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-foreground/90">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <Sparkles size={9} className="text-primary" />
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
                  : <><Unlock size={14} />{isLoggedIn ? tx.upgrade : tx.loginToUpgrade}</>}
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
              {tx.guarantee}
            </p>
          </div>
        </div>

        {/* ── Comparison table ────────────────────────────────────────── */}
        <div
          className="w-full max-w-2xl animate-fade-in"
          style={{ animationDelay: "0.22s", animationFillMode: "both" }}
        >
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest text-center mb-4">
            {tx.compTitle}
          </p>

          <div className="glass-card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-5 py-3 border-b border-border/30 bg-muted/10">
              <span />
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider w-24 text-center">
                {tx.freeName}
              </span>
              <span className="text-[11px] font-semibold text-primary/80 uppercase tracking-wider w-24 text-center">
                {tx.proName}
              </span>
            </div>

            {/* Rows */}
            {tx.compRows.map((row, i) => {
              const [feature, freeVal, proVal] = row as [string, string, string];
              const isDash = freeVal === "—";
              return (
                <div
                  key={feature}
                  className={cn(
                    "grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-5 py-3 text-sm",
                    i % 2 === 1 && "bg-muted/5",
                  )}
                >
                  <span className="text-foreground/75">{feature}</span>
                  <span className={cn(
                    "w-24 text-center text-xs font-medium",
                    isDash ? "text-muted-foreground/40" : "text-amber-400/80",
                  )}>
                    {isDash ? <Minus size={12} className="mx-auto opacity-30" /> : freeVal}
                  </span>
                  <span className="w-24 text-center">
                    {proVal === "Included" || proVal === "Incluído" ? (
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/20 mx-auto">
                        <Check size={9} className="text-primary" />
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-primary">{proVal}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trust row ───────────────────────────────────────────────── */}
        <div
          className="flex flex-wrap justify-center gap-6 sm:gap-10 animate-fade-in"
          style={{ animationDelay: "0.32s", animationFillMode: "both" }}
        >
          {[
            { icon: Shield,    label: tx.trustSecure   },
            { icon: RefreshCw, label: tx.trustCancel   },
            { icon: Zap,       label: tx.trustCurrency },
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
