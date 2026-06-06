"use client";

import Link from "next/link";
import { Plus, PiggyBank } from "lucide-react";
import type { SavingsGoal } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { Progress } from "@/components/ui/progress";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

interface Props { goals: SavingsGoal[] }

export function SavingsGoalsOverview({ goals }: Props) {
  const { lang } = useLang();
  const tx = appT[lang].dashboard;

  if (!goals.length) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-foreground text-sm">{tx.savingsGoals}</h3>
        </div>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <PiggyBank size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{tx.noGoals}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
              {tx.noGoalsDesc}
            </p>
          </div>
          <Link
            href="/goals"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            {tx.startSaving}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground text-sm">{tx.savingsGoals}</h3>
        <div className="flex items-center gap-2">
          {/* Primary CTA — always visible */}
          <Link
            href="/goals"
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <PiggyBank size={11} />
            {tx.depositBtn}
          </Link>
          <Link href="/goals" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {tx.viewAllGoals}
          </Link>
        </div>
      </div>

      <div className="space-y-3.5">
        {goals.map((goal) => {
          const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
          const completed = pct >= 100;
          return (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
                  <span className="text-foreground font-medium truncate max-w-[130px]">{goal.name}</span>
                </div>
                <span className={completed ? "text-emerald-400 font-semibold" : "text-muted-foreground tabular-nums"}>
                  {completed ? "✓" : `${pct}%`}
                </span>
              </div>
              <Progress
                value={pct}
                className="h-1.5"
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
    </div>
  );
}
