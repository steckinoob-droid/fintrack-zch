"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboard } from "@/lib/hooks/use-dashboard";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { StatsCards } from "./stats-cards";
import { IncomeExpenseChart } from "./income-expense-chart";
import { RecentTransactions } from "./recent-transactions";
import { BudgetProgressList } from "./budget-progress-list";
import { SavingsGoalsOverview } from "./savings-goals-overview";
import { CategoryBreakdown } from "./category-breakdown";
import { BudgetAlerts } from "./budget-alerts";
import { InsightsPanel } from "./insights-panel";
import { HealthScoreCard } from "./health-score-card";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { StatCardSkeleton, ChartSkeleton, TransactionRowSkeleton } from "@/components/shared/skeleton";
import { format, parseISO, addMonths, isSameMonth } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

export function DashboardClient() {
  const { lang } = useLang();
  const tx = appT[lang].dashboard;
  const [monthOffset, setMonthOffset] = useState(0);
  const { data, loading } = useDashboard(monthOffset);

  const isCurrentMonth = monthOffset === 0;
  const viewedMonth = data?.currentMonth
    ? parseISO(data.currentMonth)
    : addMonths(new Date(), monthOffset);

  const monthLabel = format(viewedMonth, "MMMM yyyy", {
    locale: lang === "pt" ? ptBR : enUS,
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-64 shimmer rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 glass-card p-5"><ChartSkeleton height={220} /></div>
          <div className="glass-card p-5"><ChartSkeleton height={220} /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <TransactionRowSkeleton key={i} />)}
          </div>
          <div className="glass-card p-5"><ChartSkeleton height={200} /></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <OnboardingModal />
      <div className="space-y-6">

        {/* Month navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonthOffset(v => v - 1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold tracking-tight capitalize">{monthLabel}</h1>
            {!isCurrentMonth && (
              <button
                onClick={() => setMonthOffset(0)}
                className="text-xs text-primary hover:underline"
              >
                {lang === "en" ? "Back to current month" : "Voltar para o mês atual"}
              </button>
            )}
          </div>
          <button
            onClick={() => setMonthOffset(v => Math.min(0, v + 1))}
            disabled={isCurrentMonth}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <BudgetAlerts budgets={data.budgets} />
        <StatsCards data={data} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <IncomeExpenseChart monthlyStats={data.monthlyStats} />
          </div>
          <CategoryBreakdown transactions={data.recentTransactions} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <RecentTransactions transactions={data.recentTransactions} />
            <InsightsPanel data={data} />
          </div>
          <div className="space-y-4">
            <HealthScoreCard data={data} />
            <BudgetProgressList budgets={data.budgets} />
            <SavingsGoalsOverview goals={data.goals.slice(0, 3)} />
          </div>
        </div>
      </div>
    </>
  );
}
