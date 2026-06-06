"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Target, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalDialog } from "./goal-dialog";
import { GoalDepositDialog } from "./goal-deposit-dialog";
import { toast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { SavingsGoal } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { differenceInDays, parseISO } from "date-fns";

export function GoalsClient() {
  const { lang } = useLang();
  const tx = appT[lang].goals;
  const common = appT[lang].common;

  const [goals, setGoals]           = useState<SavingsGoal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editGoal, setEditGoal]     = useState<SavingsGoal | null>(null);
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("savings_goals").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    setGoals(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("savings_goals").delete().eq("id", id);
    if (error) { toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir"); return; }
    toast.success(lang === "en" ? "Goal deleted" : "Meta excluída");
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  const totalTarget  = goals.reduce((s, g) => s + g.target_amount, 0);
  const totalSaved   = goals.reduce((s, g) => s + g.current_amount, 0);
  const completedGoals = goals.filter(g => g.current_amount >= g.target_amount).length;

  return (
    <div className="space-y-6">
      <PageHeader title={tx.title} description={tx.description}
        action={
          <Button onClick={() => { setEditGoal(null); setDialogOpen(true); }} size="sm">
            <Plus size={15} /> {tx.new}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.totalSaved}</p>
          <p className="font-display font-bold text-sm sm:text-lg tabular-nums text-primary truncate">{formatCurrency(totalSaved)}</p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.totalTarget}</p>
          <p className="font-display font-bold text-sm sm:text-lg tabular-nums truncate">{formatCurrency(totalTarget)}</p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.completed}</p>
          <p className="font-display font-bold text-sm sm:text-lg tabular-nums text-emerald-400">{completedGoals}/{goals.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-40 shimmer" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={Target} title={tx.empty} description={tx.emptyDesc}
            action={<Button size="sm" onClick={() => setDialogOpen(true)}><Plus size={15} /> {tx.create}</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {goals.map(goal => {
            const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
            const completed  = pct >= 100;
            const daysLeft   = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
            return (
              <div key={goal.id} className="glass-card-hover p-5 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: goal.color + "20" }}>
                      <Target size={18} style={{ color: goal.color }} />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-foreground">{goal.name}</p>
                      {goal.deadline && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <CalendarDays size={11} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {daysLeft !== null && daysLeft > 0
                              ? `${daysLeft} ${tx.daysLeft}`
                              : daysLeft === 0 ? tx.dueToday
                              : tx.overdue}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button onClick={() => { setDepositGoal(goal); setDepositOpen(true); }}
                      className="px-2 py-1 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors font-medium">
                      {tx.depositBtn}
                    </button>
                    <button onClick={() => { setEditGoal(goal); setDialogOpen(true); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(goal.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold tabular-nums" style={{ color: goal.color }}>
                      {formatCurrency(goal.current_amount)}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{formatCurrency(goal.target_amount)}</span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-2.5"
                    indicatorClassName="transition-all duration-700"
                    style={{ "--progress-color": completed ? "#10b981" : goal.color } as React.CSSProperties}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{completed ? tx.goalReached : `${pct}${tx.pctComplete}`}</span>
                    {!completed && <span className="tabular-nums">{tx.remaining} {formatCurrency(goal.target_amount - goal.current_amount)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} goal={editGoal}
        onSuccess={() => { setDialogOpen(false); load(); }} />
      {depositGoal && (
        <GoalDepositDialog open={depositOpen} onOpenChange={setDepositOpen} goal={depositGoal}
          onSuccess={() => { setDepositOpen(false); load(); }} />
      )}
    </div>
  );
}
