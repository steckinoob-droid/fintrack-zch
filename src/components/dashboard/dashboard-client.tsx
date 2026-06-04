"use client";

import { useDashboard } from "@/lib/hooks/use-dashboard";
import { StatsCards } from "./stats-cards";
import { IncomeExpenseChart } from "./income-expense-chart";
import { RecentTransactions } from "./recent-transactions";
import { BudgetProgressList } from "./budget-progress-list";
import { SavingsGoalsOverview } from "./savings-goals-overview";
import { CategoryBreakdown } from "./category-breakdown";
import { BudgetAlerts } from "./budget-alerts";
import { MonthInsights } from "./month-insights";
import { InsightsPanel } from "./insights-panel";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { StatCardSkeleton, ChartSkeleton, TransactionRowSkeleton } from "@/components/shared/skeleton";

export function DashboardClient() {
  const { data, loading } = useDashboard();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-48 shimmer rounded-lg mb-1" />
          <div className="h-4 w-64 shimmer rounded-lg" />
        </div>
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
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe suas finanças em tempo real
          </p>
        </div>

        {/* Alertas de orçamento — aparecem só quando necessário */}
        <BudgetAlerts budgets={data.budgets} />

        {/* KPI Cards */}
        <StatsCards data={data} />

        {/* Comparativo + Previsão */}
        <MonthInsights monthlyStats={data.monthlyStats} monthExpenses={data.monthExpenses} />

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <IncomeExpenseChart monthlyStats={data.monthlyStats} />
          </div>
          <CategoryBreakdown transactions={data.recentTransactions} />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecentTransactions transactions={data.recentTransactions} />
          <div className="space-y-4">
            <BudgetProgressList budgets={data.budgets} />
            <SavingsGoalsOverview goals={data.goals.slice(0, 3)} />
          </div>
        </div>

        {/* Insights */}
        <InsightsPanel data={data} />
      </div>
    </>
  );
}
