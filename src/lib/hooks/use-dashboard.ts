"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardData, Transaction, Budget, SavingsGoal, MonthlyStats } from "@/lib/types";
import { getLast6Months, getMonthRange, formatShortMonth } from "@/lib/utils/date";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { seedDefaultCategories } from "@/lib/utils/seed-categories";
import { useDashboardRefresh } from "@/lib/context/dashboard-refresh";
import { generateRecurringTransactions } from "@/lib/utils/recurring";
import { useLang } from "@/lib/i18n/context";

interface AllTimeTotals {
  total_income:   number;
  total_expenses: number;
  total_savings:  number;
}

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

        // Guard: generateRecurringTransactions can throw on malformed parent
        // dates (date-fns throws on Invalid Date passed to format()).
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

        // Parallel fetch: RPCs + scoped queries.
        // Transaction SELECTs go through the API route (service role) to bypass
        // the anon-client JWT issue that makes auth.uid() return NULL in PostgREST.
        type TxListJson = { transactions: Record<string, unknown>[]; categories: Record<string, unknown>[] };
        const emptyTxList: TxListJson = { transactions: [], categories: [] };

        const [
          totalsResult,
          monthlyStatsResult,
          budgetResult,
          goalResult,
          catResult,
          monthTxJson,
          recentTxJson,
        ] = await Promise.all([
          supabase.rpc("get_all_time_totals", { p_user_id: user.id }),
          supabase.rpc("get_monthly_stats", { p_user_id: user.id }),
          supabase
            .from("budgets")
            .select("*, category:categories(*)")
            .eq("user_id", user.id)
            .eq("month", currentMonthStart),
          supabase
            .from("savings_goals")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("categories")
            .select("*")
            .eq("user_id", user.id),
          fetch(`/api/transactions/list?dateFrom=${currentMonthStart}&dateTo=${currentMonthEnd}&limit=5000`)
            .then(r => r.ok ? r.json() as Promise<TxListJson> : emptyTxList)
            .catch(() => emptyTxList),
          fetch(`/api/transactions/list?limit=8`)
            .then(r => r.ok ? r.json() as Promise<TxListJson> : emptyTxList)
            .catch(() => emptyTxList),
        ]);

        const catMap = new Map((catResult.data ?? []).map(c => [c.id, c]));
        const attachCat = (t: Record<string, unknown>) => ({
          ...t,
          category: t.category_id ? (catMap.get(t.category_id as string) ?? null) : null,
        });

        const currentMonthTx: Transaction[]     = ((monthTxJson  as TxListJson).transactions ?? []).map(attachCat) as Transaction[];
        const budgets: Budget[]                 = budgetResult.data ?? [];
        const goals: SavingsGoal[]              = goalResult.data   ?? [];
        const recentTransactions: Transaction[] = ((recentTxJson as TxListJson).transactions ?? []).map(attachCat) as Transaction[];

        // Month-level aggregates
        const monthIncome   = currentMonthTx.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0);
        const monthExpenses = currentMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const monthSavings  = currentMonthTx.filter(t => t.type === "saving") .reduce((s, t) => s + t.amount, 0);

        // All-time totals — use RPC when available, otherwise fall back to a
        // direct query so the dashboard works before migration 005 is applied.
        let allIncome = 0, allExpenses = 0, allSavings = 0;
        if (!totalsResult.error && totalsResult.data) {
          const row = (totalsResult.data as AllTimeTotals[])[0];
          allIncome   = Number(row?.total_income   ?? 0);
          allExpenses = Number(row?.total_expenses ?? 0);
          allSavings  = Number(row?.total_savings  ?? 0);
        } else {
          // RPC not available — load all transactions for totals via API route.
          const fallbackRes = await fetch("/api/transactions/list?limit=100000")
            .then(r => r.ok ? r.json() as Promise<{ transactions: Array<{ type: string; amount: number }> }> : { transactions: [] })
            .catch(() => ({ transactions: [] }));
          for (const t of fallbackRes.transactions ?? []) {
            if (t.type === "income")  allIncome   += Number(t.amount);
            if (t.type === "expense") allExpenses += Number(t.amount);
            if (t.type === "saving")  allSavings  += Number(t.amount);
          }
        }
        const totalBalance = allIncome - allExpenses - allSavings;

        // 6-month chart — use RPC rows when available, otherwise compute from a
        // direct query so the chart renders before migration 005 is applied.
        const months = getLast6Months();
        let monthlyStats: MonthlyStats[];

        const rpcRows = (!monthlyStatsResult.error && monthlyStatsResult.data)
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
          // RPC not available — load 6-month window of transactions via API route.
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
