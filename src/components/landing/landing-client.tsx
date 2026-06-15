"use client";

import Link from "next/link";
import {
  TrendingUp, BarChart3, Target, PieChart, Shield,
  ArrowRight, CheckCircle, RefreshCw, Zap, AlertTriangle,
  ChevronDown, Lock, Clock, XCircle,
  Star, Check, Upload, Globe,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { AnimatedDashboard } from "./animated-dashboard";
import { ImportMagicHero } from "./import-magic-hero";
import { t } from "@/lib/i18n/landing";
import { useLang } from "@/lib/i18n/context";
import { cn } from "@/lib/utils/cn";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

/* ─── Static (language-independent) data ───────────────────────── */

const FEATURE_ICONS = [Upload, BarChart3, PieChart, Target, RefreshCw, Shield] as const;
const FEATURE_STYLES = [
  { iconColor: "text-cyan-400",    iconBg: "bg-cyan-500/10",    glow: "hover:shadow-cyan-500/10"    },
  { iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10", glow: "hover:shadow-emerald-500/10" },
  { iconColor: "text-indigo-400",  iconBg: "bg-indigo-500/10",  glow: "hover:shadow-indigo-500/10"  },
  { iconColor: "text-amber-400",   iconBg: "bg-amber-500/10",   glow: "hover:shadow-amber-500/10"   },
  { iconColor: "text-yellow-400",  iconBg: "bg-yellow-500/10",  glow: "hover:shadow-yellow-500/10"  },
  { iconColor: "text-rose-400",    iconBg: "bg-rose-500/10",    glow: "hover:shadow-rose-500/10"    },
] as const;

const TRUST_ICONS = [Lock, Shield, Clock, CheckCircle] as const;

const STEP_STYLES = [
  { colorText: "text-emerald-400", colorBorder: "border-emerald-500/20", colorBg: "bg-emerald-500/5" },
  { colorText: "text-indigo-400",  colorBorder: "border-indigo-500/20",  colorBg: "bg-indigo-500/5"  },
  { colorText: "text-amber-400",   colorBorder: "border-amber-500/20",   colorBg: "bg-amber-500/5"   },
] as const;

/* ─── Sub-components ────────────────────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group glass-card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-medium text-foreground select-none">
        {q}
        <ChevronDown size={15} className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="border-t border-border/50 px-5 pb-5 pt-4 text-sm leading-relaxed text-muted-foreground">
        {a}
      </p>
    </details>
  );
}

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/20 p-0.5">
      {(["en", "pt"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all uppercase",
            lang === l
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Globe size={11} />
          {l}
        </button>
      ))}
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────── */

export function LandingClient() {
  const { lang } = useLang();
  const tx = t[lang];

  // Scroll reveal refs
  const painRef   = useScrollReveal();
  const stepsRef  = useScrollReveal();
  const featRef   = useScrollReveal();
  const trustRef  = useScrollReveal();
  const plansRef  = useScrollReveal();
  const faqRef    = useScrollReveal();
  const ctaRef    = useScrollReveal();

  return (
    <div className="min-h-dvh flex flex-col">

      {/* ── Landing-specific animations ──────────────────────────── */}
      <style>{`
        @keyframes landing-cta-glow {
          0%, 100% { box-shadow: 0 0 20px -6px rgba(16,185,129,0.45), 0 4px 20px -6px rgba(0,0,0,0.3); }
          50%       { box-shadow: 0 0 36px -6px rgba(16,185,129,0.70), 0 4px 20px -6px rgba(0,0,0,0.3); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .landing-cta-glow { animation: landing-cta-glow 3s ease-in-out infinite; }
        }
        .landing-pro-card {
          transition: box-shadow 0.4s ease, border-color 0.4s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        @media (hover: hover) {
          .landing-pro-card:hover {
            box-shadow: 0 0 72px -10px rgba(16,185,129,0.35);
            border-color: rgba(16,185,129,0.55);
            transform: translateY(-3px);
          }
          .landing-free-card {
            transition: border-color 0.25s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1);
          }
          .landing-free-card:hover {
            border-color: rgba(255,255,255,0.10);
            transform: translateY(-2px);
          }
          .cta-btn {
            transition: filter 0.2s ease, transform 0.2s cubic-bezier(0.16,1,0.3,1);
          }
          .cta-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
          .cta-btn:active { transform: scale(0.98); }
        }
      `}</style>

      {/* ════ NAVBAR ════ */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 lg:px-6 h-16 flex items-center justify-between gap-3">

          <Logo size="md" />

          <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border/40 bg-muted/20 px-1.5 py-1.5">
            {([
              { href: "#how-it-works", label: tx.nav.howItWorks, icon: Zap,         iconClass: "text-amber-400"  },
              { href: "#features",     label: tx.nav.features,   icon: BarChart3,   iconClass: "text-indigo-400" },
              { href: "#faq",          label: tx.nav.faq,        icon: CheckCircle, iconClass: "text-emerald-400"},
            ] as const).map(({ href, label, icon: Icon, iconClass }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-background/80 hover:text-foreground hover:shadow-sm"
              >
                <Icon size={13} className={iconClass} />
                {label}
              </a>
            ))}
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-background/80 hover:text-foreground hover:shadow-sm"
            >
              <Star size={13} className="text-primary" />
              {tx.nav.pricing}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LangToggle />
            <Link
              href="/login"
              className="hidden sm:block rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {tx.nav.signIn}
            </Link>
            <Link
              href="/register"
              className="cta-btn inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm"
            >
              {tx.nav.getStarted} <ArrowRight size={12} className="sm:hidden" /><ArrowRight size={14} className="hidden sm:inline" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ════ HERO ════ */}
        <section className="relative overflow-hidden px-4 pt-20 pb-24 lg:pt-32 lg:pb-36">

          {/* Aurora background — GPU-only, very subtle */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="aurora-1 absolute left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/5 blur-[80px]" />
            <div className="aurora-2 absolute right-1/4 bottom-0 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-indigo-500/5 blur-[80px]" />
            <div className="aurora-3 absolute left-1/2 top-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/3 blur-[100px]" />
          </div>

          {/* Hero text */}
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary animate-fade-in">
              <Zap size={11} className="fill-current" />
              {tx.hero.badge}
            </div>

            <h1 className="animate-fade-in font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl"
                style={{ animationDelay: "0.05s", animationFillMode: "both" }}>
              {tx.hero.headline1}{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                {tx.hero.headline2}
              </span>
            </h1>

            <p className="animate-fade-in mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
               style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
              {tx.hero.sub1}{" "}
              <span className="font-medium text-foreground">{tx.hero.sub2}</span>
            </p>

            <div className="animate-fade-in mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
                 style={{ animationDelay: "0.15s", animationFillMode: "both" }}>
              <Link
                href="/register"
                className="landing-cta-glow cta-btn inline-flex w-auto items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 sm:px-8 sm:py-3.5 sm:text-base"
              >
                {tx.hero.cta1} <ArrowRight size={15} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex w-auto items-center justify-center gap-2 rounded-xl border border-border bg-card/50 px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-card active:scale-[0.98] sm:px-8 sm:py-3.5 sm:text-base"
              >
                {tx.hero.cta2} <ArrowRight size={14} />
              </Link>
            </div>

            <div className="animate-fade-in mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
                 style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
              {tx.hero.trust.map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-400" />
                  {item}
                </span>
              ))}
            </div>

            <p className="animate-fade-in mt-4 text-xs text-muted-foreground/60"
               style={{ animationDelay: "0.22s", animationFillMode: "both" }}>
              {tx.hero.signInHint}{" "}
              <Link href="/login" className="text-primary/80 hover:text-primary transition-colors font-medium hover:underline underline-offset-2">
                {tx.hero.signInLink}
              </Link>
            </p>
          </div>

          {/* ── Hero visuals: Import Magic (top) + Dashboard preview (below) ── */}
          <div className="animate-fade-in relative mx-auto mt-16 max-w-5xl px-2"
               style={{ animationDelay: "0.28s", animationFillMode: "both" }}>

            {/* Two-column on large screens: animation left, mini stats right */}
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-10 lg:justify-center">

              {/* Import magic animation */}
              <div className="w-full max-w-sm lg:max-w-md">
                <ImportMagicHero />
              </div>

              {/* Dashboard preview — hidden on mobile to avoid clutter */}
              <div className="hidden lg:block w-full max-w-lg relative">
                <AnimatedDashboard />
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
              </div>
            </div>

            {/* Dashboard visible on mobile below */}
            <div className="mt-6 lg:hidden relative">
              <AnimatedDashboard />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
            </div>
          </div>
        </section>

        {/* ════ PAIN POINTS ════ */}
        <section className="border-y border-border/30 bg-muted/5 px-4 py-16">
          <div
            ref={painRef}
            className="reveal mx-auto max-w-3xl space-y-8 text-center"
          >
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tx.pain.badge}</p>
              <h2 className="font-display text-2xl font-bold text-foreground">{tx.pain.heading}</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
              {tx.pain.items.map((pain, i) => (
                <div
                  key={pain}
                  className="reveal flex items-start gap-3 rounded-xl border border-red-500/15 bg-red-500/5 p-4"
                  style={{ transitionDelay: `${i * 60}ms` }}
                  data-revealed={undefined}
                >
                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                  <p className="text-sm text-foreground">{pain}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <Link href="/register" className="font-medium text-primary hover:underline">
                {tx.pain.cta}
              </Link>
            </p>
          </div>
        </section>

        {/* ════ HOW IT WORKS ════ */}
        <section id="how-it-works" className="px-4 py-20 lg:py-28">
          <div ref={stepsRef} className="reveal mx-auto max-w-4xl">
            <div className="mb-14 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tx.steps.badge}</p>
              <h2 className="font-display text-3xl font-bold text-foreground">{tx.steps.heading}</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {tx.steps.items.map((s, i) => (
                <div
                  key={s.n}
                  className={cn(
                    "reveal space-y-3 rounded-2xl border p-6 transition-all",
                    STEP_STYLES[i].colorBorder,
                    STEP_STYLES[i].colorBg
                  )}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <span className={`font-display text-4xl font-extrabold opacity-40 ${STEP_STYLES[i].colorText}`}>{s.n}</span>
                  <h3 className="font-display font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link href="/register" className="landing-cta-glow cta-btn inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 sm:px-8 sm:py-3.5 sm:text-base">
                {tx.steps.cta} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        {/* ════ FEATURES (bento grid) ════ */}
        <section id="features" className="bg-gradient-to-b from-transparent to-card/10 px-4 py-20 lg:py-28">
          <div ref={featRef} className="reveal mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tx.features.badge}</p>
              <h2 className="font-display text-3xl font-bold text-foreground">{tx.features.heading}</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{tx.features.sub}</p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tx.features.items.map((f, i) => {
                const Icon = FEATURE_ICONS[i];
                const style = FEATURE_STYLES[i];
                const isHero = i === 0;

                return (
                  <div
                    key={f.problem}
                    className={cn(
                      "reveal feature-card-hover glass-card group space-y-4 p-6 hover:shadow-lg",
                      isHero && "border-cyan-500/20 bg-cyan-500/[0.03]",
                      style.glow
                    )}
                    style={{ transitionDelay: `${i * 55}ms` }}
                  >
                    <div className={cn(
                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                      style.iconBg
                    )}>
                      <Icon size={20} className={style.iconColor} />
                    </div>
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <AlertTriangle size={10} className="text-amber-400" />
                        {tx.features.problem}: {f.problem}
                      </p>
                      <p className="text-sm font-medium leading-snug text-foreground">✓ {f.solution}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════ TRUST BAR ════ */}
        <section className="border-y border-border/30 px-4 py-12">
          <div ref={trustRef} className="reveal mx-auto max-w-4xl">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {tx.trust.map((text, i) => {
                const Icon = TRUST_ICONS[i];
                return (
                  <div
                    key={text}
                    className="reveal flex flex-col items-center gap-2 text-center"
                    style={{ transitionDelay: `${i * 60}ms` }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 hover:scale-110">
                      <Icon size={18} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════ PLANS ════ */}
        <section className="px-4 py-20 lg:py-28">
          <div ref={plansRef} className="reveal mx-auto max-w-4xl">

            <div className="mb-12 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tx.plans.badge}</p>
              <h2 className="font-display text-3xl font-bold text-foreground">{tx.plans.heading}</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{tx.plans.sub}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">

              {/* Free card */}
              <div className="reveal landing-free-card glass-card p-6 sm:p-8 flex flex-col gap-5"
                   style={{ transitionDelay: "60ms" }}>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground/55 uppercase tracking-[0.15em]">
                    {tx.plans.free.label}
                  </span>
                  <p className="text-xl font-bold text-foreground">{tx.plans.free.price}</p>
                  <p className="text-sm text-muted-foreground">{tx.plans.free.desc}</p>
                </div>
                <ul className="flex-1 space-y-2.5">
                  {(tx.plans.free.features as readonly string[]).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <CheckCircle size={14} className="text-primary/55 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/50 px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-card active:scale-[0.98]"
                >
                  {tx.plans.free.cta}
                </Link>
              </div>

              {/* Pro card */}
              <div className="reveal landing-pro-card relative flex flex-col gap-5 rounded-xl border border-primary/35 bg-gradient-to-b from-primary/9 via-card/75 to-card p-6 sm:p-8 shadow-[0_0_50px_-12px_rgba(16,185,129,0.22)]"
                   style={{ transitionDelay: "110ms" }}>
                <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-primary/55 to-transparent" />

                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Star size={10} className="text-primary fill-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-[0.15em]">
                      {tx.plans.pro.label}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{tx.plans.pro.price}</p>
                  <p className="text-sm font-semibold text-foreground/80">{tx.plans.pro.desc}</p>
                </div>
                <ul className="flex-1 space-y-2.5">
                  {(tx.plans.pro.features as readonly string[]).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
                      <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/20 mt-0.5">
                        <Check size={9} className="text-primary" strokeWidth={2.5} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="landing-cta-glow cta-btn inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  {tx.plans.pro.cta} <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ════ FAQ ════ */}
        <section id="faq" className="border-t border-border/30 bg-muted/5 px-4 py-20 lg:py-28">
          <div ref={faqRef} className="reveal mx-auto max-w-2xl">
            <div className="mb-12 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{tx.faq.badge}</p>
              <h2 className="font-display text-3xl font-bold text-foreground">{tx.faq.heading}</h2>
            </div>
            <div className="space-y-3">
              {tx.faq.items.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        </section>

        {/* ════ FINAL CTA ════ */}
        <section className="px-4 pb-24 pt-4">
          <div ref={ctaRef} className="reveal mx-auto max-w-2xl">
            <div className="glass-card space-y-6 border-primary/10 p-10 text-center lg:p-14">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <TrendingUp size={28} className="text-primary" />
              </div>
              <h2 className="font-display text-3xl font-bold text-foreground">{tx.finalCta.heading}</h2>
              <p className="mx-auto max-w-md text-muted-foreground">{tx.finalCta.sub}</p>
              <Link
                href="/register"
                className="landing-cta-glow cta-btn inline-flex w-auto items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/25 sm:px-8 sm:py-3.5 sm:text-base"
              >
                {tx.finalCta.cta} <ArrowRight size={15} />
              </Link>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                {tx.finalCta.trust.map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle size={11} className="text-emerald-400" /> {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ════ FOOTER ════ */}
      <footer className="border-t border-border/50 px-4 py-8">
        <div className="mx-auto max-w-6xl flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo size="sm" />
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/terms"   className="transition-colors hover:text-foreground">{tx.footer.terms}</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">{tx.footer.privacy}</Link>
            <Link href="/login"   className="transition-colors hover:text-foreground">{tx.footer.signIn}</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} FinTrack · {tx.footer.made}</p>
        </div>
      </footer>
    </div>
  );
}
