"use client";

import { TrendingUp, TrendingDown, Minus, CalendarClock } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { MonthlyStats } from "@/lib/types";
import { getDaysInMonth, subMonths } from "date-fns";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

interface Props {
  monthlyStats: MonthlyStats[];
  monthExpenses: number;
  monthIncome: number;
}

function DeltaBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0) return null;
  const delta   = ((current - previous) / previous) * 100;
  const up      = delta > 0;
  const neutral = Math.abs(delta) < 1;
  return (
    <div className={cn(
      "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
      neutral ? "bg-muted text-muted-foreground"
        : up   ? "bg-red-500/10 text-red-400"
        :        "bg-emerald-500/10 text-emerald-400"
    )}>
      {neutral ? <Minus size={10} /> : up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {neutral ? label : `${up ? "+" : ""}${delta.toFixed(1)}%`}
    </div>
  );
}

export function MonthInsights({ monthlyStats, monthExpenses, monthIncome }: Props) {
  const { lang } = useLang();
  const tx       = appT[lang].dashboard.comparison;

  const current  = monthlyStats[monthlyStats.length - 1];
  const previous = monthlyStats[monthlyStats.length - 2];
  if (!current || !previous) return null;

  const now            = new Date();
  const dayOfMonth     = now.getDate();
  const daysInCurrent  = getDaysInMonth(now);
  const daysInPrev     = getDaysInMonth(subMonths(now, 1));
  const daysLeft       = daysInCurrent - dayOfMonth;
  const monthPct       = Math.round((dayOfMonth / daysInCurrent) * 100);

  // ─── Core calculation ──────────────────────────────────────────────
  // Daily rate: how much is being spent per day ON AVERAGE this month
  const currentDailyRate  = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;

  // Previous month's daily rate (full month)
  const previousDailyRate = daysInPrev > 0 ? previous.expenses / daysInPrev : 0;

  // Projected total = what you've already spent + remaining days at current rate
  const projectedRemainder = currentDailyRate * daysLeft;
  const forecast           = monthExpenses + projectedRemainder;

  // How much of the previous month we EXPECTED to have spent by this day
  const expectedByNow     = previousDailyRate * dayOfMonth;

  // Pace: are we above or below the expected spend by this day?
  const paceVariance      = monthExpenses - expectedByNow; // positive = spending faster
  const paceVariancePct   = expectedByNow > 0
    ? (paceVariance / expectedByNow) * 100
    : 0;

  // Tolerance of 5% before showing red
  const isOverPace  = paceVariancePct > 5;
  const isUnderPace = paceVariancePct < -5;
  const isOnTrack   = !isOverPace && !isUnderPace;

  const forecastColor = isOverPace  ? "text-red-400"
                      : isUnderPace ? "text-emerald-400"
                      : "text-foreground";

  const forecastBg = isOverPace  ? "bg-red-500/8 border-red-500/20"
                   : isUnderPace ? "bg-emerald-500/8 border-emerald-500/20"
                   : "bg-muted/20 border-border/40";

  const badge = isOverPace
    ? { color: "bg-red-500/15 text-red-400",       icon: <TrendingUp size={10} />,  label: lang === "en" ? "Over pace" : "Acima do ritmo" }
    : isUnderPace
    ? { color: "bg-emerald-500/15 text-emerald-400", icon: <TrendingDown size={10} />, label: lang === "en" ? "Under pace" : "Abaixo do ritmo" }
    : { color: "bg-muted text-muted-foreground",    icon: <Minus size={10} />,         label: lang === "en" ? "On track" : "No ritmo" };

  // What % of forecast is already spent
  const spentPct = forecast > 0 ? Math.round((monthExpenses / forecast) * 100) : 0;

  const insufficient = dayOfMonth < 3;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

      {/* Income comparison */}
      <div className="glass-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{tx.incomeTitle}</p>
        <p className="font-display font-bold text-xl text-emerald-400 tabular-nums">
          {formatCurrency(current.income)}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <DeltaBadge current={current.income} previous={previous.income} label={tx.equal} />
          <span className="text-xs text-muted-foreground">{tx.vs} {formatCurrency(previous.income)}</span>
        </div>
      </div>

      {/* Expense comparison */}
      <div className="glass-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{tx.expenseTitle}</p>
        <p className="font-display font-bold text-xl text-red-400 tabular-nums">
          {formatCurrency(current.expenses)}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <DeltaBadge current={current.expenses} previous={previous.expenses} label={tx.equal} />
          <span className="text-xs text-muted-foreground">{tx.vs} {formatCurrency(previous.expenses)}</span>
        </div>
      </div>

      {/* Forecast — full width */}
      <div className={cn("rounded-xl border p-4 space-y-3 sm:col-span-2 transition-all", forecastBg)}>

        {/* Header */}
        <div className="flex items-center gap-2">
          <CalendarClock size={14} className={cn(forecastColor)} />
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{tx.forecastTitle}</p>
          <span className={cn("ml-auto flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full", badge.color)}>
            {badge.icon} {badge.label}
          </span>
        </div>

        {insufficient ? (
          <p className="text-xs text-muted-foreground">
            {lang === "en"
              ? "Need at least 3 days of data for a reliable forecast."
              : "São necessários pelo menos 3 dias de dados para uma previsão confiável."}
          </p>
        ) : (
          <>
            {/* Main numbers */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {lang === "en" ? "Spent so far" : "Gasto até agora"}
                </p>
                <p className="font-display font-bold text-base tabular-nums text-foreground">
                  {formatCurrency(monthExpenses)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {lang === "en" ? "Projected rest" : "Projetado restante"}
                </p>
                <p className="font-display font-bold text-base tabular-nums text-muted-foreground">
                  {formatCurrency(projectedRemainder)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {lang === "en" ? "Total forecast" : "Previsão total"}
                </p>
                <p className={cn("font-display font-bold text-base tabular-nums", forecastColor)}>
                  {formatCurrency(forecast)}
                </p>
              </div>
            </div>

            {/* Pace detail */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {lang === "en" ? "Daily avg:" : "Média/dia:"}{" "}
                <span className="font-medium text-foreground tabular-nums">{formatCurrency(currentDailyRate)}</span>
                {" "}{lang === "en" ? "vs" : "vs"}{" "}
                <span className="tabular-nums">{formatCurrency(previousDailyRate)}</span>
                {" "}{lang === "en" ? "last month" : "mês passado"}
              </span>
              <span>{daysLeft} {tx.daysLeft}</span>
            </div>

            {/* Dual progress: month elapsed + amount spent */}
            <div className="space-y-2">
              {/* Month progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{lang === "en" ? "Month elapsed" : "Mês decorrido"}</span>
                  <span>{tx.day} {dayOfMonth} {tx.of} {daysInCurrent} ({monthPct}%)</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/20">
                  <div className="h-full rounded-full bg-muted-foreground/50 transition-all"
                    style={{ width: `${monthPct}%` }} />
                </div>
              </div>

              {/* Budget pace: how much of projected total already spent */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{lang === "en" ? "Spending pace" : "Ritmo de gasto"}</span>
                  <span className={cn("font-medium", forecastColor)}>
                    {formatCurrency(monthExpenses)} / {formatCurrency(forecast)} ({spentPct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/20 relative overflow-hidden">
                  {/* Expected pace marker */}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
                    style={{ left: `${monthPct}%` }} />
                  {/* Actual spent */}
                  <div className={cn("h-full rounded-full transition-all",
                    isOverPace ? "bg-red-400" : isUnderPace ? "bg-emerald-400" : "bg-primary")}
                    style={{ width: `${Math.min(100, spentPct)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === "en"
                    ? `White line = expected ${monthPct}% of forecast spent by today`
                    : `Linha branca = esperado gastar ${monthPct}% até hoje`}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
