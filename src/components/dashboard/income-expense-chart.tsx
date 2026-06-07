"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { MonthlyStats } from "@/lib/types";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

interface Props { monthlyStats: MonthlyStats[] }

export function IncomeExpenseChart({ monthlyStats }: Props) {
  const { lang, fc, fck } = useLang();
  const tx  = appT[lang].dashboard;
  const rTx = appT[lang].reports;

  const TooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-card p-3 border border-border/60 text-xs space-y-1.5 min-w-[160px]">
        <p className="font-semibold text-foreground capitalize">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-medium tabular-nums" style={{ color: p.fill }}>
              {fc(p.value)}
            </span>
          </div>
        ))}
        {/* Balance line */}
        {payload.length === 2 && (
          <div className="pt-1 border-t border-border/30 flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{rTx.balance}</span>
            <span className={`font-semibold tabular-nums ${
              payload[0].value - payload[1].value >= 0 ? "text-emerald-400" : "text-red-400"
            }`}>
              {fc(payload[0].value - payload[1].value)}
            </span>
          </div>
        )}
      </div>
    );
  };

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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
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
            content={<TooltipContent />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
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
            fill="#10b981"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
            opacity={0.9}
          />
          <Bar
            dataKey="expenses"
            name={rTx.expenses_label}
            fill="#ef4444"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
            opacity={0.9}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
