"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardData, Transaction, Budget, SavingsGoal, MonthlyStats, Category } from "@/lib/types";
import { getLast6Months, getMonthRange, formatShortMonth } from "@/lib/utils/date";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { seedDefaultCategories } from "@/lib/utils/seed-categories";
import { useDashboardRefresh } from "@/lib/context/dashboard-refresh";
import { generateRecurringTransactions } from "@/lib/utils/recurring";
import { useLang } from "@/lib/i18n/context";

interface MonthlyStatRow {
  month_start:   string;
  income:        number;
  expenses:      number;
  first_tx_date: string | null;
  last_tx_date:  string | null;
}

export function useDashboard(monthOffset = 0) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const { version }           = useDashboardRefresh();
  const { lang }              = useLang();

  useEffect(() => {
    setLoading(true);
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await seedDefaultCategories(supabase, user.id);

        try {
          await generateRecurringTransactions(supabase, user.id);
        } catch (err) {
          console.error("[dashboard] generateRecurringTransactions threw:", err);
        }

        const now    = new Date();
        const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const currentMonthStart = new Date(target.getFullYear(), target.getMonth(), 1)
          .toISOString().slice(0, 10);
        const currentMonthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0)
          .toISOString().slice(0, 10);

        // All reads go through API routes (service role) to bypass the
        // anon-client stale-JWT issue that makes auth.uid() return NULL in PostgREST.
        type TxListJson   = { transactions: Record<string, unknown>[]; categories: Record<string, unknown>[] };
        type TotalsJson   = { income: number; expense: number; savings: number };
        type BudgetsJson  = { budgets: Budget[]; categories: Category[] };
        type GoalsJson    = { goals: SavingsGoal[] };
        type CatsJson     = { categories: Category[] };

        const emptyTxList:  TxListJson  = { transactions: [], categories: [] };
        const emptyTotals:  TotalsJson  = { income: 0, expense: 0, savings: 0 };
        const emptyBudgets: BudgetsJson = { budgets: [], categories: [] };
        const emptyGoals:   GoalsJson   = { goals: [] };
        const emptyCats:    CatsJson    = { categories: [] };

        const [
          monthlyStatsResult,
          totalsJson,
          budgetsJson,
          goalsJson,
          catsJson,
          monthTxJson,
          recentTxJson,
        ] = await Promise.all([
          // Monthly stats via RPC (SECURITY INVOKER — works when JWT is valid;
          // falls back to API route below if it returns an empty array).
          supabase.rpc("get_monthly_stats", { p_user_id: user.id }),

          // All-time totals — always use the service-role API route so we get
          // the real numbers even when auth.uid() is null in the RPC context.
          fetch("/api/transactions/totals")
            .then(r => r.ok ? r.json() as Promise<TotalsJson> : emptyTotals)
            .catch(() => emptyTotals),

          // Budgets for current month (service role, no embedded join).
          fetch(`/api/budgets/list?month=${currentMonthStart}`)
            .then(r => r.ok ? r.json() as Promise<BudgetsJson> : emptyBudgets)
            .catch(() => emptyBudgets),

          // Savings goals (service role).
          fetch("/api/goals/list")
            .then(r => r.ok ? r.json() as Promise<GoalsJson> : emptyGoals)
            .catch(() => emptyGoals),

          // Categories (service role) — needed for catMap.
          fetch("/api/categories/list")
            .then(r => r.ok ? r.json() as Promise<CatsJson> : emptyCats)
            .catch(() => emptyCats),

          // Current-month transactions (service role).
          fetch(`/api/transactions/list?dateFrom=${currentMonthStart}&dateTo=${currentMonthEnd}&limit=5000`)
            .then(r => r.ok ? r.json() as Promise<TxListJson> : emptyTxList)
            .catch(() => emptyTxList),

          // Recent transactions (service role).
          fetch("/api/transactions/list?limit=8")
            .then(r => r.ok ? r.json() as Promise<TxListJson> : emptyTxList)
            .catch(() => emptyTxList),
        ]);

        const catMap = new Map((catsJson.categories ?? []).map(c => [c.id, c]));
        const attachCat = (t: Record<string, unknown>) => ({
          ...t,
          category: t.category_id ? (catMap.get(t.category_id as string) ?? null) : null,
        });

        const currentMonthTx: Transaction[]     = ((monthTxJson   as TxListJson).transactions ?? []).map(attachCat) as Transaction[];
        const recentTransactions: Transaction[] = ((recentTxJson  as TxListJson).transactions ?? []).map(attachCat) as Transaction[];
        const budgets: Budget[]                 = budgetsJson.budgets  ?? [];
        const goals: SavingsGoal[]              = goalsJson.goals      ?? [];

        // Month-level aggregates
        const monthIncome   = currentMonthTx.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0);
        const monthExpenses = currentMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const monthSavings  = currentMonthTx.filter(t => t.type === "saving") .reduce((s, t) => s + t.amount, 0);

        // All-time totals — straight from the service-role API (always correct).
        const allIncome   = Number(totalsJson.income   ?? 0);
        const allExpenses = Number(totalsJson.expense  ?? 0);
        const allSavings  = Number(totalsJson.savings  ?? 0);
        const totalBalance = allIncome - allExpenses - allSavings;

        // 6-month chart: use RPC rows when they contain data, otherwise fall
        // back to the service-role API.  Empty-array is TRUTHY in JS so we
        // must check .length > 0, not just truthiness.
        const months = getLast6Months();
        let monthlyStats: MonthlyStats[];

        const rpcRows =
          !monthlyStatsResult.error &&
          Array.isArray(monthlyStatsResult.data) &&
          (monthlyStatsResult.data as MonthlyStatRow[]).length > 0
            ? (monthlyStatsResult.data as MonthlyStatRow[])
            : null;

        if (rpcRows) {
          monthlyStats = months.map((m) => {
            const { start } = getMonthRange(m);
            const row      = rpcRows.find(r => r.month_start === start);
            const income   = Number(row?.income   ?? 0);
            const expenses = Number(row?.expenses ?? 0);
            const daysOfData =
              row?.first_tx_date && row?.last_tx_date
                ? differenceInCalendarDays(parseISO(row.last_tx_date), parseISO(row.first_tx_date)) + 1
                : row ? 1 : 0;
            return { month: formatShortMonth(m, lang), income, expenses, balance: income - expenses, daysOfData };
          });
        } else {
          // RPC returned empty (auth.uid() null or no data) — compute from the
          // service-role transactions API route.
          const sixMonthsAgo = months[0];
          const { start: chartStart } = getMonthRange(sixMonthsAgo);
          const chartRes = await fetch(`/api/transactions/list?dateFrom=${encodeURIComponent(chartStart)}&limit=100000`)
            .then(r => r.ok ? r.json() as Promise<{ transactions: Array<{ type: string; amount: number; date: string }> }> : { transactions: [] })
            .catch(() => ({ transactions: [] }));
          const chartTx = chartRes.transactions ?? [];

          monthlyStats = months.map((m) => {
            const { start, end } = getMonthRange(m);
            const slice = chartTx.filter(t => t.date >= start && t.date <= end);
            const income   = slice.filter(t => t.type === "income") .reduce((s, t) => s + Number(t.amount), 0);
            const expenses = slice.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
            const dates = slice.map(t => t.date).sort();
            const daysOfData = dates.length > 1
              ? differenceInCalendarDays(parseISO(dates[dates.length - 1]), parseISO(dates[0])) + 1
              : dates.length;
            return { month: formatShortMonth(m, lang), income, expenses, balance: income - expenses, daysOfData };
          });
        }

        const budgetsWithSpent = budgets.map((b) => {
          const spent = currentMonthTx
            .filter(t => t.type === "expense" && t.category_id === b.category_id)
            .reduce((s, t) => s + t.amount, 0);
          return { ...b, spent };
        });

        setData({
          totalBalance,
          monthIncome,
          monthExpenses,
          monthSavings,
          recentTransactions,
          monthTransactions: currentMonthTx,
          monthlyStats,
          budgets: budgetsWithSpent,
          goals,
          currentMonth: currentMonthStart,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [version, monthOffset, lang]);

  return { data, loading, error };
}
