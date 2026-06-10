"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Target, CalendarDays, ChevronDown, ChevronUp, History, RefreshCw, ArrowDownLeft, ArrowUpRight, PartyPopper, Search, X, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalDialog } from "./goal-dialog";
import { GoalDepositDialog } from "./goal-deposit-dialog";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { toast } from "@/lib/hooks/use-toast";
import { formatRelativeDate } from "@/lib/utils/date";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { SavingsGoal } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { differenceInDays, parseISO } from "date-fns";
import { usePlan } from "@/lib/hooks/use-plan";
import { FREE_GOALS_LIMIT } from "@/lib/utils/plan-limits";

export function GoalsClient() {
  const { lang, fc } = useLang();
  const tx = appT[lang].goals;
  const common = appT[lang].common;
  const plan = usePlan();

  const [goals, setGoals]                   = useState<SavingsGoal[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [editGoal, setEditGoal]             = useState<SavingsGoal | null>(null);
  const [depositGoal, setDepositGoal]       = useState<SavingsGoal | null>(null);
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [depositOpen, setDepositOpen]       = useState(false);
  const [upgradeOpen, setUpgradeOpen]       = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [depositHistory, setDepositHistory] = useState<Record<string, { date: string; amount: number; created_at: string; kind: "deposit" | "withdrawal" }[]>>({});
  // goalId → monthly auto-deposit amount (0 = none)
  const [autoDeposits, setAutoDeposits]     = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/goals/list");
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json() as {
      goals: SavingsGoal[];
      autoDeposits: Record<string, number>;
    };
    setGoals(json.goals ?? []);
    setAutoDeposits(json.autoDeposits ?? {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadHistory(goal: SavingsGoal) {
    if (depositHistory[goal.id]) {
      // toggle off/on
      setExpandedHistory(expandedHistory === goal.id ? null : goal.id);
      return;
    }
    setExpandedHistory(goal.id);
    const supabase = createClient();

    // Fetch deposits (type=saving, notes starts with goal_id:<id>)
    // AND withdrawals (type=income, notes starts with goal_withdrawal:<id>)
    // Also include legacy deposits matched by title ilike (no notes field)
    const [depRes, wdRes, legacyRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("date, amount, created_at")
        .eq("user_id", goal.user_id)
        .eq("type", "saving")
        .like("notes", `goal_id:${goal.id}%`)
        .order("date", { ascending: false })
        .limit(20),
      supabase
        .from("transactions")
        .select("date, amount, created_at")
        .eq("user_id", goal.user_id)
        .eq("type", "income")
        .like("notes", `goal_withdrawal:${goal.id}%`)
        .order("date", { ascending: false })
        .limit(20),
      supabase
        .from("transactions")
        .select("date, amount, created_at")
        .eq("user_id", goal.user_id)
        .eq("type", "saving")
        .ilike("title", `%${goal.name}%`)
        .is("notes", null)  // legacy: no notes field
        .order("date", { ascending: false })
        .limit(20),
    ]);

    type RawEntry = { date: string; amount: number; created_at: string };
    const deposits: { date: string; amount: number; created_at: string; kind: "deposit" | "withdrawal" }[] = [
      ...(depRes.data ?? []).map((r: RawEntry) => ({ ...r, kind: "deposit" as const })),
      ...(legacyRes.data ?? []).map((r: RawEntry) => ({ ...r, kind: "deposit" as const })),
      ...(wdRes.data ?? []).map((r: RawEntry) => ({ ...r, kind: "withdrawal" as const })),
    ];

    // Deduplicate by (date+amount+created_at) and sort newest first
    const seen = new Set<string>();
    const deduped = deposits.filter(d => {
      const key = `${d.date}|${d.amount}|${d.created_at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

    setDepositHistory(prev => ({ ...prev, [goal.id]: deduped.slice(0, 30) }));
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/goals/delete?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir"); return; }
    toast.success(lang === "en" ? "Goal deleted" : "Meta excluída");
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  // True only once plan has resolved to "free" AND the user is at/above the limit.
  // While plan is null (loading) we never show the lock so there's no flash-of-block.
  const goalLimitReached = plan === "free" && goals.length >= FREE_GOALS_LIMIT;

  function handleNewGoal() {
    if (goalLimitReached) { setUpgradeOpen(true); return; }
    setEditGoal(null);
    setDialogOpen(true);
  }

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filteredGoals = search ? goals.filter(g => norm(g.name).includes(norm(search))) : goals;

  // Summary stats always reflect ALL goals, not just the filtered subset
  const totalTarget    = goals.reduce((s, g) => s + g.target_amount, 0);
  const totalSaved     = goals.reduce((s, g) => s + g.current_amount, 0);
  const completedGoals = goals.filter(g => g.current_amount >= g.target_amount).length;

  return (
    <div className="space-y-6">
      <PageHeader title={tx.title} description={tx.description}
        action={
          <Button onClick={handleNewGoal} size="sm">
            {goalLimitReached ? <Lock size={13} /> : <Plus size={15} />}
            {tx.new}
            {goalLimitReached && (
              <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-foreground/15 text-primary-foreground/90">
                {tx.gate.limitBadge}
              </span>
            )}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.totalSaved}</p>
          <p className="font-display font-bold text-sm sm:text-lg tabular-nums text-primary truncate">{fc(totalSaved)}</p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.totalTarget}</p>
          <p className="font-display font-bold text-sm sm:text-lg tabular-nums truncate">{fc(totalTarget)}</p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.completed}</p>
          <p className="font-display font-bold text-sm sm:text-lg tabular-nums text-emerald-400">{completedGoals}/{goals.length}</p>
        </div>
      </div>

      {/* Search input */}
      {!loading && goals.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={lang === "en" ? "Search goals..." : "Buscar metas..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-40 shimmer" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={Target} title={tx.empty} description={tx.emptyDesc}
            action={<Button size="sm" onClick={handleNewGoal}><Plus size={15} /> {tx.create}</Button>} />
        </div>
      ) : filteredGoals.length === 0 && search ? (
        <div className="glass-card">
          <EmptyState icon={Search} title={lang === "en" ? "No results" : "Sem resultados"}
            description={lang === "en" ? `No goals matching "${search}"` : `Nenhuma meta para "${search}"`}
            action={<Button size="sm" variant="outline" onClick={() => setSearch("")}><X size={14} /> {lang === "en" ? "Clear search" : "Limpar busca"}</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredGoals.map(goal => {
            const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
            const completed  = pct >= 100;
            const daysLeft   = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
            return (
              <div key={goal.id} className={cn(
                "glass-card-hover p-5 group",
                pct >= 100 && "ring-2 ring-emerald-500/30"
              )}>
                {/* Completion banner */}
                {pct >= 100 && (
                  <div className="flex items-center gap-2 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                    <PartyPopper size={14} className="text-emerald-400 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-400">
                      {lang === "en" ? "🎉 Goal reached! Amazing work!" : "🎉 Meta atingida! Excelente trabalho!"}
                    </p>
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: goal.color + "20" }}>
                      {pct >= 100
                        ? <PartyPopper size={18} className="text-emerald-400" />
                        : <Target size={18} style={{ color: goal.color }} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-semibold text-foreground">{goal.name}</p>
                        {autoDeposits[goal.id] && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            <RefreshCw size={9} />
                            {fc(autoDeposits[goal.id])}{lang === "en" ? "/mo" : "/mês"}
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
                      {fc(goal.current_amount)}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{fc(goal.target_amount)}</span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-2.5"
                    indicatorClassName="transition-all duration-700"
                    style={{ "--progress-color": completed ? "#10b981" : goal.color } as React.CSSProperties}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{completed ? tx.goalReached : `${pct}${tx.pctComplete}`}</span>
                    {!completed && <span className="tabular-nums">{tx.remaining} {fc(goal.target_amount - goal.current_amount)}</span>}
                  </div>

                  {/* History toggle */}
                  <button
                    onClick={() => loadHistory(goal)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <History size={11} />
                    {lang === "en" ? "Movement history" : "Histórico de movimentos"}
                    {expandedHistory === goal.id
                      ? <ChevronUp size={11} />
                      : <ChevronDown size={11} />}
                  </button>

                  {/* History list */}
                  {expandedHistory === goal.id && (
                    <div className="space-y-1 pt-1.5 border-t border-border/30">
                      {!depositHistory[goal.id] ? (
                        <p className="text-xs text-muted-foreground py-1">{lang === "en" ? "Loading..." : "Carregando..."}</p>
                      ) : depositHistory[goal.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">
                          {lang === "en" ? "No movements yet." : "Nenhum movimento registrado ainda."}
                        </p>
                      ) : (
                        depositHistory[goal.id].map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                            {d.kind === "deposit"
                              ? <ArrowDownLeft size={10} className="shrink-0 text-emerald-400" />
                              : <ArrowUpRight  size={10} className="shrink-0 text-amber-400"   />}
                            <span className="text-muted-foreground flex-1">{formatRelativeDate(d.date, d.created_at, lang)}</span>
                            <span className={cn(
                              "font-medium tabular-nums shrink-0",
                              d.kind === "deposit" ? "text-emerald-400" : "text-amber-400"
                            )}>
                              {d.kind === "deposit" ? "+" : "−"}{fc(d.amount)}
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
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title={tx.gate.modalTitle}
        description={tx.gate.modalDesc}
        cta={tx.gate.modalCta}
        highlightBenefit={2}
      />
    </div>
  );
}
