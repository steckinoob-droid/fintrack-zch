"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, Flame, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import type { DashboardData } from "@/lib/types";
import { getDaysInMonth } from "date-fns";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

interface Insight {
  id: string; icon: React.ElementType;
  iconColor: string; iconBg: string;
  title: string; description: string;
  href?: string; priority: number;
}

function useInsights(data: DashboardData, lang: "en" | "pt"): Insight[] {
  const tx = appT[lang].dashboard.insights;
  const { monthIncome, monthExpenses, monthlyStats, budgets, goals } = data;
  const current  = monthlyStats[monthlyStats.length - 1];
  const previous = monthlyStats[monthlyStats.length - 2];
  const now      = new Date();
  const dayOfMonth = now.getDate();
  // Need at least 3 days of data for a meaningful forecast
  const dailyAvg = dayOfMonth >= 3 ? monthExpenses / dayOfMonth : 0;
  const forecast = dailyAvg > 0 ? dailyAvg * getDaysInMonth(now) : 0;

  const list: Insight[] = [];

  // Spending vs income alert
  if (monthExpenses > monthIncome && monthIncome > 0) {
    list.push({ id: "spending-over", icon: AlertTriangle, iconColor: "text-red-400", iconBg: "bg-red-500/10",
      title: tx.spendingOver,
      description: `${tx.spendingOverDesc} ${formatCurrency(monthExpenses - monthIncome)}.`,
      href: "/budgets", priority: 1 });
  }

  // Budget usage alert
  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);
  const budgetPct     = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  if (totalBudgeted > 0 && budgetPct >= 80 && budgetPct < 100) {
    list.push({ id: "budget-warn-total", icon: AlertTriangle, iconColor: "text-amber-400", iconBg: "bg-amber-500/10",
      title: lang === "en" ? `${budgetPct}% of monthly budget used` : `${budgetPct}% do orçamento mensal usado`,
      description: lang === "en"
        ? `R$ ${formatCurrency(totalBudgeted - totalSpent)} remaining across all budgets.`
        : `${formatCurrency(totalBudgeted - totalSpent)} restantes em todos os orçamentos.`,
      href: "/budgets", priority: 2 });
  }

  if (current && previous && previous.expenses > 0) {
    const delta = ((current.expenses - previous.expenses) / previous.expenses) * 100;
    if (delta > 20) {
      list.push({ id: "expenses-spike", icon: Flame, iconColor: "text-red-400", iconBg: "bg-red-500/10",
        title: `${delta.toFixed(0)}% ${tx.expensesSpike}`,
        description: `${formatCurrency(current.expenses - previous.expenses)} ${lang === "en" ? "more than" : "a mais que"} ${previous.month}.`,
        href: "/reports", priority: 2 });
    } else if (delta < -10) {
      list.push({ id: "expenses-down", icon: TrendingDown, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10",
        title: `${Math.abs(delta).toFixed(0)}% ${tx.expensesDown}`,
        description: `${formatCurrency(previous.expenses - current.expenses)} ${lang === "en" ? "saved vs last month." : "economizados vs mês passado."}`,
        href: "/reports", priority: 5 });
    }
  }

  if (forecast > 0 && previous?.expenses > 0 && forecast > previous.expenses * 1.15) {
    list.push({ id: "forecast-high", icon: TrendingUp, iconColor: "text-amber-400", iconBg: "bg-amber-500/10",
      title: `${tx.forecastHigh} ${formatCurrency(forecast)} ${tx.forecastSuffix}`,
      description: `${tx.forecastDesc} ${formatCurrency(dailyAvg)}${tx.perDay} ${tx.forecastDesc2} ${formatCurrency(Math.abs(forecast - previous.expenses))} ${tx.forecastDesc3}`,
      href: "/transactions", priority: 3 });
  }

  const overBudgets = budgets.filter(b => (b.spent ?? 0) >= b.amount);
  if (overBudgets.length > 0) {
    list.push({ id: "budgets-over", icon: AlertTriangle, iconColor: "text-red-400", iconBg: "bg-red-500/10",
      title: `${overBudgets.length} ${tx.budgetsOver}`,
      description: `${overBudgets.map(b => b.category?.name).join(", ")} ${tx.budgetsOverDesc}`,
      href: "/budgets", priority: 1 });
  }

  const activeGoals = goals.filter(g => g.current_amount < g.target_amount);
  if (activeGoals.length > 0) {
    const closest = activeGoals.reduce((a, b) =>
      (a.current_amount / a.target_amount) > (b.current_amount / b.target_amount) ? a : b);
    const pct      = Math.round((closest.current_amount / closest.target_amount) * 100);
    const remaining = closest.target_amount - closest.current_amount;
    const monthlySavings = monthIncome - monthExpenses;
    const monthsToGo = monthlySavings > 0 ? Math.ceil(remaining / monthlySavings) : null;
    list.push({ id: "goal-closest", icon: Target, iconColor: "text-indigo-400", iconBg: "bg-indigo-500/10",
      title: `${tx.goalClosest} "${closest.name}" — ${pct}${tx.goalPct}`,
      description: monthsToGo
        ? `${lang === "en" ? "Need" : "Faltam"} ${formatCurrency(remaining)}. ${tx.goalDesc}${monthsToGo} ${tx.goalMonths}`
        : `${lang === "en" ? "Need" : "Faltam"} ${formatCurrency(remaining)} ${tx.goalDescAlt}`,
      href: "/goals", priority: 4 });
  }

  const incomeSources = new Set(data.recentTransactions.filter(t => t.type === "income").map(t => t.category_id));
  if (incomeSources.size === 1 && monthIncome > 0) {
    list.push({ id: "income-single", icon: Lightbulb, iconColor: "text-indigo-400", iconBg: "bg-indigo-500/10",
      title: tx.incomeSingle, description: tx.incomeSingleDesc, priority: 6 });
  }

  return list.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

export function InsightsPanel({ data }: { data: DashboardData }) {
  const { lang } = useLang();
  const tx       = appT[lang].dashboard.insights;
  const insights = useMemo(() => useInsights(data, lang), [data, lang]);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Lightbulb size={14} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm">{tx.title}</h3>
            <p className="text-xs text-muted-foreground">{tx.subtitle}</p>
          </div>
        </div>
        <Link href="/reports" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          {tx.viewReports} <ArrowRight size={11} />
        </Link>
      </div>
      <div className="space-y-2.5">
        {insights.map((insight) => (
          <div key={insight.id}
            className={cn("flex items-start gap-3 rounded-xl p-3 transition-colors", insight.href && "hover:bg-muted/30 cursor-pointer")}
            onClick={() => insight.href && (window.location.href = insight.href)}>
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", insight.iconBg)}>
              <insight.icon size={15} className={insight.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">{insight.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
