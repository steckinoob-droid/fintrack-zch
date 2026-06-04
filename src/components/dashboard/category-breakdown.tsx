"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";

const RADIAN = Math.PI / 180;
const COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.08) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="glass-card p-3 border border-border/60 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.payload.fill }} />
        <span className="font-semibold text-foreground">{d.name}</span>
      </div>
      <span className="text-muted-foreground">{formatCurrency(d.value)}</span>
    </div>
  );
}

interface Props { transactions: Transaction[] }

export function CategoryBreakdown({ transactions }: Props) {
  const expenseMap = new Map<string, { name: string; value: number }>();

  for (const tx of transactions) {
    if (tx.type !== "expense" || !tx.category) continue;
    const key = tx.category.name;
    const cur = expenseMap.get(key) ?? { name: key, value: 0 };
    expenseMap.set(key, { name: key, value: cur.value + tx.amount });
  }

  const data = Array.from(expenseMap.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (!data.length) {
    return (
      <div className="glass-card p-5 flex flex-col items-center justify-center h-full min-h-[280px] text-center">
        <p className="text-sm text-muted-foreground">Sem despesas registradas</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="font-display font-semibold text-foreground text-sm">Despesas por Categoria</h3>
        <p className="text-xs text-muted-foreground">Transações recentes</p>
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
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5">
        {data.slice(0, 4).map((item, i) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-muted-foreground truncate">{item.name}</span>
            </div>
            <span className="font-medium tabular-nums text-foreground">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
