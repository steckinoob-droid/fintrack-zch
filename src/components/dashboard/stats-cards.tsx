"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Wallet, PieChart } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

interface StatsCardsProps { data: DashboardData }

export function StatsCards({ data }: StatsCardsProps) {
  const { lang } = useLang();
  const tx = appT[lang].dashboard;
  const { monthIncome, monthExpenses, monthSavings, budgets } = data;

  // Month balance = income - expenses (savings go to goals, not "spent")
  const monthBalance = monthIncome - monthExpenses;

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  const budgetPct     = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : null;
  const budgetOver    = budgetPct !== null && budgetPct >= 100;
  const budgetWarn    = budgetPct !== null && budgetPct >= 80 && !budgetOver;

  const budgetIconBg    = budgetOver ? "bg-red-500/10" : budgetWarn ? "bg-amber-500/10" : "bg-indigo-500/10";
  const budgetIconColor = budgetOver ? "text-red-400"  : budgetWarn ? "text-amber-400"  : "text-indigo-400";
  const budgetValColor  = budgetOver ? "text-red-400"  : budgetWarn ? "text-amber-400"  : "text-foreground";

  const cards = [
    {
      label: lang === "en" ? "Month Balance" : "Saldo do Mês",
      value: formatCurrency(monthBalance),
      subtext: lang === "en" ? "income minus expenses" : "receitas menos despesas",
      icon: Wallet,
      iconBg: "bg-primary/10", iconColor: "text-primary",
      valueColor: monthBalance >= 0 ? "text-foreground" : "text-red-400",
      href: "/transactions",
    },
    {
      label: tx.monthIncome,
      value: formatCurrency(monthIncome),
      subtext: tx.incomeInMonth,
      icon: TrendingUp,
      iconBg: "bg-emerald-500/10", iconColor: "text-emerald-400",
      valueColor: "text-emerald-400",
      href: "/transactions",
    },
    {
      label: tx.monthExpenses,
      value: formatCurrency(monthExpenses),
      subtext: tx.expensesInMonth,
      icon: TrendingDown,
      iconBg: "bg-red-500/10", iconColor: "text-red-400",
      valueColor: "text-red-400",
      href: "/transactions",
    },
    {
      label: tx.budgetUsage,
      value: budgetPct !== null ? `${budgetPct}%` : "—",
      subtext: totalBudgeted > 0
        ? `${formatCurrency(totalSpent)} ${lang === "en" ? "of" : "de"} ${formatCurrency(totalBudgeted)}`
        : tx.noBudgetsShort,
      icon: PieChart,
      iconBg: budgetPct === null ? "bg-muted/30" : budgetIconBg,
      iconColor: budgetPct === null ? "text-muted-foreground" : budgetIconColor,
      valueColor: budgetPct === null ? "text-muted-foreground" : budgetValColor,
      href: "/budgets",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="stat-card group transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
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
        </Link>
      ))}
    </div>
  );
}
