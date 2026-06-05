"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatCompact } from "@/lib/utils/currency";
import { getLast6Months, getMonthRange, formatShortMonth } from "@/lib/utils/date";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { Transaction, SavingsGoal } from "@/lib/types";
import { ChartSkeleton } from "@/components/shared/skeleton";
import { Target, CalendarDays } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils/cn";

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
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [txRes, goalsRes] = await Promise.all([
        supabase.from("transactions").select("*, category:categories(*)")
          .eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("savings_goals").select("*")
          .eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setTransactions(txRes.data ?? []);
      setGoals(goalsRes.data ?? []);
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

  const totalSaved  = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);

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
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <TabsList className="min-w-max w-full sm:w-auto">
            <TabsTrigger value="overview" className="flex-1 sm:flex-none">{tx.overview}</TabsTrigger>
            <TabsTrigger value="expenses" className="flex-1 sm:flex-none">{tx.expensesTab}</TabsTrigger>
            <TabsTrigger value="income" className="flex-1 sm:flex-none">{tx.incomeTab}</TabsTrigger>
            <TabsTrigger value="savings" className="flex-1 sm:flex-none">{tx.savingsTab}</TabsTrigger>
          </TabsList>
        </div>

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
          {/* Summary row */}
          {goals.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground mb-1">{lang === "en" ? "Total saved" : "Total poupado"}</p>
                <p className="font-display font-bold text-lg tabular-nums text-primary">{formatCurrency(totalSaved)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground mb-1">{lang === "en" ? "Total target" : "Meta total"}</p>
                <p className="font-display font-bold text-lg tabular-nums">{formatCurrency(totalTarget)}</p>
              </div>
              <div className="glass-card p-4 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">{lang === "en" ? "Overall progress" : "Progresso geral"}</p>
                <p className="font-display font-bold text-lg tabular-nums text-indigo-400">
                  {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%
                </p>
              </div>
            </div>
          )}

          {/* Goals list */}
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-1">{tx.savingsRate}</h3>
            <p className="text-xs text-muted-foreground mb-5">{tx.savingsRateDesc}</p>

            {goals.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Target size={22} className="text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-foreground">{lang === "en" ? "No savings goals yet" : "Nenhuma meta criada ainda"}</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {lang === "en" ? "Create a goal in the Goals section to track your savings progress here." : "Crie uma meta na seção Metas para acompanhar seu progresso aqui."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {goals.map((goal) => {
                  const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
                  const completed = pct >= 100;
                  const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
                  return (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: goal.color + "20" }}>
                            <Target size={13} style={{ color: goal.color }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground leading-none">{goal.name}</p>
                            {goal.deadline && daysLeft !== null && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <CalendarDays size={10} className="text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">
                                  {daysLeft > 0 ? `${daysLeft} ${lang === "en" ? "days left" : "dias restantes"}` : daysLeft === 0 ? (lang === "en" ? "Due today" : "Vence hoje") : (lang === "en" ? "Overdue" : "Prazo expirado")}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={cn("font-display font-bold text-sm tabular-nums", completed ? "text-emerald-400" : "text-foreground")}>
                          {pct}%
                        </span>
                      </div>
                      <Progress value={pct} className="h-2 mb-1.5"
                        indicatorClassName={cn("transition-all duration-700", completed ? "bg-emerald-500" : "")}
                        style={{ "--progress-color": completed ? "#10b981" : goal.color } as React.CSSProperties}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="tabular-nums" style={{ color: goal.color }}>{formatCurrency(goal.current_amount)}</span>
                        <span className="tabular-nums">{formatCurrency(goal.target_amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-xs text-indigo-300">{tx.savingsTip} <strong>20%</strong> {tx.savingsTip2}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
