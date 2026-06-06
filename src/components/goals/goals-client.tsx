"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Target, CalendarDays, ChevronDown, ChevronUp, History, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalDialog } from "./goal-dialog";
import { GoalDepositDialog } from "./goal-deposit-dialog";
import { toast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import { formatRelativeDate } from "@/lib/utils/date";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { SavingsGoal } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { differenceInDays, parseISO } from "date-fns";

export function GoalsClient() {
  const { lang } = useLang();
  const tx = appT[lang].goals;
  const common = appT[lang].common;

  const [goals, setGoals]                   = useState<SavingsGoal[]>([]);
  const [loading, setLoading]               = useState(true);
  const [editGoal, setEditGoal]             = useState<SavingsGoal | null>(null);
  const [depositGoal, setDepositGoal]       = useState<SavingsGoal | null>(null);
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [depositOpen, setDepositOpen]       = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [depositHistory, setDepositHistory] = useState<Record<string, { date: string; amount: number; created_at: string }[]>>({});
  // goalId → monthly auto-deposit amount (0 = none)
  const [autoDeposits, setAutoDeposits]     = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [goalsRes, autoRes] = await Promise.all([
      supabase.from("savings_goals").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("transactions").select("notes, amount")
        .eq("user_id", user.id).eq("type", "saving").eq("is_recurring", true)
        .is("recurrence_parent_id", null),
    ]);
    setGoals(goalsRes.data ?? []);
    // Build map: goalId → deposit amount
    const map: Record<string, number> = {};
    for (const t of autoRes.data ?? []) {
      if (t.notes?.startsWith("goal_id:")) {
        const gid = t.notes.replace("goal_id:", "").trim();
        map[gid] = t.amount;
      }
    }
    setAutoDeposits(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadHistory(goal: SavingsGoal) {
    if (depositHistory[goal.id]) {
      // toggle off
      setExpandedHistory(expandedHistory === goal.id ? null : goal.id);
      return;
    }
    setExpandedHistory(goal.id);
    const supabase = createClient();
    const { data } = await supabase
      .from("transactions")
      .select("date, amount, created_at")
      .eq("user_id", goal.user_id)
      .eq("type", "saving")
      .ilike("title", `%${goal.name}%`)
      .order("date", { ascending: false })
      .limit(20);
    setDepositHistory(prev => ({ ...prev, [goal.id]: data ?? [] }));
  }

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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-semibold text-foreground">{goal.name}</p>
                        {autoDeposits[goal.id] && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            <RefreshCw size={9} />
                            {formatCurrency(autoDeposits[goal.id])}/mês
                          </span>
                        )}
                      </div>
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
                  <div className="card-actions">
                    <button onClick={() => { setDepositGoal(goal); setDepositOpen(true); }}
                      className="px-2 py-1 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors font-medium">
                      {tx.depositBtn}
                    </button>
                    <button onClick={() => { setEditGoal(goal); setDialogOpen(true); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={common.edit}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(goal.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={common.delete}>
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

                  {/* History toggle */}
                  <button
                    onClick={() => loadHistory(goal)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <History size={11} />
                    {lang === "en" ? "Deposit history" : "Histórico de aportes"}
                    {expandedHistory === goal.id
                      ? <ChevronUp size={11} />
                      : <ChevronDown size={11} />}
                  </button>

                  {/* History list */}
                  {expandedHistory === goal.id && (
                    <div className="space-y-1 pt-1 border-t border-border/30">
                      {!depositHistory[goal.id] ? (
                        <p className="text-xs text-muted-foreground py-1">Carregando...</p>
                      ) : depositHistory[goal.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">
                          {lang === "en" ? "No deposits yet." : "Nenhum aporte registrado ainda."}
                        </p>
                      ) : (
                        depositHistory[goal.id].map((d, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-muted-foreground">{formatRelativeDate(d.date, d.created_at, lang)}</span>
                            <span className="font-medium tabular-nums" style={{ color: goal.color }}>
                              +{formatCurrency(d.amount)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
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
          onSuccess={() => {
            setDepositOpen(false);
            // Clear cached history so it reloads fresh on next expand
            if (depositGoal) setDepositHistory(prev => { const n = { ...prev }; delete n[depositGoal.id]; return n; });
            load();
          }} />
      )}
    </div>
  );
}
