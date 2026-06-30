"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  getLastNMonths, getMonthsBetween, getMonthRange,
  formatShortMonth, formatShortMonthYear,
} from "@/lib/utils/date";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { Transaction, SavingsGoal, Category } from "@/lib/types";
import { ChartSkeleton } from "@/components/shared/skeleton";
import { Target, CalendarDays, Lock, ArrowRight } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils/cn";
import { usePlan } from "@/lib/hooks/use-plan";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { ChartTooltip } from "@/components/shared/chart-tooltip";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  CHART_INCOME, CHART_EXPENSE, CHART_PALETTE,
  CHART_GRID, CHART_CURSOR, CHART_REFERENCE_LINE,
} from "@/lib/utils/chart-colors";

const COLORS = CHART_PALETTE;

type ReportPeriod = "3m" | "6m" | "12m" | "ytd" | "all" | "custom";

const PERIOD_OPTIONS: { value: ReportPeriod; labelEn: string; labelPt: string }[] = [
  { value: "3m",     labelEn: "3 months",  labelPt: "3 meses"        },
  { value: "6m",     labelEn: "6 months",  labelPt: "6 meses"        },
  { value: "12m",    labelEn: "12 months", labelPt: "12 meses"       },
  { value: "ytd",    labelEn: "This year", labelPt: "Este ano"       },
  { value: "all",    labelEn: "All time",  labelPt: "Todo histórico" },
  { value: "custom", labelEn: "Custom",    labelPt: "Personalizado"  },
];

