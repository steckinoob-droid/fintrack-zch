"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatCompact } from "@/lib/utils/currency";
import { getLast6Months, getMonthRange, formatShortMonth, formatMonthYear } from "@/lib/utils/date";
import type { Transaction, Category } from "@/lib/types";
import { ChartSkeleton } from "@/components/shared/skeleton";

const COLORS = ["#10b981","#6366f1","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 border border-border/60 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-foreground capitalize">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-medium tabular-nums" style={{ color: p.color }}>
            {typeof p.value === "number" ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReportsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [txRes, catRes] = await Promise.all([
        supabase.from("transactions").select("*, category:categories(*)").order("date", { ascending: false }),
        supabase.from("categories").select("*"),
      ]);
      setTransactions(txRes.data ?? []);
      setCategories(catRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Monthly trend data
  const months = getLast6Months();
  const monthlyData = months.map((m) => {
    const { start, end } = getMonthRange(m);
    const mTx = transactions.filter((t) => t.date >= start && t.date <= end);
    const income = mTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = mTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { month: formatShortMonth(m), income, expenses, balance: income - expenses };
  });

  // Category expense breakdown
  const expenseCatMap = new Map<string, number>();
  transactions.filter((t) => t.type === "expense" && t.category).forEach((t) => {
    const key = t.category!.name;
    expenseCatMap.set(key, (expenseCatMap.get(key) ?? 0) + t.amount);
  });
  const categoryData = Array.from(expenseCatMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Income source breakdown
  const incomeCatMap = new Map<string, number>();
  transactions.filter((t) => t.type === "income" && t.category).forEach((t) => {
    const key = t.category!.name;
    incomeCatMap.set(key, (incomeCatMap.get(key) ?? 0) + t.amount);
  });
  const incomeData = Array.from(incomeCatMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Savings rate
  const savingsData = monthlyData.map((m) => ({
    month: m.month,
    taxa: m.income > 0 ? Math.round(((m.income - m.expenses) / m.income) * 100) : 0,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 shimmer rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5"><ChartSkeleton height={200} /></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Análise detalhada das suas finanças nos últimos 6 meses"
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
          <TabsTrigger value="savings">Poupança</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">Receitas vs Despesas (6 meses)</h3>
            <p className="text-xs text-muted-foreground mb-4">Comparativo mensal de entradas e saídas</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "hsl(215 16% 75%)", fontSize: 12 }}>{v}</span>} />
                <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">Saldo Mensal</h3>
            <p className="text-xs text-muted-foreground mb-4">Resultado líquido por mês</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="balance" name="Saldo" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((d, i) => (
                    <Cell key={i} fill={d.balance >= 0 ? "#10b981" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-sm text-foreground mb-1">Por Categoria</h3>
              <p className="text-xs text-muted-foreground mb-4">Distribuição de despesas</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" nameKey="name">
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "hsl(215 16% 75%)", fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-sm text-foreground mb-1">Ranking de Gastos</h3>
              <p className="text-xs text-muted-foreground mb-4">Categorias por volume</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: "hsl(215 16% 60%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(215 16% 75%)", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="value" name="Total" radius={[0, 4, 4, 0]}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="income" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">Fontes de Receita</h3>
            <p className="text-xs text-muted-foreground mb-4">De onde vem o seu dinheiro</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incomeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="value" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="savings" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">Taxa de Poupança Mensal</h3>
            <p className="text-xs text-muted-foreground mb-4">% da renda que você está economizando</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={savingsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={40} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
                <Line type="monotone" dataKey="taxa" name="Taxa de poupança" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-xs text-indigo-300">
                💡 Especialistas recomendam poupar pelo menos <strong>20% da renda</strong> mensalmente.
                A regra 50-30-20 sugere: 50% para necessidades, 30% para desejos e 20% para poupança.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
