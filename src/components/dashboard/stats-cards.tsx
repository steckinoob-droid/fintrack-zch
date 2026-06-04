"use client";

import { TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

interface StatsCardsProps { data: DashboardData }

export function StatsCards({ data }: StatsCardsProps) {
  const { totalBalance, monthIncome, monthExpenses, savingsRate } = data;
  const netMonth = monthIncome - monthExpenses;

  const cards = [
    {
      label: "Saldo Total",
      value: formatCurrency(totalBalance),
      subtext: "patrimônio líquido",
      icon: Wallet,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: totalBalance >= 0 ? "text-foreground" : "text-red-400",
    },
    {
      label: "Receitas do Mês",
      value: formatCurrency(monthIncome),
      subtext: "entradas em junho",
      icon: TrendingUp,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      valueColor: "text-emerald-400",
    },
    {
      label: "Despesas do Mês",
      value: formatCurrency(monthExpenses),
      subtext: "saídas em junho",
      icon: TrendingDown,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-400",
      valueColor: "text-red-400",
    },
    {
      label: "Taxa de Poupança",
      value: `${Math.max(0, savingsRate)}%`,
      subtext: netMonth >= 0
        ? `${formatCurrency(netMonth)} economizados`
        : `${formatCurrency(Math.abs(netMonth))} no vermelho`,
      icon: Percent,
      iconBg: savingsRate >= 20 ? "bg-indigo-500/10" : "bg-amber-500/10",
      iconColor: savingsRate >= 20 ? "text-indigo-400" : "text-amber-400",
      valueColor: savingsRate >= 20 ? "text-indigo-400" : "text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {cards.map((card) => (
        <div key={card.label} className="stat-card group">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {card.label}
            </p>
            <div className={cn("rounded-lg p-2 transition-transform group-hover:scale-110", card.iconBg)}>
              <card.icon size={15} className={card.iconColor} />
            </div>
          </div>
          <p className={cn("font-display text-xl lg:text-2xl font-bold tracking-tight tabular-nums", card.valueColor)}>
            {card.value}
          </p>
          <p className="text-xs text-muted-foreground">{card.subtext}</p>
        </div>
      ))}
    </div>
  );
}
