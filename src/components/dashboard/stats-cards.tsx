"use client";

import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

interface StatsCardsProps { data: DashboardData }

export function StatsCards({ data }: StatsCardsProps) {
  const { lang } = useLang();
  const tx = appT[lang].dashboard;
  const { totalBalance, monthIncome, monthExpenses, savingsRate } = data;
  const netMonth = monthIncome - monthExpenses;

  const cards = [
    {
      label: tx.totalBalance,
      value: formatCurrency(totalBalance),
      subtext: tx.netWorth,
      icon: Wallet,
      iconBg: "bg-primary/10", iconColor: "text-primary",
      valueColor: totalBalance >= 0 ? "text-foreground" : "text-red-400",
    },
    {
      label: tx.monthIncome,
      value: formatCurrency(monthIncome),
      subtext: tx.incomeInMonth,
      icon: TrendingUp,
      iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400",
      valueColor: "text-emerald-400",
    },
    {
      label: tx.monthExpenses,
      value: formatCurrency(monthExpenses),
      subtext: tx.expensesInMonth,
      icon: TrendingDown,
      iconBg: "bg-red-500/10", iconColor: "text-red-400",
      valueColor: "text-red-400",
    },
    {
      label: tx.savingsRate,
      value: netMonth >= 0 ? formatCurrency(netMonth) : `-${formatCurrency(Math.abs(netMonth))}`,
      subtext: netMonth >= 0
        ? `${Math.max(0, savingsRate)}% ${tx.savedThisMonth}`
        : `${formatCurrency(Math.abs(netMonth))} ${tx.inTheRed}`,
      icon: PiggyBank,
      iconBg: netMonth >= 0 ? "bg-indigo-500/10" : "bg-red-500/10",
      iconColor: netMonth >= 0 ? "text-indigo-400" : "text-red-400",
      valueColor: netMonth >= 0 ? "text-indigo-400" : "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {cards.map((card) => (
        <div key={card.label} className="stat-card group">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
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
