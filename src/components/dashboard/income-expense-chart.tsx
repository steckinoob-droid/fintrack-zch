"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { MonthlyStats } from "@/lib/types";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { ChartTooltip } from "@/components/shared/chart-tooltip";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  CHART_INCOME, CHART_EXPENSE, CHART_GRID, CHART_CURSOR,
} from "@/lib/utils/chart-colors";

interface Props { monthlyStats: MonthlyStats[] }

export function IncomeExpenseChart({ monthlyStats }: Props) {
  const { lang, fc, fck } = useLang();
  const tx  = appT[lang].dashboard;
  const rTx = appT[lang].reports;
  const reduced = useReducedMotion();

  return (
    <div className="glass-card p-5 h-full">
      <div className="mb-4">
        <h3 className="font-display font-semibold text-foreground text-sm">{tx.incomeVsExpenses}</h3>
        <p className="text-xs text-muted-foreground">{tx.last6Months}</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={monthlyStats}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          barGap={3}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fck}
            width={60}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={fc} balanceLabel={rTx.balance} />}
            cursor={{ fill: CHART_CURSOR }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => (
              <span style={{ color: "hsl(215 16% 75%)", fontSize: 12 }}>{v}</span>
            )}
          />
          <Bar
            dataKey="income"
            name={rTx.incomeLabel}
            fill={CHART_INCOME}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
            opacity={0.9}
            isAnimationActive={!reduced}
            animationDuration={350}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="expenses"
            name={rTx.expenses_label}
            fill={CHART_EXPENSE}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
            opacity={0.9}
            isAnimationActive={!reduced}
            animationDuration={350}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
