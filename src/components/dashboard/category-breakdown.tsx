"use client";

import { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { PieLabelRenderProps, TooltipContentProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { PieChart as PieChartIcon } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { CHART_PALETTE } from "@/lib/utils/chart-colors";

// Fallback palette (theme-aware tokens) for categories without a set color.
const FALLBACK_COLORS = CHART_PALETTE;

const RADIAN = Math.PI / 180;
// Recharts injects these props at render time via `label={<CustomLabel />}`,
// so the props are partial here.
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: Partial<PieLabelRenderProps>) {
  if (
    percent == null || cx == null || cy == null || midAngle == null ||
    innerRadius == null || outerRadius == null
  ) return null;
  if (percent < 0.07) return null;
  const cxN = Number(cx);
  const cyN = Number(cy);
  const r = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
  const x = cxN + r * Math.cos(-midAngle * RADIAN);
  const y = cyN + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

interface ChartEntry { name: string; value: number; color: string }
interface Props { transactions: Transaction[] }

// Hoisted out of the component so it is not recreated on every render. Recharts
// injects `active`/`payload` at render time; `fc` (the currency formatter) is
// passed explicitly so this stays a stable module-level component.
function CategoryTooltip({
  active, payload, fc,
}: Partial<TooltipContentProps<ValueType, NameType>> & { fc: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const color = (d.payload as ChartEntry | undefined)?.color;
  return (
    <div className="glass-card p-3 border border-border/60 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="font-semibold text-foreground">{d.name}</span>
      </div>
      <span className="text-muted-foreground">
        {typeof d.value === "number" ? fc(d.value) : String(d.value ?? "")}
      </span>
    </div>
  );
}

export function CategoryBreakdown({ transactions }: Props) {
  const { lang, fc } = useLang();
  const tx = appT[lang].dashboard;
  const reduced = useReducedMotion();

  // Build expense breakdown using real category colors. Aggregation depends only
  // on `transactions`, so memoize it — it used to recompute on every render
  // (e.g. when an unrelated parent state changed). Output is byte-identical:
  // same single-pass grouping, same fallback-color assignment order, same
  // `.sort((a,b) => b.value - a.value).slice(0, 7)`.
  const data = useMemo(() => {
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
    return Array.from(expenseMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [transactions]);

  if (!data.length) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[200px]">
        <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
          <PieChartIcon size={22} className="text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">
            {tx.categoryBreakdown.emptyTitle}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
            {tx.categoryBreakdown.emptyDesc}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <a
            href="/budgets"
            className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-primary/10 border border-primary/25 px-3 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            {tx.categoryBreakdown.createBudget}
          </a>
          <a
            href="/transactions"
            className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border/60 px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            {tx.categoryBreakdown.addExpense}
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
            isAnimationActive={!reduced}
            animationDuration={350}
            animationEasing="ease-out"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CategoryTooltip fc={fc} />} />
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
