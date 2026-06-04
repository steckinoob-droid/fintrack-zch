"use client";

import { TrendingUp, TrendingDown, Minus, CalendarClock } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { MonthlyStats } from "@/lib/types";
import { getDaysInMonth } from "date-fns";

interface Props {
  monthlyStats: MonthlyStats[];
  monthExpenses: number;
}

function DeltaBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const up = delta > 0;
  const neutral = Math.abs(delta) < 1;

  return (
    <div className={cn(
      "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
      neutral ? "bg-muted text-muted-foreground"
        : up ? "bg-red-500/10 text-red-400"
        : "bg-emerald-500/10 text-emerald-400"
    )}>
      {neutral ? <Minus size={10} /> : up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {neutral ? "Igual" : `${up ? "+" : ""}${delta.toFixed(1)}% vs mês passado`}
    </div>
  );
}

export function MonthInsights({ monthlyStats, monthExpenses }: Props) {
  const current  = monthlyStats[monthlyStats.length - 1];
  const previous = monthlyStats[monthlyStats.length - 2];

  if (!current || !previous) return null;

  // Previsão de fechamento
  const now       = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = getDaysInMonth(now);
  const dailyAvg  = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
  const forecast  = dailyAvg * daysInMonth;
  const daysLeft  = daysInMonth - dayOfMonth;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Comparativo receitas */}
      <div className="glass-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receitas — Comparativo</p>
        <p className="font-display font-bold text-xl text-emerald-400 tabular-nums">
          {formatCurrency(current.income)}
        </p>
        <div className="flex items-center gap-2">
          <DeltaBadge current={current.income} previous={previous.income} label="receita" />
          <span className="text-xs text-muted-foreground">
            mês passado: {formatCurrency(previous.income)}
          </span>
        </div>
      </div>

      {/* Comparativo despesas */}
      <div className="glass-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Despesas — Comparativo</p>
        <p className="font-display font-bold text-xl text-red-400 tabular-nums">
          {formatCurrency(current.expenses)}
        </p>
        <div className="flex items-center gap-2">
          <DeltaBadge current={current.expenses} previous={previous.expenses} label="despesa" />
          <span className="text-xs text-muted-foreground">
            mês passado: {formatCurrency(previous.expenses)}
          </span>
        </div>
      </div>

      {/* Previsão do mês */}
      <div className="glass-card p-4 space-y-2 sm:col-span-2">
        <div className="flex items-center gap-2">
          <CalendarClock size={14} className="text-primary" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Previsão de Fechamento</p>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={cn(
              "font-display font-bold text-xl tabular-nums",
              forecast > previous.expenses * 1.1 ? "text-red-400"
                : forecast < previous.expenses * 0.9 ? "text-emerald-400"
                : "text-amber-400"
            )}>
              {formatCurrency(forecast)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              estimativa para o mês inteiro com base na média diária de {formatCurrency(dailyAvg)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-foreground">{daysLeft}d restantes</p>
            <p className="text-xs text-muted-foreground">dia {dayOfMonth} de {daysInMonth}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
