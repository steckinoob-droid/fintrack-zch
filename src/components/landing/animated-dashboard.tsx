"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n/context";

/* ── Animated counter hook ───────────────────────────────── */
function useCountUp(target: number, duration = 1400, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

/* ── Sub-components ──────────────────────────────────────── */

function AnimatedBar({ income, expense, month, delay, started }: {
  income: number; expense: number; month: string; delay: number; started: boolean;
}) {
  const [h, setH] = useState(false);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setH(true), delay);
    return () => clearTimeout(t);
  }, [started, delay]);

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div className="flex h-20 w-full items-end justify-center gap-0.5">
        <div
          className="w-2/5 rounded-t-sm bg-emerald-400/70 transition-all duration-700 ease-out"
          style={{ height: h ? `${income}%` : "0%", transitionDelay: `${delay}ms` }}
        />
        <div
          className="w-2/5 rounded-t-sm bg-red-400/60 transition-all duration-700 ease-out"
          style={{ height: h ? `${expense}%` : "0%", transitionDelay: `${delay + 80}ms` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{month}</span>
    </div>
  );
}

function AnimatedProgress({ label, pct, color, delay, started }: {
  label: string; pct: number; color: string; delay: number; started: boolean;
}) {
  const [w, setW] = useState(false);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setW(true), delay);
    return () => clearTimeout(t);
  }, [started, delay]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: w ? `${pct}%` : "0%", backgroundColor: color, transitionDelay: `${delay}ms` }}
        />
      </div>
    </div>
  );
}

function AnimatedTxRow({ title, value, color, delay, started }: {
  title: string; value: string; color: string; delay: number; started: boolean;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [started, delay]);

  return (
    <div className={cn(
      "flex items-center justify-between transition-all duration-400",
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    )}>
      <div className="h-2 w-28 rounded bg-muted/60" />
      <span className={cn("text-xs font-semibold tabular-nums", color)}>{value}</span>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */

export function AnimatedDashboard() {
  const { lang } = useLang();
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Start animation when in viewport
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const balance  = useCountUp(45200,  1600, started);
  const income   = useCountUp(10500,  1400, started);
  const expenses = useCountUp(6830,   1400, started);
  const savings  = useCountUp(35,     1200, started);

  const BARS = [
    { income: 60,  expense: 42, month: "Jan" },
    { income: 75,  expense: 55, month: "Feb" },
    { income: 65,  expense: 70, month: "Mar" },
    { income: 85,  expense: 58, month: "Apr" },
    { income: 90,  expense: 65, month: "May" },
    { income: 100, expense: 70, month: "Jun" },
  ];

  const BUDGETS = lang === "en"
    ? [
        { label: "Food",       pct: 68, color: "#10b981" },
        { label: "Transport",  pct: 82, color: "#f59e0b" },
        { label: "Leisure",    pct: 45, color: "#6366f1" },
      ]
    : [
        { label: "Alimentação", pct: 68, color: "#10b981" },
        { label: "Transporte",  pct: 82, color: "#f59e0b" },
        { label: "Lazer",       pct: 45, color: "#6366f1" },
      ];

  const TRANSACTIONS = lang === "en"
    ? [
        { value: "+R$ 8,500", color: "text-emerald-400" },
        { value: "-R$ 2,200", color: "text-red-400"     },
        { value: "-R$ 487",   color: "text-red-400"     },
      ]
    : [
        { value: "+R$ 8.500", color: "text-emerald-400" },
        { value: "-R$ 2.200", color: "text-red-400"     },
        { value: "-R$ 487",   color: "text-red-400"     },
      ];

  const CARDS = [
    { label: lang === "en" ? "Total Balance"  : "Saldo Total",        value: formatBRL(balance),  sub: "+R$ 3.670",   color: "text-foreground",   dot: "bg-primary"     },
    { label: lang === "en" ? "Income"         : "Receitas",           value: formatBRL(income),   sub: "↑ 12%",       color: "text-emerald-400",  dot: "bg-emerald-500" },
    { label: lang === "en" ? "Expenses"       : "Despesas",           value: formatBRL(expenses), sub: "↓ 5%",        color: "text-red-400",      dot: "bg-red-500"     },
    { label: lang === "en" ? "Savings Rate"   : "Taxa de Poupança",   value: `${savings}%`,       sub: "Target 20% ✓",color: "text-indigo-400",   dot: "bg-indigo-500"  },
  ];

  const chartTitle = lang === "en" ? "Income vs Expenses — 6 months" : "Receitas vs Despesas — 6 meses";
  const recentTitle = lang === "en" ? "Recent Transactions" : "Transações Recentes";
  const budgetTitle = lang === "en" ? "Monthly Budgets" : "Orçamentos do Mês";
  const incomeLabel = lang === "en" ? "Income" : "Receitas";
  const expLabel    = lang === "en" ? "Expenses" : "Despesas";

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-2xl backdrop-blur-sm select-none">

      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border/40 bg-muted/20 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/70" />
          <div className="h-3 w-3 rounded-full bg-amber-500/70" />
          <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
        </div>
        <div className="mx-4 h-5 w-full max-w-xs rounded-md bg-muted/50" />
      </div>

      <div className="space-y-4 p-4">

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CARDS.map((card, i) => (
            <div
              key={card.label}
              className={cn(
                "space-y-1 rounded-xl border border-border/40 bg-muted/20 p-3 transition-all duration-500",
                started ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              )}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${card.dot}`} />
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
              <p className={`font-display text-lg font-bold tabular-nums ${card.color}`}>{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className={cn(
          "rounded-xl border border-border/40 bg-muted/10 p-4 transition-all duration-500",
          started ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        )} style={{ transitionDelay: "350ms" }}>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">{chartTitle}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />{incomeLabel}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400" />{expLabel}
              </span>
            </div>
          </div>
          <div className="flex h-24 items-end justify-between gap-2 px-2">
            {BARS.map((d, i) => (
              <AnimatedBar key={d.month} {...d} delay={400 + i * 80} started={started} />
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

          {/* Recent transactions */}
          <div className={cn(
            "space-y-2.5 rounded-xl border border-border/40 bg-muted/10 p-3 transition-all duration-500",
            started ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          )} style={{ transitionDelay: "500ms" }}>
            <p className="text-xs font-semibold text-foreground">{recentTitle}</p>
            {TRANSACTIONS.map((t, i) => (
              <AnimatedTxRow key={i} title="" value={t.value} color={t.color}
                delay={600 + i * 100} started={started} />
            ))}
          </div>

          {/* Budget progress */}
          <div className={cn(
            "space-y-2.5 rounded-xl border border-border/40 bg-muted/10 p-3 transition-all duration-500",
            started ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          )} style={{ transitionDelay: "550ms" }}>
            <p className="text-xs font-semibold text-foreground">{budgetTitle}</p>
            {BUDGETS.map((b, i) => (
              <AnimatedProgress key={b.label} {...b} delay={650 + i * 120} started={started} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
