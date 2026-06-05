"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardData, Transaction, Budget, SavingsGoal, MonthlyStats } from "@/lib/types";
import { getLast6Months, getMonthRange, formatShortMonth } from "@/lib/utils/date";
import { seedDefaultCategories } from "@/lib/utils/seed-categories";
import { generateRecurringTransactions } from "@/lib/utils/recurring";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Seed categorias padrão se for primeiro acesso
        await seedDefaultCategories(supabase, user.id);

        // Gera transações recorrentes do mês atual se necessário
        await generateRecurringTransactions(supabase, user.id);

        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString().slice(0, 10);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString().slice(0, 10);

        const [txResult, budgetResult, goalResult] = await Promise.all([
          supabase
            .from("transactions")
            .select("*, category:categories(*)")
            .eq("user_id", user.id)
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
        ]);

        const transactions: Transaction[] = txResult.data ?? [];
        const budgets: Budget[] = budgetResult.data ?? [];
        const goals: SavingsGoal[] = goalResult.data ?? [];

        const currentMonthTx = transactions.filter(
          (t) => t.date >= currentMonthStart && t.date <= currentMonthEnd
        );

        const monthIncome = currentMonthTx
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0);
        const monthExpenses = currentMonthTx
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0);
        const monthSavings = currentMonthTx
          .filter((t) => t.type === "saving")
          .reduce((s, t) => s + t.amount, 0);

        const allIncome = transactions
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0);
        const allExpenses = transactions
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0);
        const totalBalance = allIncome - allExpenses;

        const months = getLast6Months();
        const monthlyStats: MonthlyStats[] = months.map((m) => {
          const { start, end } = getMonthRange(m);
          const mTx = transactions.filter((t) => t.date >= start && t.date <= end);
          const income = mTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
          const expenses = mTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
          return { month: formatShortMonth(m), income, expenses, balance: income - expenses };
        });

        const budgetsWithSpent = budgets.map((b) => {
          const spent = currentMonthTx
            .filter((t) => t.type === "expense" && t.category_id === b.category_id)
            .reduce((s, t) => s + t.amount, 0);
          return { ...b, spent };
        });

        setData({
          totalBalance,
          monthIncome,
          monthExpenses,
          monthSavings,
          recentTransactions: transactions.slice(0, 8),
          monthlyStats,
          budgets: budgetsWithSpent,
          goals,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { data, loading, error };
}