export function ReportsClient() {
  const { lang, fc, fck } = useLang();
  const tx = appT[lang].reports;
  const plan = usePlan();
  const reduced = useReducedMotion();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals,        setGoals]        = useState<SavingsGoal[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("6m");
  const [upgradeOpen,  setUpgradeOpen]  = useState(false);
  const [customFrom,   setCustomFrom]   = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 7); // YYYY-MM
  });
  const [customTo, setCustomTo] = useState<string>(
    new Date().toISOString().slice(0, 7) // current YYYY-MM
  );

  // Effective period: derive at render-time instead of a side-effect setState.
  // This prevents the intermediate render where plan="free" but reportPeriod="6m"
  // (which occurred between plan resolving and the old clamp effect firing).
  const effectivePeriod: ReportPeriod = plan === "free" ? "3m" : reportPeriod;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      // Fetch transactions + categories via API route (service role bypasses RLS).
      // Goals use browser client — different table, not affected by the JWT issue.
      const [txApiRes, goalsRes] = await Promise.all([
        fetch("/api/transactions/list?limit=100000&order=asc&scope=reports"),
        supabase.from("savings_goals").select("*")
          .eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (!txApiRes.ok) { setLoading(false); return; }
      const json = await txApiRes.json() as { transactions: Transaction[]; categories: Category[]; total?: number };
      const catMap = new Map(json.categories.map(c => [c.id, c]));
      const txsWithCats: Transaction[] = json.transactions.map(t => ({
        ...t,
        category: t.category_id ? catMap.get(t.category_id) : undefined,
      }));
      console.log("[reports] loaded", json.transactions.length, "of", json.total ?? "?", "transactions");
      setTransactions(txsWithCats);
      setGoals(goalsRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Compute months to display based on selected period ───────────────────
  const reportMonths = useMemo(() => {
    if (effectivePeriod === "3m")  return getLastNMonths(3);
    if (effectivePeriod === "12m") return getLastNMonths(12);
    if (effectivePeriod === "ytd") {
      const n = new Date().getMonth() + 1; // Jan = 1, Dec = 12
      return getLastNMonths(Math.max(n, 1));
    }
    if (effectivePeriod === "all") {
      if (!transactions.length) return getLastNMonths(6);
      const oldest = transactions[0]; // already sorted ascending
      return getMonthsBetween(parseISO(oldest.date), new Date());
    }
    if (effectivePeriod === "custom") {
      const from = parseISO(`${customFrom}-01`);
      const to   = parseISO(`${customTo}-01`);
      if (from <= to) return getMonthsBetween(from, to);
      return getLastNMonths(1);
    }
    return getLastNMonths(6);
  }, [effectivePeriod, transactions, customFrom, customTo]);

  // Transactions within the current period window
  const periodTx = useMemo(() => {
    if (!reportMonths.length) return transactions;
    const first = getMonthRange(reportMonths[0]);
    const last  = getMonthRange(reportMonths[reportMonths.length - 1]);
    return transactions.filter(t => t.date >= first.start && t.date <= last.end);
  }, [transactions, reportMonths]);

  // ── Monthly bar data ─────────────────────────────────────────────────────
  // Use "mar/25" labels whenever the report spans multiple calendar years so
  // months like "mar" don't appear twice with different data behind them.
  const spansMultipleYears = useMemo(() => {
    if (reportMonths.length < 2) return false;
    return reportMonths[0].slice(0, 4) !== reportMonths[reportMonths.length - 1].slice(0, 4);
  }, [reportMonths]);

  // ── Single-pass aggregation ──────────────────────────────────────────────
  // Derive the three datasets (monthly bars, expense-by-category, income-by-
  // category) without re-scanning the transactions list once per dataset.
  //
  // Aggregation (numbers + ordering) is computed in `aggregates`; the only
  // language-dependent piece (the monthly bar label) is formatted afterwards in
  // a separate memo so switching idioma never re-runs the heavy aggregation.
  //
  // Identical-output guarantees vs. the previous three independent memos:
  //  • Monthly buckets are seeded from `reportMonths` in order, so months with
  //    no movement still appear (zeroed) in the same position. Income/expense
  //    are summed by scanning `transactions` once and routing each tx into its
  //    month bucket via a date→month Map (same month-range boundaries as the
  //    old per-month `getMonthRange` filter).
  //  • categoryData / incomeData scan `periodTx` once each, group by category
  //    name, then `.sort((a,b) => b.value - a.value)` — categoryData keeps the
  //    `.slice(0, 8)`, incomeData keeps no slice. Same filters (expense/income
  //    AND has category) as before.
  const aggregates = useMemo(() => {
    // Monthly buckets, seeded in display order so empty months stay visible.
    const monthBuckets = new Map<string, { income: number; expenses: number }>();
    for (const m of reportMonths) monthBuckets.set(m, { income: 0, expenses: 0 });

    // Map each calendar month boundary to its reportMonths key for O(1) routing.
    const ranges = reportMonths.map(m => ({ m, ...getMonthRange(m) }));
    for (const t of transactions) {
      // Find the bucket whose [start, end] window contains this tx. Ranges are
      // non-overlapping; a tx outside every window is ignored (same as the old
      // per-month filter, which only matched dates within that month's range).
      for (const r of ranges) {
        if (t.date >= r.start && t.date <= r.end) {
          const b = monthBuckets.get(r.m)!;
          if (t.type === "income") b.income += t.amount;
          else if (t.type === "expense") b.expenses += t.amount;
          break;
        }
      }
    }

    // Category buckets over the period window (single pass over periodTx).
    const expenseByCat = new Map<string, number>();
    const incomeByCat  = new Map<string, number>();
    for (const t of periodTx) {
      if (!t.category) continue;
      if (t.type === "expense") {
        expenseByCat.set(t.category.name, (expenseByCat.get(t.category.name) ?? 0) + t.amount);
      } else if (t.type === "income") {
        incomeByCat.set(t.category.name, (incomeByCat.get(t.category.name) ?? 0) + t.amount);
      }
    }

    const monthly = reportMonths.map(m => {
      const b = monthBuckets.get(m)!;
      return { month: m, income: b.income, expenses: b.expenses, balance: b.income - b.expenses };
    });

    const categoryData = Array.from(expenseByCat.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);

    const incomeData = Array.from(incomeByCat.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { monthly, categoryData, incomeData };
  }, [reportMonths, transactions, periodTx]);

  // Apply the language-dependent month label as a cheap post-step. `month` in
  // `aggregates.monthly` is the raw YYYY-MM key; format it for display here.
  const monthlyData = useMemo(
    () => aggregates.monthly.map(d => ({
      ...d,
      month: spansMultipleYears ? formatShortMonthYear(d.month, lang) : formatShortMonth(d.month, lang),
    })),
    [aggregates, spansMultipleYears, lang],
  );

  const categoryData = aggregates.categoryData;
  const incomeData   = aggregates.incomeData;

  // True only when at least one month in the window has movement. When false the
  // Overview charts render an empty-state instead of blank axes (consistent with
  // the Expenses / Income tabs), so a period with no data never looks broken.
  const hasOverviewData = useMemo(
    () => aggregates.monthly.some(d => d.income !== 0 || d.expenses !== 0),
    [aggregates],
  );

  const totalSaved  = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);

  const axisStyle  = { fill: "hsl(215 16% 60%)", fontSize: 11 };
  const yAxisWidth = 48;

  const periodLabel = PERIOD_OPTIONS.find(p => p.value === effectivePeriod)!;
  const periodText  = effectivePeriod === "custom"
    ? (lang === "en" ? `${customFrom} → ${customTo}` : `${customFrom} → ${customTo}`)
    : (lang === "en" ? periodLabel.labelEn : periodLabel.labelPt);
  const dynamicDesc = lang === "en"
    ? `Detailed analysis · ${periodText}`
    : `Análise detalhada · ${periodText}`;

  if (loading || plan === null) {
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
      <PageHeader title={tx.title} description={dynamicDesc} />

      {/* ── Free plan gate banner ─────────────────────────────────────── */}
      {plan === "free" && (
        <div className="flex flex-col items-start gap-2 px-4 py-3 rounded-xl bg-primary/8 border border-primary/20 -mt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2.5">
            <Lock size={14} className="text-primary shrink-0" />
            <p className="text-xs text-foreground/80">{tx.gate.banner}</p>
          </div>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
          >
            {tx.gate.bannerCta} <ArrowRight size={10} />
          </button>
        </div>
      )}

      {/* ── Period selector ───────────────────────────────────────────── */}
      <div className="space-y-2 -mt-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {PERIOD_OPTIONS.map(p => {
            const locked = plan === "free" && p.value !== "3m";
            return (
              <button
                key={p.value}
                onClick={() => {
                  if (locked) { setUpgradeOpen(true); return; }
                  setReportPeriod(p.value);
                }}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
                  effectivePeriod === p.value
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : locked
                    ? "bg-muted/30 text-muted-foreground/50 cursor-pointer"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {lang === "en" ? p.labelEn : p.labelPt}
                {locked && <Lock size={9} className="opacity-75" />}
              </button>
            );
          })}
        </div>

        {/* Custom date range pickers */}
        {effectivePeriod === "custom" && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/40 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{lang === "en" ? "From" : "De"}</span>
              <input
                type="month"
                value={customFrom}
                max={customTo}
                onChange={e => setCustomFrom(e.target.value)}
                className="h-7 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{lang === "en" ? "to" : "até"}</span>
              <input
                type="month"
                value={customTo}
                min={customFrom}
                max={new Date().toISOString().slice(0, 7)}
                onChange={e => setCustomTo(e.target.value)}
                className="h-7 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              · {reportMonths.length} {lang === "en" ? "months" : "meses"}
            </span>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="overview">{tx.overview}</TabsTrigger>
            <TabsTrigger value="expenses">{tx.expensesTab}</TabsTrigger>
            <TabsTrigger value="income">{tx.incomeTab}</TabsTrigger>
            <TabsTrigger value="savings">{tx.savingsTab}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-0.5">{tx.incomeVsExpenses}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tx.incomeVsExpensesDesc} · {periodText}</p>
            {!hasOverviewData ? (
              <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
                {lang === "en" ? "No transactions in this period" : "Sem transações neste período"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={fck} width={yAxisWidth} />
                  <Tooltip content={<ChartTooltip valueFormatter={fc} balanceLabel={tx.balance} />} cursor={{ fill: CHART_CURSOR }} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: "hsl(215 16% 75%)", fontSize: 12 }}>{v}</span>} />
                  <Bar dataKey="income"   name={tx.incomeLabel}     fill={CHART_INCOME}  radius={[4, 4, 0, 0]} isAnimationActive={!reduced} animationDuration={350} animationEasing="ease-out" />
                  <Bar dataKey="expenses" name={tx.expenses_label}  fill={CHART_EXPENSE} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} animationDuration={350} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-0.5">{tx.monthlyBalance}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tx.monthlyBalanceDesc}</p>
            {!hasOverviewData ? (
              <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
                {lang === "en" ? "No transactions in this period" : "Sem transações neste período"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={fck} width={yAxisWidth} />
                  <Tooltip content={<ChartTooltip valueFormatter={fc} />} cursor={{ fill: CHART_CURSOR }} />
                  <ReferenceLine y={0} stroke={CHART_REFERENCE_LINE} strokeWidth={1.5} strokeDasharray="4 3" />
                  <Bar dataKey="balance" name={tx.balance} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} animationDuration={350} animationEasing="ease-out">
                    {monthlyData.map((d, i) => <Cell key={i} fill={d.balance >= 0 ? CHART_INCOME : CHART_EXPENSE} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-sm text-foreground mb-0.5">{tx.byCategory}</h3>
              <p className="text-xs text-muted-foreground mb-4">{tx.byCategoryDesc} · {periodText}</p>
              {categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                  {lang === "en" ? "No expense data for this period" : "Sem despesas neste período"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" nameKey="name" isAnimationActive={!reduced} animationDuration={350} animationEasing="ease-out">
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueFormatter={fc} />} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: "hsl(215 16% 75%)", fontSize: 11 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-sm text-foreground mb-0.5">{tx.ranking}</h3>
              <p className="text-xs text-muted-foreground mb-4">{tx.rankingDesc} · {periodText}</p>
              {categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                  {lang === "en" ? "No expense data for this period" : "Sem despesas neste período"}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ ...axisStyle, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fck} />
                    <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<ChartTooltip valueFormatter={fc} />} cursor={{ fill: CHART_CURSOR }} />
                    <Bar dataKey="value" name={tx.total} radius={[0, 4, 4, 0]} isAnimationActive={!reduced} animationDuration={350} animationEasing="ease-out">
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="income" className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-0.5">{tx.incomeSources}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tx.incomeSourcesDesc} · {periodText}</p>
            {incomeData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                {lang === "en" ? "No income data for this period" : "Sem receitas neste período"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={incomeData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={fck} width={yAxisWidth} />
                  <Tooltip content={<ChartTooltip valueFormatter={fc} />} cursor={{ fill: CHART_CURSOR }} />
                  <Bar dataKey="value" name={tx.incomeLabel} fill={CHART_INCOME} radius={[4, 4, 0, 0]} isAnimationActive={!reduced} animationDuration={350} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="savings" className="space-y-4">
          {goals.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground mb-1">{lang === "en" ? "Total saved" : "Total poupado"}</p>
                <p className="font-display font-bold text-lg tabular-nums text-primary">{fc(totalSaved)}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground mb-1">{lang === "en" ? "Total target" : "Meta total"}</p>
                <p className="font-display font-bold text-lg tabular-nums">{fc(totalTarget)}</p>
              </div>
              <div className="glass-card p-4 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground mb-1">{lang === "en" ? "Overall progress" : "Progresso geral"}</p>
                <p className="font-display font-bold text-lg tabular-nums text-indigo-400">
                  {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%
                </p>
              </div>
            </div>
          )}

          <div className="glass-card p-5">
            <h3 className="font-display font-semibold text-sm text-foreground mb-0.5">{tx.savingsRate}</h3>
            <p className="text-xs text-muted-foreground mb-5">{tx.savingsRateDesc}</p>

            {goals.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Target size={22} className="text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {lang === "en" ? "No savings goals yet" : "Nenhuma meta criada ainda"}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {lang === "en"
                    ? "Create a goal in the Goals section to track your savings progress here."
                    : "Crie uma meta na seção Metas para acompanhar seu progresso aqui."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {goals.map((goal) => {
                  const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
                  const completed  = pct >= 100;
                  const daysLeft   = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
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
                                  {daysLeft > 0
                                    ? `${daysLeft} ${lang === "en" ? "days left" : "dias restantes"}`
                                    : daysLeft === 0
                                    ? (lang === "en" ? "Due today" : "Vence hoje")
                                    : (lang === "en" ? "Overdue" : "Prazo expirado")}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={cn("font-display font-bold text-sm tabular-nums", completed ? "text-emerald-400" : "text-foreground")}>
                          {pct}%
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-2 mb-1.5"
                        indicatorClassName={cn("transition-all duration-700", completed ? "bg-emerald-500" : "")}
                        style={{ "--progress-color": completed ? "#10b981" : goal.color } as React.CSSProperties}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="tabular-nums" style={{ color: goal.color }}>{fc(goal.current_amount)}</span>
                        <span className="tabular-nums">{fc(goal.target_amount)}</span>
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

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title={tx.gate.modalTitle}
        description={tx.gate.modalDesc}
        cta={tx.gate.modalCta}
        highlightBenefit={1}
      />
    </div>
  );
}
