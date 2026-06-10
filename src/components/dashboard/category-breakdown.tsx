"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

// Fallback palette for categories without a set color
const FALLBACK_COLORS = [
  "#10b981", "#6366f1", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

const RADIAN = Math.PI / 180;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.07) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

interface ChartEntry { name: string; value: number; color: string }
interface Props { transactions: Transaction[] }

export function CategoryBreakdown({ transactions }: Props) {
  const { lang, fc } = useLang();
  const tx = appT[lang].dashboard;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="glass-card p-3 border border-border/60 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.payload.color }} />
          <span className="font-semibold text-foreground">{d.name}</span>
        </div>
        <span className="text-muted-foreground">{fc(d.value)}</span>
      </div>
    );
  };

  // Build expense breakdown using real category colors
  const expenseMap = new Map<string, ChartEntry>();
  let fallbackIdx = 0;
  for (const t of transactions) {
    if (t.type !== "expense" || !t.category) continue;
    const key   = t.category.name;
    const color = t.category.color || FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
    const cur   = expenseMap.get(key);
    if (cur) {
      expenseMap.set(key, { ...cur, value: cur.value + t.amount });
    } else {
      expenseMap.set(key, { name: key, value: t.amount, color });
    }
  }
  const data = Array.from(expenseMap.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  if (!data.length) {
    return (
      <div className="glass-card p-6 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
          <PieChartIcon size={22} className="text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">
            {lang === "en" ? "Nothing to show yet" : "Nada para mostrar ainda"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
            {lang === "en"
              ? "Add expenses and create budgets to see your category breakdown."
              : "Registre despesas e crie orçamentos para ver sua distribuição por categoria."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <a
            href="/budgets"
            className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-primary/10 border border-primary/25 px-3 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            {lang === "en" ? "Create budget" : "Criar orçamento"}
          </a>
          <a
            href="/transactions"
            className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border/60 px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            {lang === "en" ? "Add expense" : "Adicionar despesa"}
          </a>
        </div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="font-display font-semibold text-foreground text-sm">{tx.expensesByCategory}</h3>
        <p className="text-xs text-muted-foreground">{tx.recentTxChartLabel}</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={85}
            dataKey="value"
            nameKey="name"
            labelLine={false}
            label={<CustomLabel />}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<TooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5">
        {data.slice(0, 5).map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-muted-foreground/50">
                {total > 0 ? `${Math.round((item.value / total) * 100)}%` : "—"}
              </span>
              <span className="font-medium tabular-nums text-foreground">{fc(item.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
