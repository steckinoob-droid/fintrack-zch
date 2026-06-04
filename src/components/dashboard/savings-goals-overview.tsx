"use client";

import Link from "next/link";
import type { SavingsGoal } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { Target } from "lucide-react";

interface Props { goals: SavingsGoal[] }

export function SavingsGoalsOverview({ goals }: Props) {
  if (!goals.length) {
    return (
      <div className="glass-card p-5">
        <h3 className="font-display font-semibold text-foreground text-sm mb-4">Metas</h3>
        <EmptyState icon={Target} title="Nenhuma meta" description="Crie metas de poupança para atingir seus objetivos." />
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground text-sm">Metas de Poupança</h3>
        <Link href="/goals" className="text-xs text-primary hover:underline font-medium">Ver todas</Link>
      </div>
      <div className="space-y-3">
        {goals.map((goal) => {
          const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
          return (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
                  <span className="text-foreground font-medium truncate max-w-[120px]">{goal.name}</span>
                </div>
                <span className="text-muted-foreground tabular-nums">{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" indicatorClassName="transition-all duration-700" style={{ "--indicator-color": goal.color } as React.CSSProperties} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">{formatCurrency(goal.current_amount)}</span>
                <span className="tabular-nums">{formatCurrency(goal.target_amount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
