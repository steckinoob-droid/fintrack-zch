"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatCompact } from "@/lib/utils/currency";
import { getLast6Months, getMonthRange, formatShortMonth } from "@/lib/utils/date";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { Transaction } from "@/lib/types";
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
  const { lang } = useLang();
  const tx = appT[lang].reports;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("transactions").select("*, category:categories(*)").order("date", { ascending: false });
      setTransactions(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const months = getLast6Months();
  const monthlyData = months.map(m => {
    const { start, end } = getMonthRange(m);
    const mTx = transactions.filter(t => t.date >= start && t.date <= end);
    const income   = mTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = mTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { month: formatShortMonth(m), income, expenses, balance: income - expenses };
  });

  const expenseCatMap = new Map<string, number>();
  transactions.filter(t => t.type === "expense" && t.category).forEach(t => {
    expenseCatMap.set(t.category!.name, (expenseCatMap.get(t.category!.name) ?? 0) + t.amount);
  });
  const categoryData = Array.from(expenseCatMap.entries()).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  const incomeCatMap = new Map<string, number>();
  transactions.filter(t => t.type === "income" && t.category).forEach(t => {
    incomeCatMap.set(t.category!.name, (incomeCatMap.get(t.category!.name) ?? 0) + t.amount);
  });
  const incomeData = Array.from(incomeCatMap.entries()).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const savingsData = monthlyData.map(m => ({
    month: m.month,
    [tx.savings_label]: m.income > 0 ? Math.round(((m.income - m.expenses) / m.income) * 100) : 0,
  }));

  const axisStyle = { fill: "hsl(215 16% 60%)", fontSize: 11 };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 shimmer rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card p-5"><ChartSkeleton height={200} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={tx.title} description={tx.description} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{tx.overview}</TabsTrigger>
          <TabsTrigger value="expenses">{tx.expensesTab}</TabsTrigger>
          <TabsTrigger value="income">{tx.incomeTab}</TabsTrigger>
          <TabsTrigger value="savings">{tx.savingsTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">{tx.incomeVsExpenses}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tx.incomeVsExpensesDesc}</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: "hsl(215 16% 75%)", fontSize: 12 }}>{v}</span>} />
                <Bar dataKey="income" name={tx.incomeLabel} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={tx.expenses_label} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">{tx.monthlyBalance}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tx.monthlyBalanceDesc}</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="balance" name={tx.balance} radius={[4, 4, 0, 0]}>
                  {monthlyData.map((d, i) => <Cell key={i} fill={d.balance >= 0 ? "#10b981" : "#ef4444"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-sm text-foreground mb-1">{tx.byCategory}</h3>
              <p className="text-xs text-muted-foreground mb-4">{tx.byCategoryDesc}</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" nameKey="name">
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: "hsl(215 16% 75%)", fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-sm text-foreground mb-1">{tx.ranking}</h3>
              <p className="text-xs text-muted-foreground mb-4">{tx.rankingDesc}</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ ...axisStyle, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="value" name={tx.total} radius={[0, 4, 4, 0]}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="income" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">{tx.incomeSources}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tx.incomeSourcesDesc}</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incomeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatCompact} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="value" name={tx.incomeLabel} fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="savings" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">{tx.savingsRate}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tx.savingsRateDesc}</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={savingsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={40} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
                <Line type="monotone" dataKey={tx.savings_label} stroke="#6366f1" strokeWidth={2.5}
                  dot={{ fill: "#6366f1", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-xs text-indigo-300">{tx.savingsTip} <strong>20%</strong> {tx.savingsTip2}</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
