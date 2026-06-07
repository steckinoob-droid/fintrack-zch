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
        await generateRecurringTransactions(supabase, user.id);

        const now    = new Date();
        const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const currentMonthStart = new Date(target.getFullYear(), target.getMonth(), 1)
          .toISOString().slice(0, 10);
        const currentMonthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0)
          .toISOString().slice(0, 10);

        // Parallel fetch: RPC aggregates + scoped queries replace the former
        // full-table load that loaded every transaction into the browser.
        const [
          totalsResult,
          monthlyStatsResult,
          monthTxResult,
          budgetResult,
          goalResult,
          profileResult,
          recentTxResult,
        ] = await Promise.all([
          // All-time aggregates via DB function — O(1) data transfer regardless of row count
          supabase.rpc("get_all_time_totals", { p_user_id: user.id }),
          // 6-month chart data via DB function — only ~6 rows returned
          supabase.rpc("get_monthly_stats", { p_user_id: user.id }),
          // Current-month transactions for category breakdown + budget calculations
          supabase
            .from("transactions")
            .select("*, category:categories(*)")
            .eq("user_id", user.id)
            .gte("date", currentMonthStart)
            .lte("date", currentMonthEnd)
            .order("date", { ascending: false }),
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
            .from("profiles")
            .select("initial_balance")
            .eq("id", user.id)
            .single(),
          // 8 most-recent transactions (any month) for the activity list
          supabase
            .from("transactions")
            .select("*, category:categories(*)")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .limit(8),
        ]);

        const currentMonthTx: Transaction[]     = monthTxResult.data   ?? [];
        const budgets: Budget[]                 = budgetResult.data     ?? [];
        const goals: SavingsGoal[]              = goalResult.data       ?? [];
        const recentTransactions: Transaction[] = recentTxResult.data   ?? [];
        const initialBalance: number            = profileResult.data?.initial_balance ?? 0;

        // All-time totals come from a single DB aggregate — no JS loops over all rows.
        // If the RPC doesn't exist yet (migration 005 not applied), fall back to 0
        // so the dashboard renders without crashing. Run 005_rpc_functions.sql to fix.
        if (totalsResult.error) {
          console.error("[FinTrack] get_all_time_totals RPC failed — run migration 005_rpc_functions.sql:", totalsResult.error.message);
        }
        const totalsRow = (totalsResult.data as AllTimeTotals[] | null)?.[0];
        const allIncome   = Number(totalsRow?.total_income   ?? 0);
        const allExpenses = Number(totalsRow?.total_expenses ?? 0);
        const allSavings  = Number(totalsRow?.total_savings  ?? 0);
        const totalBalance = initialBalance + allIncome - allExpenses - allSavings;

        // Month-level aggregates (from the already-fetched current-month slice)
        const monthIncome   = currentMonthTx.filter(t => t.type === "income") .reduce((s, t) => s + t.amount, 0);
        const monthExpenses = currentMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const monthSavings  = currentMonthTx.filter(t => t.type === "saving") .reduce((s, t) => s + t.amount, 0);

        // Build 6-month chart stats from the RPC rows (~6 items) instead of
        // filtering all transactions client-side
        const rpcRows = (monthlyStatsResult.data as MonthlyStatRow[] | null) ?? [];
        const months  = getLast6Months();
        const monthlyStats: MonthlyStats[] = months.map((m) => {
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
