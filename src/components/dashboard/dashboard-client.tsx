"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboard } from "@/lib/hooks/use-dashboard";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { StatsCards } from "./stats-cards";
import { RecentTransactions } from "./recent-transactions";
import { BudgetProgressList } from "./budget-progress-list";
import { SavingsGoalsOverview } from "./savings-goals-overview";
import { BudgetAlerts } from "./budget-alerts";
import { InsightsPanel } from "./insights-panel";
import { MonthInsights } from "./month-insights";
import { HealthScoreCard } from "./health-score-card";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { StatCardSkeleton, ChartSkeleton, TransactionRowSkeleton } from "@/components/shared/skeleton";
import { format, parseISO, addMonths } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

// Recharts (~150-200KB w/ d3) is the heaviest dependency on this route. Load the
// two chart widgets lazily so it lands in a separate async chunk instead of the
// dashboard's first-load JS. ssr:false because the charts render client-only.
const IncomeExpenseChart = dynamic(
  () => import("./income-expense-chart").then((m) => m.IncomeExpenseChart),
  { ssr: false, loading: () => <div className="glass-card p-5"><ChartSkeleton height={220} /></div> },
);
const CategoryBreakdown = dynamic(
  () => import("./category-breakdown").then((m) => m.CategoryBreakdown),
  { ssr: false, loading: () => <div className="glass-card p-5"><ChartSkeleton height={200} /></div> },
);

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

  // `data.goals.slice(0, 3)` was recreated on every render, giving the memoized
  // SavingsGoalsOverview a new array identity each time and defeating React.memo.
  // Derive it once per `data.goals` change so the prop reference stays stable.
  const topGoals = useMemo(() => data?.goals.slice(0, 3) ?? [], [data?.goals]);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthOffset(v => v - 1)}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            aria-label={tx.prevMonth}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight capitalize truncate">
              {monthLabel}
            </h1>
            {isCurrentMonth && (
              <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">
                {tx.currentMonth}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isCurrentMonth && (
              <button
                onClick={() => setMonthOffset(0)}
                className="hidden sm:flex items-center gap-1 text-xs text-primary hover:underline font-medium px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors"
              >
                {tx.today}
              </button>
            )}
            <button
              onClick={() => setMonthOffset(v => Math.min(0, v + 1))}
              disabled={isCurrentMonth}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={tx.nextMonth}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <BudgetAlerts budgets={data.budgets} />
        <StatsCards data={data} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <IncomeExpenseChart monthlyStats={data.monthlyStats} />
          </div>
          <CategoryBreakdown transactions={data.monthTransactions} />
        </div>

        <MonthInsights
          monthlyStats={data.monthlyStats}
          monthExpenses={data.monthExpenses}
          monthIncome={data.monthIncome}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <RecentTransactions transactions={data.recentTransactions} />
            <InsightsPanel data={data} />
          </div>
          <div className="space-y-4">
            <HealthScoreCard data={data} />
            <BudgetProgressList budgets={data.budgets} />
            <SavingsGoalsOverview goals={topGoals} monthSavings={data.monthSavings} />
          </div>
        </div>
      </div>
    </>
  );
}
