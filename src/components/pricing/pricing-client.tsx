"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check, Star, ArrowLeft, Loader2, Shield, RefreshCw, Zap,
  Unlock, CreditCard, UploadCloud, BarChart2, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";
import { PixDialog, type PixPaymentData } from "./pix-dialog";

interface Props {
  currentPlan: string;
  isLoggedIn: boolean;
}

type PayMethod = "card" | "pix";

export function PricingClient({ currentPlan, isLoggedIn }: Props) {
  const { lang } = useLang();
  const tx        = appT[lang].pricing;
  const billingTx = appT[lang].billing;

  const [upgrading,  setUpgrading]  = useState(false);
  const [payMethod,  setPayMethod]  = useState<PayMethod>("card");
  const [pixLoading, setPixLoading] = useState(false);
  const [pixData,    setPixData]    = useState<PixPaymentData | null>(null);
  const [pixOpen,    setPixOpen]    = useState(false);

  async function handleCardUpgrade() {
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

  async function handlePixUpgrade() {
    if (!isLoggedIn) { window.location.href = `/login?next=/pricing`; return; }
    setPixLoading(true);
    setPixOpen(true);
    try {
      const res  = await fetch("/api/billing/pix", { method: "POST" });
      const json = await res.json() as PixPaymentData & { error?: string; detail?: string };
      if (!res.ok || !json.qr_code) {
        setPixOpen(false);
        toast.error(tx.pixDialog.error, json.detail ?? undefined);
        return;
      }
      setPixData(json);
    } catch {
      setPixOpen(false);
      toast.error(tx.pixDialog.error);
    } finally {
      setPixLoading(false);
    }
  }

  const isPro = currentPlan === "pro";

  const unlockCards = [
    { icon: UploadCloud, title: tx.unlock1Title, desc: tx.unlock1Desc },
    { icon: BarChart2,   title: tx.unlock2Title, desc: tx.unlock2Desc },
    { icon: Database,    title: tx.unlock3Title, desc: tx.unlock3Desc },
  ] as const;

  const trustItems = [
    { icon: Shield,    label: tx.trustSecure   },
    { icon: RefreshCw, label: tx.trustCancel   },
    { icon: Database,  label: tx.trustDataSafe },
    { icon: Zap,       label: tx.trustCurrency },
  ] as const;

  return (
    <>
      {/* ── Keyframe animations ─────────────────────────────────────────── */}
      <style>{`
        @keyframes pricing-blob-float {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.7; }
          50%       { transform: translateY(-28px) scale(1.04); opacity: 1; }
        }
        @keyframes pricing-btn-glow {
          0%, 100% { box-shadow: 0 0 22px -4px rgba(16,185,129,0.45), 0 4px 16px -4px rgba(0,0,0,0.3); }
          50%       { box-shadow: 0 0 42px -4px rgba(16,185,129,0.70), 0 4px 16px -4px rgba(0,0,0,0.3); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .pb1 { animation: pricing-blob-float 16s ease-in-out infinite; }
          .pb2 { animation: pricing-blob-float 22s ease-in-out infinite reverse; }
          .pb3 { animation: pricing-blob-float 19s ease-in-out infinite 4s; }
          .pbtn:not(:disabled) { animation: pricing-btn-glow 3s ease-in-out infinite; }
        }
        .pro-card { transition: box-shadow 0.5s ease, border-color 0.5s ease, transform 0.3s ease; }
        .pro-card:hover { box-shadow: 0 0 110px -10px rgba(16,185,129,0.42); border-color: rgba(16,185,129,0.65); transform: translateY(-2px); }
        .unlock-card { transition: transform 0.25s ease, border-color 0.25s ease, background-color 0.25s ease; }
        .unlock-card:hover { transform: translateY(-3px); border-color: rgba(16,185,129,0.30); }
        .trust-badge { transition: opacity 0.2s ease; }
        .trust-badge:hover { opacity: 1 !important; }
      `}</style>

      {/* ── Wrapper ─────────────────────────────────────────────────────── */}
      <div className="relative min-h-screen bg-background text-foreground flex flex-col">

        {/* ── Background decoration ───────────────────────────────────── */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden>
          {/* Main glow — top center */}
          <div className="pb1 absolute left-1/2 -top-56 h-[750px] w-[750px] -translate-x-1/2 rounded-full bg-primary/7 blur-[130px]" />
          {/* Secondary — right mid */}
          <div className="pb2 absolute -right-28 top-[28%] h-[550px] w-[550px] rounded-full bg-emerald-600/5 blur-[110px]" />
          {/* Accent — bottom left */}
          <div className="pb3 absolute -left-36 bottom-[15%] h-[420px] w-[420px] rounded-full bg-sky-900/8 blur-[100px]" />
          {/* Subtle dot grid */}
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Horizontal gradient fade at bottom */}
          <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-border/25 px-5 py-3.5 flex items-center gap-3 bg-background/60 backdrop-blur-md">
          <Link
            href={isLoggedIn ? "/dashboard" : "/"}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            {tx.backToApp}
          </Link>
          <span className="text-border/40 select-none">|</span>
          <span className="font-display font-bold text-primary text-sm tracking-tight">FinTrack</span>
        </header>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center px-4 py-16 sm:py-24 gap-16 sm:gap-20">

          {/* ── Hero ────────────────────────────────────────────────── */}
          <div
            className="text-center space-y-5 max-w-2xl w-full animate-fade-in"
            style={{ animationFillMode: "both" }}
          >
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-[11px] font-bold text-primary tracking-widest uppercase">
              <Star size={9} className="fill-current" />
              Pro · {lang === "pt" ? "R$9,99/mês" : "R$9.99/mo"}
            </div>

            {/* Headline */}
            <h1 className="font-display text-[2.25rem] sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.1] text-foreground">
              {tx.title}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-[1.05rem] text-muted-foreground leading-relaxed max-w-lg mx-auto">
              {tx.subtitle}
            </p>
          </div>

          {/* ── Plan cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full max-w-3xl">

            {/* ── FREE card ─────────────────────────────────────────── */}
            <div
              className="glass-card p-7 sm:p-8 flex flex-col gap-6 animate-slide-up"
              style={{ animationDelay: "0.06s", animationFillMode: "both" }}
            >
              {/* Header */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground/55 uppercase tracking-[0.15em]">
                  {tx.freeName}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[2.6rem] font-bold leading-none text-foreground">
                    {tx.freePrice}
                  </span>
                  <span className="text-sm text-muted-foreground">{tx.perMonth}</span>
                </div>
                <p className="text-sm text-muted-foreground font-medium">{tx.freeDesc}</p>
              </div>

              {/* Features */}
              <div className="flex-1 space-y-2 pt-1">
                <p className="text-[10px] font-bold text-muted-foreground/45 uppercase tracking-[0.12em] mb-3">
                  {tx.freeLimitsLabel}
                </p>
                {(tx.features.freeList as readonly string[]).map((f, i) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm">
                    <span className={cn(
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full mt-px",
                      i < 2
                        ? "bg-primary/14 ring-1 ring-primary/20"
                        : "bg-amber-500/10 ring-1 ring-amber-500/20",
                    )}>
                      <Check size={9} className={i < 2 ? "text-primary/75" : "text-amber-400/90"} />
                    </span>
                    <span className={cn(
                      "leading-snug",
                      i < 2 ? "text-foreground/75" : "text-muted-foreground",
                    )}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                disabled
                className="w-full opacity-55 cursor-default text-sm h-10"
              >
                {!isPro ? tx.currentPlan : tx.ctaFree}
              </Button>
              <p className="text-[11px] text-muted-foreground/40 text-center -mt-1">
                {tx.freeNoCard}
              </p>
            </div>

            {/* ── PRO card ──────────────────────────────────────────── */}
            <div
              className={cn(
                "pro-card relative flex flex-col gap-5 rounded-2xl p-7 sm:p-8",
                "bg-gradient-to-b from-primary/9 via-card/75 to-card",
                "border border-primary/38",
                "shadow-[0_0_60px_-12px_rgba(16,185,129,0.28)]",
                "animate-slide-up",
              )}
              style={{ animationDelay: "0.11s", animationFillMode: "both" }}
            >
              {/* Top accent line */}
              <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-primary/65 to-transparent" />

              {/* Most popular chip */}
              <div className="absolute -top-[15px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-[5px] text-[10px] font-bold text-primary-foreground shadow-[0_4px_16px_-4px_rgba(16,185,129,0.6)] whitespace-nowrap">
                <Star size={8} className="fill-current" />
                {tx.mostPopular}
              </div>

              {/* Header */}
              <div className="space-y-1.5 pt-3">
                <div className="flex items-center gap-1.5">
                  <Star size={10} className="text-primary fill-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.15em]">
                    {tx.proName}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[2.6rem] font-bold leading-none text-foreground">
                    {tx.proPrice}
                  </span>
                  <span className="text-sm text-muted-foreground">{tx.perMonth}</span>
                </div>
                <p className="text-sm font-semibold text-foreground/80">{tx.proDesc}</p>
              </div>

              {/* ── Pro features (unified list) ─────────────────────── */}
              <div className="flex-1 space-y-2.5">
                <p className="text-[9px] font-bold text-primary/50 uppercase tracking-[0.14em] flex items-center gap-1">
                  <Unlock size={7} strokeWidth={2.5} />
                  {tx.proUnlocksLabel}
                </p>
                {(tx.features.proUnlocks as readonly string[]).map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-[13px]">
                    <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-primary/18 mt-px ring-1 ring-primary/25">
                      <Unlock size={7} className="text-primary" strokeWidth={2.5} />
                    </span>
                    <span className="text-foreground/90 leading-snug">{f}</span>
                  </div>
                ))}
              </div>

              {/* ── CTA area ─────────────────────────────────────────── */}
              {isPro ? (
                <Button
                  disabled
                  className="w-full bg-primary/18 text-primary border border-primary/28 gap-2 text-sm h-10"
                >
                  <Star size={12} className="fill-current" />
                  {tx.currentPlan}
                </Button>
              ) : (
                <div className="space-y-3">
                  {/* Payment method toggle — logged-in users only */}
                  {isLoggedIn && (
                    <div className="relative flex rounded-xl border border-border/35 bg-muted/12 p-[3px]">
                      {/* Sliding indicator pill */}
                      <div
                        className="absolute top-[3px] bottom-[3px] rounded-[9px] bg-card/95 border border-border/25 shadow-sm transition-all duration-200 ease-out"
                        style={{
                          left:  payMethod === "card" ? "3px" : "calc(50%)",
                          right: payMethod === "card" ? "calc(50%)" : "3px",
                        }}
                      />
                      <button
                        onClick={() => setPayMethod("card")}
                        className={cn(
                          "relative z-10 flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors duration-150",
                          payMethod === "card" ? "text-foreground" : "text-muted-foreground hover:text-foreground/75",
                        )}
                      >
                        <CreditCard size={11} strokeWidth={2} />
                        {tx.payCard}
                      </button>
                      <button
                        onClick={() => setPayMethod("pix")}
                        className={cn(
                          "relative z-10 flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors duration-150",
                          payMethod === "pix" ? "text-foreground" : "text-muted-foreground hover:text-foreground/75",
                        )}
                      >
                        <Zap size={11} strokeWidth={2} />
                        {tx.payPix}
                      </button>
                    </div>
                  )}

                  {/* Method sub-description */}
                  {isLoggedIn && (
                    <p className="text-center text-[11px] text-muted-foreground/55 leading-relaxed">
                      {payMethod === "card" ? tx.payCardDesc : tx.payPixDesc}
                    </p>
                  )}

                  {/* Main CTA */}
                  {(payMethod === "card" || !isLoggedIn) ? (
                    <Button
                      onClick={handleCardUpgrade}
                      disabled={upgrading}
                      className="pbtn w-full gap-2 font-bold text-sm h-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-colors active:scale-[0.98]"
                    >
                      {upgrading
                        ? <><Loader2 size={14} className="animate-spin" />{billingTx.upgrading}</>
                        : <><Unlock size={14} strokeWidth={2.5} />{isLoggedIn ? tx.upgrade : tx.loginToUpgrade}</>}
                    </Button>
                  ) : (
                    <Button
                      onClick={handlePixUpgrade}
                      disabled={pixLoading}
                      className="pbtn w-full gap-2 font-bold text-sm h-10 bg-primary hover:bg-primary/90 text-primary-foreground transition-colors active:scale-[0.98]"
                    >
                      {pixLoading
                        ? <><Loader2 size={14} className="animate-spin" />{tx.pixDialog.generatingQr}</>
                        : <><Zap size={14} strokeWidth={2.5} />{tx.pixCta}</>}
                    </Button>
                  )}
                </div>
              )}

              {/* Guarantee microcopy */}
              <p className="text-[11px] text-muted-foreground/45 text-center -mt-1 leading-relaxed">
                {tx.guarantee}
              </p>
            </div>
          </div>

          {/* ── "What Pro unlocks in practice" ──────────────────────── */}
          <section
            className="w-full max-w-3xl space-y-6 animate-fade-in"
            style={{ animationDelay: "0.28s", animationFillMode: "both" }}
          >
            <p className="text-center text-[10px] font-bold text-muted-foreground/45 uppercase tracking-[0.18em]">
              {tx.unlocksTitle}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {unlockCards.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="unlock-card glass-card p-5 sm:p-6 flex flex-col gap-3.5"
                >
                  {/* Icon badge */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors duration-200 group-hover:bg-primary/20">
                    <Icon size={18} className="text-primary" strokeWidth={1.75} />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Trust badges ────────────────────────────────────────── */}
          <div
            className="flex flex-wrap justify-center gap-x-7 gap-y-3 animate-fade-in"
            style={{ animationDelay: "0.38s", animationFillMode: "both" }}
          >
            {trustItems.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="trust-badge flex items-center gap-1.5 text-[11px] text-muted-foreground/55 opacity-80"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/8">
                  <Icon size={10} className="text-primary/70" />
                </span>
                {label}
              </span>
            ))}
          </div>

        </main>
      </div>

      {/* ── Pix QR dialog ───────────────────────────────────────────── */}
      <PixDialog
        open={pixOpen}
        onClose={() => { setPixOpen(false); setPixData(null); }}
        data={pixData}
        loading={pixLoading}
        tx={tx.pixDialog}
      />
    </>
  );
}
