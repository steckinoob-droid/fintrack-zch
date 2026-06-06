"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, PieChart, ChevronLeft, ChevronRight, Copy, Loader2, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BudgetDialog } from "./budget-dialog";
import { toast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getCurrentMonth, formatMonthYear, getMonthRange,
  getPrevMonth, getNextMonth,
} from "@/lib/utils/date";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { Budget, Category } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

export function BudgetsClient() {
  const { lang } = useLang();
  const tx     = appT[lang].budgets;
  const common = appT[lang].common;

  const [budgets, setBudgets]       = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [copying, setCopying]       = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Navigable month — starts at current month
  const [viewMonth, setViewMonth] = useState(getCurrentMonth());
  const isCurrentMonth = viewMonth >= getCurrentMonth();

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { start, end } = getMonthRange(viewMonth);

    const [bRes, cRes, tRes] = await Promise.all([
      supabase.from("budgets").select("*, category:categories(*)")
        .eq("user_id", user.id).eq("month", viewMonth),
      supabase.from("categories").select("*")
        .eq("user_id", user.id).eq("type", "expense").order("name"),
      supabase.from("transactions").select("amount, type, category_id")
        .eq("user_id", user.id).eq("type", "expense")
        .gte("date", start).lte("date", end),
    ]);

    const bs  = bRes.data ?? [];
    const txs = tRes.data ?? [];
    const withSpent = bs.map((b: Budget) => ({
      ...b,
      spent: txs
        .filter((t: any) => t.category_id === b.category_id)
        .reduce((s: number, t: any) => s + Number(t.amount), 0),
    }));
    setBudgets(withSpent);
    setCategories(cRes.data ?? []);
    setLoading(false);
  }, [viewMonth]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) { toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir"); return; }
    toast.success(lang === "en" ? "Budget deleted" : "Orçamento excluído");
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  /** Copy all budgets from previous month — skips categories already set */
  async function handleCopyPrevMonth() {
    setCopying(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCopying(false); return; }

    const prevMonth = getPrevMonth(viewMonth);
    const { data: prev } = await supabase.from("budgets")
      .select("*").eq("user_id", user.id).eq("month", prevMonth);

    if (!prev?.length) {
      toast.error(lang === "en" ? "No budgets found in previous month" : "Nenhum orçamento no mês anterior");
      setCopying(false); return;
    }

    const existingCatIds = new Set(budgets.map(b => b.category_id));
    const toCreate = prev
      .filter(b => !existingCatIds.has(b.category_id))
      .map(b => ({ user_id: user.id, category_id: b.category_id, amount: b.amount, month: viewMonth }));

    if (!toCreate.length) {
      toast.error(lang === "en" ? "All budgets already exist this month" : "Todos os orçamentos já existem neste mês");
      setCopying(false); return;
    }

    const { error } = await supabase.from("budgets").insert(toCreate);
    setCopying(false);
    if (error) { toast.error(lang === "en" ? "Error copying" : "Erro ao copiar"); return; }
    toast.success(lang === "en"
      ? `${toCreate.length} budgets copied!`
      : `${toCreate.length} orçamentos copiados do mês anterior!`);
    load();
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);

  // Show new-month prompt when: viewing current month, no budgets yet, early in the month
  const now = new Date();
  const showNewMonthPrompt =
    !loading &&
    budgets.length === 0 &&
    viewMonth >= getCurrentMonth() &&
    now.getDate() <= 7;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx.title}
        description={`${tx.descriptionPrefix} ${formatMonthYear(viewMonth)}`}
        action={
          <div className="flex items-center gap-2">
            {/* Copy from previous month */}
            <Button variant="outline" size="sm" onClick={handleCopyPrevMonth} disabled={copying}>
              {copying
                ? <Loader2 size={13} className="animate-spin" />
                : <Copy size={13} />}
              {lang === "en" ? "Copy prev." : "Copiar ant."}
            </Button>
            <Button onClick={() => { setEditBudget(null); setDialogOpen(true); }} size="sm">
              <Plus size={15} /> {tx.new}
            </Button>
          </div>
        }
      />

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setViewMonth(getPrevMonth(viewMonth))}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-foreground w-36 text-center capitalize">
          {formatMonthYear(viewMonth)}
        </span>
        <button
          onClick={() => setViewMonth(getNextMonth(viewMonth))}
          disabled={isCurrentMonth}
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
            isCurrentMonth
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.budgeted}</p>
          <p className="font-display font-bold text-sm sm:text-lg tabular-nums truncate">
            {formatCurrency(totalBudgeted)}
          </p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.spent}</p>
          <p className={cn("font-display font-bold text-sm sm:text-lg tabular-nums truncate",
            totalSpent > totalBudgeted ? "text-red-400" : "text-foreground")}>
            {formatCurrency(totalSpent)}
          </p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.available}</p>
          <p className={cn("font-display font-bold text-sm sm:text-lg tabular-nums truncate",
            totalBudgeted - totalSpent >= 0 ? "text-emerald-400" : "text-red-400")}>
            {formatCurrency(totalBudgeted - totalSpent)}
          </p>
        </div>
      </div>

      {/* New month auto-prompt */}
      {showNewMonthPrompt && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Bell size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Novo mês, novos orçamentos!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Copie os orçamentos do mês passado com um clique e ajuste o que precisar.
            </p>
          </div>
          <Button size="sm" onClick={handleCopyPrevMonth} disabled={copying}>
            {copying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
            Copiar agora
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-24 shimmer" />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={PieChart} title={tx.empty} description={tx.emptyDesc}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopyPrevMonth} disabled={copying}>
                  <Copy size={13} /> {lang === "en" ? "Copy from previous month" : "Copiar mês anterior"}
                </Button>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus size={15} /> {common.create}
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {budgets.map(b => {
            const spent = b.spent ?? 0;
            const pct   = Math.min(100, Math.round((spent / b.amount) * 100));
            const over  = pct >= 100;
            const warn  = pct >= 80 && !over;
            return (
              <div key={b.id} className="glass-card-hover p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (b.category?.color ?? "#10b981") + "20" }}>
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: b.category?.color ?? "#10b981" }} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{b.category?.name ?? common.noCategory}</p>
                      <p className={cn("text-xs", over ? "text-red-400" : warn ? "text-amber-400" : "text-muted-foreground")}>
                        {over ? tx.overLimit : warn ? tx.almostLimit : `${formatCurrency(b.amount - spent)} ${tx.remaining}`}
                      </p>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button onClick={() => { setEditBudget(b); setDialogOpen(true); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={common.edit}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(b.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={common.delete}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <Progress value={pct} className="h-2 mb-2"
                  indicatorClassName={over ? "bg-red-500" : warn ? "bg-amber-500" : "bg-primary"} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatCurrency(spent)} {tx.spent.toLowerCase()}</span>
                  <span className="font-medium tabular-nums">{pct}{tx.pctUsed}{formatCurrency(b.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BudgetDialog open={dialogOpen} onOpenChange={setDialogOpen} budget={editBudget}
        categories={categories} currentMonth={viewMonth}
        onSuccess={() => { setDialogOpen(false); load(); }} />
    </div>
  );
}
