import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp, BarChart3, Target, PieChart, Shield,
  ArrowRight, CheckCircle, RefreshCw, Zap, AlertTriangle,
  ChevronDown, Lock, Smartphone, Clock, XCircle, Lightbulb,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";

/* ─── Metadata ─────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "FinTrack — Stop Guessing Where Your Money Goes",
  description:
    "FinTrack organizes your income, expenses, and savings goals in one visual dashboard. See everything in seconds — no spreadsheets, no confusion, no surprises at the end of the month.",
};

/* ─── Static data ───────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works", icon: Zap,         iconClass: "text-amber-400"  },
  { href: "#features",     label: "Features",     icon: BarChart3,   iconClass: "text-indigo-400" },
  { href: "#faq",          label: "FAQ",           icon: CheckCircle, iconClass: "text-emerald-400"},
] as const;

const TRUST_INLINE = [
  "No credit card required",
  "2-minute setup",
  "Cancel anytime",
] as const;

const MOCK_CARDS = [
  { label: "Total Balance",   value: "R$ 45,200", sub: "+R$ 3,670 this month",      color: "text-foreground",   dot: "bg-primary"     },
  { label: "Income",          value: "R$ 10,500", sub: "↑ 12% vs last month",       color: "text-emerald-400",  dot: "bg-emerald-500" },
  { label: "Expenses",        value: "R$ 6,830",  sub: "↓ 5% vs last month",        color: "text-red-400",      dot: "bg-red-500"     },
  { label: "Savings Rate",    value: "35%",        sub: "Target: 20% ✓",             color: "text-indigo-400",   dot: "bg-indigo-500"  },
] as const;

const MOCK_CHART = [
  { income: 60, exp: 42, month: "Jan" },
  { income: 75, exp: 55, month: "Feb" },
  { income: 65, exp: 70, month: "Mar" },
  { income: 85, exp: 58, month: "Apr" },
  { income: 90, exp: 65, month: "May" },
  { income: 100, exp: 70, month: "Jun" },
] as const;

const MOCK_TRANSACTIONS = [
  { title: "Salary",       value: "+R$ 8,500", color: "text-emerald-400" },
  { title: "Rent",         value: "-R$ 2,200", color: "text-red-400"     },
  { title: "Grocery",      value: "-R$ 487",   color: "text-red-400"     },
] as const;

const MOCK_BUDGETS = [
  { cat: "Food & Dining", pct: 68, color: "bg-primary"     },
  { cat: "Transport",     pct: 82, color: "bg-amber-500"   },
  { cat: "Entertainment", pct: 45, color: "bg-indigo-500"  },
] as const;

const PAINS = [
  "You have no idea how much you actually spent this month",
  "Your spreadsheet got so complex you stopped updating it",
  "By the 20th, the money's gone — and you don't know where",
  "You know you should save more, but you can't see a way",
] as const;

const STEPS = [
  {
    n: "01",
    title: "Create your account in 60 seconds",
    description: "No credit card. Just email and password. You're inside the dashboard in seconds.",
    colorText:   "text-emerald-400",
    colorBorder: "border-emerald-500/20",
    colorBg:     "bg-emerald-500/5",
  },
  {
    n: "02",
    title: "Log your income & expenses",
    description: "Default categories are created automatically. Mark recurring bills once — FinTrack handles every future month.",
    colorText:   "text-indigo-400",
    colorBorder: "border-indigo-500/20",
    colorBg:     "bg-indigo-500/5",
  },
  {
    n: "03",
    title: "See exactly where every real goes",
    description: "Live dashboard with charts, budget alerts and automatic insights. Full financial clarity in one screen.",
    colorText:   "text-amber-400",
    colorBorder: "border-amber-500/20",
    colorBg:     "bg-amber-500/5",
  },
] as const;

const FEATURES = [
  {
    icon:    BarChart3,
    problem: "No idea how much you spent",
    solution:"Real-time dashboard: balance, income, expenses and savings rate at a glance",
    iconColor: "text-emerald-400",
    iconBg:    "bg-emerald-500/10",
  },
  {
    icon:    PieChart,
    problem: "Blowing the budget without noticing",
    solution:"Per-category budgets with alerts when you hit 80% of the limit",
    iconColor: "text-indigo-400",
    iconBg:    "bg-indigo-500/10",
  },
  {
    icon:    Target,
    problem: "Savings goals that never leave the paper",
    solution:"Visual progress tracking with a projected completion date for each goal",
    iconColor: "text-amber-400",
    iconBg:    "bg-amber-500/10",
  },
  {
    icon:    RefreshCw,
    problem: "Forgetting to log fixed monthly bills",
    solution:"Mark any transaction as recurring — it auto-generates every month",
    iconColor: "text-cyan-400",
    iconBg:    "bg-cyan-500/10",
  },
  {
    icon:    Lightbulb,
    problem: "Not knowing if you're doing well or not",
    solution:"Automatic insights: monthly comparisons, spending forecasts and personalized tips",
    iconColor: "text-yellow-400",
    iconBg:    "bg-yellow-500/10",
  },
  {
    icon:    Shield,
    problem: "Fear of putting financial data online",
    solution:"Row-Level Security means only you can ever see your data. Bank-grade encryption",
    iconColor: "text-rose-400",
    iconBg:    "bg-rose-500/10",
  },
] as const;

const TRUST_BAR = [
  { icon: Lock,        text: "Your data is never sold"           },
  { icon: Smartphone,  text: "Works on any device"               },
  { icon: Clock,       text: "Setup in under 2 minutes"          },
  { icon: CheckCircle, text: "No credit card required"           },
] as const;

const FAQS = [
  {
    q: "Is it really free?",
    a: "Yes. The free plan is free forever — no credit card needed. You can use all core features without paying anything.",
  },
  {
    q: "Is my financial data safe?",
    a: "Absolutely. We use Row Level Security — each user can only access their own data. Nothing is ever sold or shared with third parties.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. FinTrack is fully responsive and works great on any screen — phone, tablet or desktop.",
  },
  {
    q: "Do I need to connect my bank account?",
    a: "No. You log transactions manually, which actually builds better financial awareness. There is no bank integration.",
  },
  {
    q: "What if I want to stop using it?",
    a: "You can delete your account at any time from Settings. All your data is permanently erased — no questions asked.",
  },
  {
    q: "Is FinTrack available in English?",
    a: "The interface supports English content. Currency is displayed in BRL (Brazilian Real) by default, but all labels and navigation are available in English.",
  },
] as const;

/* ─── Sub-components ────────────────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group glass-card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-medium text-foreground select-none">
        {q}
        <ChevronDown
          size={15}
          className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <p className="border-t border-border/50 px-5 pb-5 pt-4 text-sm text-muted-foreground leading-relaxed">
        {a}
      </p>
    </details>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">

      {/* ════ NAVBAR ════ */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 lg:px-6 h-16 flex items-center justify-between gap-4">

          <Logo size="md" />

          {/* Nav pill */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl border border-border/40 bg-muted/20 px-1.5 py-1.5">
            {NAV_LINKS.map(({ href, label, icon: Icon, iconClass }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-background/80 hover:text-foreground hover:shadow-sm"
              >
                <Icon size={13} className={iconClass} />
                {label}
              </a>
            ))}
          </nav>

          {/* Auth CTAs */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:block rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Get started free <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ════ HERO ════ */}
        <section className="relative overflow-hidden px-4 pt-20 pb-24 lg:pt-32 lg:pb-36">
          {/* Ambient glows */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/6 blur-3xl" />
            <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary">
              <Zap size={11} className="fill-current" />
              Free forever on the basic plan
            </div>

            {/* Headline */}
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Stop guessing where{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                your money goes
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              FinTrack organizes your income, expenses, and savings goals in one visual dashboard.
              See everything in seconds —{" "}
              <span className="font-medium text-foreground">
                no spreadsheets, no confusion, no end-of-month surprises.
              </span>
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.98] sm:w-auto"
              >
                Create my free account <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/50 px-8 py-4 text-base font-medium text-foreground transition-colors hover:bg-card sm:w-auto"
              >
                I already have an account
              </Link>
            </div>

            {/* Micro-trust */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {TRUST_INLINE.map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-400" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* ── Dashboard mockup ── */}
          <div className="relative mx-auto mt-16 max-w-5xl px-2">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-2xl backdrop-blur-sm">

              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-border/40 bg-muted/20 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/50" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/50" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/50" />
                </div>
                <div className="mx-4 h-5 w-full max-w-xs rounded-md bg-muted/50" />
              </div>

              {/* Content */}
              <div className="space-y-4 p-4">

                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {MOCK_CARDS.map((card) => (
                    <div key={card.label} className="space-y-1 rounded-xl border border-border/40 bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${card.dot}`} />
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                      </div>
                      <p className={`font-display text-lg font-bold ${card.color}`}>{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Bar chart */}
                <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">Income vs Expenses — 6 months</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" /> Income
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-red-400" /> Expenses
                      </span>
                    </div>
                  </div>
                  <div className="flex h-24 items-end justify-between gap-2 px-2">
                    {MOCK_CHART.map((d) => (
                      <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-20 w-full items-end justify-center gap-0.5">
                          <div
                            className="w-2/5 rounded-t-sm bg-emerald-400/60"
                            style={{ height: `${d.income}%` }}
                          />
                          <div
                            className="w-2/5 rounded-t-sm bg-red-400/50"
                            style={{ height: `${d.exp}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{d.month}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom row */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {/* Recent transactions */}
                  <div className="space-y-2.5 rounded-xl border border-border/40 bg-muted/10 p-3">
                    <p className="text-xs font-medium text-foreground">Recent Transactions</p>
                    {MOCK_TRANSACTIONS.map((r) => (
                      <div key={r.title} className="flex items-center justify-between">
                        <div className="h-2 w-28 rounded bg-muted/60" />
                        <span className={`text-xs font-semibold ${r.color}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  {/* Budget progress */}
                  <div className="space-y-2.5 rounded-xl border border-border/40 bg-muted/10 p-3">
                    <p className="text-xs font-medium text-foreground">Monthly Budgets</p>
                    {MOCK_BUDGETS.map((b) => (
                      <div key={b.cat} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{b.cat}</span>
                          <span>{b.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/50">
                          <div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom fade */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-32 rounded-2xl bg-gradient-to-t from-background to-transparent"
            />
          </div>
        </section>

        {/* ════ PAIN POINTS ════ */}
        <section className="border-y border-border/30 bg-muted/5 px-4 py-16">
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                Does this sound familiar?
              </p>
              <h2 className="font-display text-2xl font-bold text-foreground">
                FinTrack was built for you if…
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
              {PAINS.map((pain) => (
                <div
                  key={pain}
                  className="flex items-start gap-3 rounded-xl border border-red-500/15 bg-red-500/5 p-4"
                >
                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                  <p className="text-sm text-foreground">{pain}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              If you checked even one,{" "}
              <Link href="/register" className="font-medium text-primary hover:underline">
                FinTrack fixes it →
              </Link>
            </p>
          </div>
        </section>

        {/* ════ HOW IT WORKS ════ */}
        <section id="how-it-works" className="px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-4xl">
            <div className="mb-14 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                Simple as that
              </p>
              <h2 className="font-display text-3xl font-bold text-foreground">
                From zero to financial clarity in 3 steps
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className={`space-y-3 rounded-2xl border ${s.colorBorder} ${s.colorBg} p-6`}
                >
                  <span className={`font-display text-4xl font-extrabold opacity-40 ${s.colorText}`}>
                    {s.n}
                  </span>
                  <h3 className="font-display font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110"
              >
                Start now — it&apos;s free <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* ════ FEATURES ════ */}
        <section id="features" className="bg-gradient-to-b from-transparent to-card/10 px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                Features
              </p>
              <h2 className="font-display text-3xl font-bold text-foreground">
                Every feature solves a real problem
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                No bloat. Every single feature exists because a real financial pain needed to be solved.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.problem}
                  className="glass-card group space-y-4 p-6 transition-colors hover:border-white/10"
                >
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${f.iconBg}`}
                  >
                    <f.icon size={20} className={f.iconColor} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <AlertTriangle size={10} className="text-amber-400" />
                      Problem: {f.problem}
                    </p>
                    <p className="text-sm font-medium leading-snug text-foreground">
                      ✓ {f.solution}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════ TRUST BAR ════ */}
        <section className="border-y border-border/30 px-4 py-12">
          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              {TRUST_BAR.map(({ icon: Icon, text }) => (
                <div key={text} className="flex flex-col items-center gap-2 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════ FAQ ════ */}
        <section id="faq" className="px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-2xl">
            <div className="mb-12 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                Questions
              </p>
              <h2 className="font-display text-3xl font-bold text-foreground">
                Frequently asked questions
              </h2>
            </div>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ════ FINAL CTA ════ */}
        <section className="px-4 pb-24 pt-4">
          <div className="mx-auto max-w-2xl">
            <div className="glass-card space-y-6 border-primary/10 p-10 text-center lg:p-14">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <TrendingUp size={28} className="text-primary" />
              </div>
              <h2 className="font-display text-3xl font-bold text-foreground">
                You&apos;ve put this off long enough
              </h2>
              <p className="mx-auto max-w-md text-muted-foreground">
                Every month without clarity is money you&apos;ll never recover.
                Takes less than 2 minutes to get started — for free.
              </p>
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.98] sm:w-auto"
              >
                Create my free account <ArrowRight size={16} />
              </Link>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                {["No credit card required", "Free forever", "Your data, always yours"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle size={11} className="text-emerald-400" />
                    {t}
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
            <Link href="/terms"   className="transition-colors hover:text-foreground">Terms of use</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/login"   className="transition-colors hover:text-foreground">Sign in</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} FinTrack · Made in Brazil 🇧🇷
          </p>
        </div>
      </footer>
    </div>
  );
}
