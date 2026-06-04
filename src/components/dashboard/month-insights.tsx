"use client";

import { TrendingUp, TrendingDown, Minus, CalendarClock, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { MonthlyStats } from "@/lib/types";
import { getDaysInMonth } from "date-fns";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

interface Props {
  monthlyStats: MonthlyStats[];
  monthExpenses: number;
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

export function MonthInsights({ monthlyStats, monthExpenses }: Props) {
  const { lang } = useLang();
  const tx       = appT[lang].dashboard.comparison;

  const current  = monthlyStats[monthlyStats.length - 1];
  const previous = monthlyStats[monthlyStats.length - 2];
  if (!current || !previous) return null;

  const now         = new Date();
  const dayOfMonth  = now.getDate();
  const daysInMonth = getDaysInMonth(now);
  const dailyAvg    = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
  const forecast    = dailyAvg * daysInMonth;
  const daysLeft    = daysInMonth - dayOfMonth;

  // Forecast color: green if lower than prev, red if higher
  const forecastVsPrev = forecast - (previous.expenses || 0);
  const isPositive     = forecastVsPrev <= 0; // spending less = positive
  const forecastColor  = isPositive ? "text-emerald-400" : "text-red-400";
  const forecastBg     = isPositive ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20";

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
          <span className="text-xs text-muted-foreground">
            {tx.vs} {formatCurrency(previous.income)}
          </span>
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
          <span className="text-xs text-muted-foreground">
            {tx.vs} {formatCurrency(previous.expenses)}
          </span>
        </div>
      </div>

      {/* Forecast — full width, interactive color */}
      <div className={cn("rounded-xl border p-4 space-y-3 sm:col-span-2 transition-colors", forecastBg)}>
        <div className="flex items-center gap-2">
          <CalendarClock size={14} className={forecastColor} />
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{tx.forecastTitle}</p>
          <span className={cn(
            "ml-auto text-xs font-bold px-2 py-0.5 rounded-full",
            isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          )}>
            {isPositive ? "▼ On track" : "▲ Over pace"}
          </span>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={cn("font-display font-bold text-2xl tabular-nums", forecastColor)}>
              {formatCurrency(forecast)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {tx.forecastDesc} {formatCurrency(dailyAvg)}/{lang === "en" ? "day" : "dia"}
            </p>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <div className={cn("flex items-center gap-1 justify-end text-sm font-bold", forecastColor)}>
              {isPositive ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              {isPositive
                ? `${formatCurrency(Math.abs(forecastVsPrev))} ${lang === "en" ? "less" : "a menos"}`
                : `${formatCurrency(Math.abs(forecastVsPrev))} ${lang === "en" ? "more" : "a mais"}`
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === "en" ? "vs last month" : "vs mês passado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {daysLeft} {tx.daysLeft}
            </p>
          </div>
        </div>

        {/* Progress bar showing month completion */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{tx.day} {dayOfMonth} {tx.of} {daysInMonth}</span>
            <span>{Math.round((dayOfMonth / daysInMonth) * 100)}% {lang === "en" ? "of month" : "do mês"}</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/20">
            <div
              className={cn("h-full rounded-full transition-all", isPositive ? "bg-emerald-400" : "bg-red-400")}
              style={{ width: `${Math.round((dayOfMonth / daysInMonth) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
