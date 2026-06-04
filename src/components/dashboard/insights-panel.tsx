"use client";

import { useMemo } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, Lightbulb,
  Target, PiggyBank, Flame, Award, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import type { DashboardData } from "@/lib/types";
import { getDaysInMonth } from "date-fns";

interface Insight {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  href?: string;
  priority: number; // menor = mais importante
}

function generateInsights(data: DashboardData): Insight[] {
  const insights: Insight[] = [];
  const { monthIncome, monthExpenses, savingsRate, monthlyStats, budgets, goals } = data;

  const current  = monthlyStats[monthlyStats.length - 1];
  const previous = monthlyStats[monthlyStats.length - 2];

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = getDaysInMonth(now);
  const daysLeft = daysInMonth - dayOfMonth;
  const dailyAvg = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
  const forecast = dailyAvg * daysInMonth;

  // 1. Taxa de poupança
  if (savingsRate >= 20) {
    insights.push({
      id: "savings-great",
      icon: Award,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      title: `Taxa de poupança excelente: ${savingsRate}%`,
      description: "Você está economizando acima dos 20% recomendados. Continue assim para atingir suas metas mais rápido!",
      href: "/reports",
      priority: 5,
    });
  } else if (savingsRate > 0) {
    insights.push({
      id: "savings-low",
      icon: PiggyBank,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
      title: `Taxa de poupança de ${savingsRate}%`,
      description: `Especialistas recomendam 20%. Reduzir ${formatCurrency((0.2 - savingsRate / 100) * monthIncome)} nas despesas te levaria lá.`,
      href: "/budgets",
      priority: 2,
    });
  } else if (monthExpenses > monthIncome && monthIncome > 0) {
    insights.push({
      id: "spending-over",
      icon: AlertTriangle,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      title: "Você está gastando mais do que ganha",
      description: `As despesas superam a renda em ${formatCurrency(monthExpenses - monthIncome)} este mês. Revise seus orçamentos.`,
      href: "/budgets",
      priority: 1,
    });
  }

  // 2. Comparativo despesas vs mês passado
  if (current && previous && previous.expenses > 0) {
    const delta = ((current.expenses - previous.expenses) / previous.expenses) * 100;
    if (delta > 20) {
      insights.push({
        id: "expenses-spike",
        icon: Flame,
        iconColor: "text-red-400",
        iconBg: "bg-red-500/10",
        title: `Gastos ${delta.toFixed(0)}% maiores que o mês passado`,
        description: `Você gastou ${formatCurrency(current.expenses - previous.expenses)} a mais que em ${previous.month}. Verifique as categorias com maior variação.`,
        href: "/reports",
        priority: 2,
      });
    } else if (delta < -10) {
      insights.push({
        id: "expenses-down",
        icon: TrendingDown,
        iconColor: "text-emerald-400",
        iconBg: "bg-emerald-500/10",
        title: `Gastos ${Math.abs(delta).toFixed(0)}% menores que o mês passado`,
        description: `Você economizou ${formatCurrency(previous.expenses - current.expenses)} em comparação ao mês anterior. Ótimo controle!`,
        href: "/reports",
        priority: 5,
      });
    }
  }

  // 3. Previsão de fechamento
  if (forecast > 0 && previous?.expenses > 0) {
    const diff = forecast - previous.expenses;
    if (diff > previous.expenses * 0.15) {
      insights.push({
        id: "forecast-high",
        icon: TrendingUp,
        iconColor: "text-amber-400",
        iconBg: "bg-amber-500/10",
        title: `Previsão: ${formatCurrency(forecast)} até o fim do mês`,
        description: `Na média atual de ${formatCurrency(dailyAvg)}/dia, você vai gastar ${formatCurrency(Math.abs(diff))} a mais que o mês passado.`,
        href: "/transactions",
        priority: 3,
      });
    }
  }

  // 4. Orçamentos estourados
  const overBudgets = budgets.filter((b) => (b.spent ?? 0) >= b.amount);
  if (overBudgets.length > 0) {
    insights.push({
      id: "budgets-over",
      icon: AlertTriangle,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
      title: `${overBudgets.length} orçamento(s) excedido(s)`,
      description: `${overBudgets.map((b) => b.category?.name).join(", ")} ultrapassaram o limite este mês.`,
      href: "/budgets",
      priority: 1,
    });
  }

  // 5. Meta mais próxima de ser concluída
  const activeGoals = goals.filter((g) => g.current_amount < g.target_amount);
  if (activeGoals.length > 0) {
    const closest = activeGoals.reduce((a, b) =>
      (a.current_amount / a.target_amount) > (b.current_amount / b.target_amount) ? a : b
    );
    const pct = Math.round((closest.current_amount / closest.target_amount) * 100);
    const remaining = closest.target_amount - closest.current_amount;
    const monthlySavings = monthIncome - monthExpenses;
    const monthsToGo = monthlySavings > 0 ? Math.ceil(remaining / monthlySavings) : null;

    insights.push({
      id: "goal-closest",
      icon: Target,
      iconColor: "text-indigo-400",
      iconBg: "bg-indigo-500/10",
      title: `Meta "${closest.name}" — ${pct}% concluída`,
      description: monthsToGo
        ? `Faltam ${formatCurrency(remaining)}. No ritmo atual você atinge em ~${monthsToGo} mês${monthsToGo > 1 ? "es" : ""}.`
        : `Faltam ${formatCurrency(remaining)} para atingir essa meta.`,
      href: "/goals",
      priority: 4,
    });
  }

  // 6. Dica de diversificação de renda
  const incomeSources = new Set(data.recentTransactions.filter((t) => t.type === "income").map((t) => t.category_id));
  if (incomeSources.size === 1 && monthIncome > 0) {
    insights.push({
      id: "income-single",
      icon: Lightbulb,
      iconColor: "text-indigo-400",
      iconBg: "bg-indigo-500/10",
      title: "Considere diversificar sua renda",
      description: "Toda sua renda vem de uma única fonte. Freelance, investimentos ou renda passiva aumentam sua segurança financeira.",
      priority: 6,
    });
  }

  return insights.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

interface Props { data: DashboardData }

export function InsightsPanel({ data }: Props) {
  const insights = useMemo(() => generateInsights(data), [data]);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Lightbulb size={14} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm">Insights Financeiros</h3>
            <p className="text-xs text-muted-foreground">Análise automática das suas finanças</p>
          </div>
        </div>
        <Link href="/reports" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Ver relatórios <ArrowRight size={11} />
        </Link>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={cn(
              "flex items-start gap-3 rounded-xl p-3 transition-colors",
              insight.href ? "hover:bg-muted/30 cursor-pointer" : ""
            )}
            onClick={() => insight.href && (window.location.href = insight.href)}
          >
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
