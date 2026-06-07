"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
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
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-medium tabular-nums" style={{ color: p.color }}>
              {fc(p.value)}
            </span>
          </div>
        ))}
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
        <AreaChart data={monthlyStats} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(215 16% 60%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fck} width={60} />
          <Tooltip content={<TooltipContent />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
          <Legend iconType="circle" iconSize={8}
            formatter={(v) => <span style={{ color: "hsl(215 16% 75%)", fontSize: 12 }}>{v}</span>} />
          <Area type="monotone" dataKey="income" name={rTx.incomeLabel}
            stroke="#10b981" strokeWidth={2} fill="url(#colorIncome)" dot={false}
            activeDot={{ r: 4, fill: "#10b981" }} />
          <Area type="monotone" dataKey="expenses" name={rTx.expenses_label}
            stroke="#ef4444" strokeWidth={2} fill="url(#colorExpenses)" dot={false}
            activeDot={{ r: 4, fill: "#ef4444" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
