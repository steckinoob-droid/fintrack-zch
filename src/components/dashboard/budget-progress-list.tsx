"use client";

import Link from "next/link";
import type { Budget } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { PieChart } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props { budgets: Budget[] }

export function BudgetProgressList({ budgets }: Props) {
  if (!budgets.length) {
    return (
      <div className="glass-card p-5">
        <h3 className="font-display font-semibold text-foreground text-sm mb-4">Orçamentos</h3>
        <EmptyState icon={PieChart} title="Nenhum orçamento" description="Configure orçamentos para controlar seus gastos." />
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground text-sm">Orçamentos do Mês</h3>
        <Link href="/budgets" className="text-xs text-primary hover:underline font-medium">Gerenciar</Link>
      </div>
      <div className="space-y-3">
        {budgets.slice(0, 4).map((budget) => {
          const spent = budget.spent ?? 0;
          const pct = Math.min(100, Math.round((spent / budget.amount) * 100));
          const over = pct >= 100;
          const warn = pct >= 80;

          return (
            <div key={budget.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: budget.category?.color ?? "#10b981" }}
                  />
                  <span className="text-foreground font-medium">{budget.category?.name}</span>
                </div>
                <span className={cn("tabular-nums", over ? "text-red-400" : warn ? "text-amber-400" : "text-muted-foreground")}>
                  {formatCurrency(spent)} / {formatCurrency(budget.amount)}
                </span>
              </div>
              <Progress
                value={pct}
                className="h-1.5"
                indicatorClassName={over ? "bg-red-500" : warn ? "bg-amber-500" : "bg-primary"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
