"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, PieChart, ChevronLeft, ChevronRight, Copy, Loader2, Bell, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BudgetDialog } from "./budget-dialog";
import { BudgetAlerts } from "@/components/dashboard/budget-alerts";
import { toast } from "@/lib/hooks/use-toast";
import {
  getCurrentMonth, formatMonthYear, getMonthRange,
  getPrevMonth, getNextMonth,
} from "@/lib/utils/date";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { Budget, Category } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

export function BudgetsClient() {
  const { lang, fc } = useLang();
  const tx     = appT[lang].budgets;
  const common = appT[lang].common;

  const [budgets, setBudgets]       = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [copying, setCopying]       = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch]         = useState("");

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Navigable month — starts at current month
  const [viewMonth, setViewMonth] = useState(getCurrentMonth());
  const isCurrentMonth = viewMonth >= getCurrentMonth();

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = getMonthRange(viewMonth);

    // All reads go through service-role API routes to bypass the anon-client
    // stale-JWT / RLS issue (auth.uid() returns NULL in browser PostgREST).
    const [budgetsJson, txRes] = await Promise.all([
      fetch(`/api/budgets/list?month=${viewMonth}`)
        .then(r => r.ok ? r.json() as Promise<{ budgets: Budget[]; categories: Category[] }> : { budgets: [], categories: [] })
        .catch(() => ({ budgets: [], categories: [] })),
      fetch(`/api/transactions/list?type=expense&dateFrom=${start}&dateTo=${end}&limit=5000`)
        .then(r => r.ok ? r.json() as Promise<{ transactions: Array<{ category_id: string | null; amount: number }> }> : { transactions: [] })
        .catch(() => ({ transactions: [] })),
    ]);

    const txs = txRes.transactions ?? [];
    const withSpent = (budgetsJson.budgets ?? []).map((b: Budget) => ({
      ...b,
      spent: txs
        .filter((t) => t.category_id === b.category_id)
        .reduce((s, t) => s + Number(t.amount), 0),
    }));
    setBudgets(withSpent);
    setCategories(budgetsJson.categories ?? []);
    setLoading(false);
  }, [viewMonth]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/budgets/delete?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir"); return; }
    toast.success(lang === "en" ? "Budget deleted" : "Orçamento excluído");
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  /** Copy all budgets from previous month — skips categories already set */
  async function handleCopyPrevMonth() {
    setCopying(true);
    const prevMonth = getPrevMonth(viewMonth);

    // Read previous month's budgets via API route (service role bypasses RLS).
    const prevRes = await fetch(`/api/budgets/list?month=${prevMonth}`);
    if (!prevRes.ok) { setCopying(false); return; }
    const prevJson = await prevRes.json() as { budgets: Budget[] };
    const prev = prevJson.budgets ?? [];

    if (!prev.length) {
      toast.error(lang === "en" ? "No budgets found in previous month" : "Nenhum orçamento no mês anterior");
      setCopying(false); return;
    }

    const existingCatIds = new Set(budgets.map(b => b.category_id));
    const toCreate = prev
      .filter(b => !existingCatIds.has(b.category_id))
      .map(b => ({ category_id: b.category_id, amount: b.amount, month: viewMonth }));

    if (!toCreate.length) {
      toast.error(lang === "en" ? "All budgets already exist this month" : "Todos os orçamentos já existem neste mês");
      setCopying(false); return;
    }

    const copyRes = await fetch("/api/budgets/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toCreate),
    });
    setCopying(false);
    if (!copyRes.ok) { toast.error(lang === "en" ? "Error copying" : "Erro ao copiar"); return; }
    toast.success(lang === "en"
      ? `${toCreate.length} budgets copied!`
      : `${toCreate.length} orçamentos copiados do mês anterior!`);
    load();
  }

  const filteredBudgets = search
    ? budgets.filter(b => norm(b.category?.name ?? "").includes(norm(search)))
    : budgets;

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
        description={`${tx.descriptionPrefix} ${formatMonthYear(viewMonth, lang)}`}
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
          {formatMonthYear(viewMonth, lang)}
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
            {fc(totalBudgeted)}
          </p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.spent}</p>
          <p className={cn("font-display font-bold text-sm sm:text-lg tabular-nums truncate",
            totalSpent > totalBudgeted ? "text-red-400" : "text-foreground")}>
            {fc(totalSpent)}
          </p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-xs text-muted-foreground mb-1 truncate">{tx.available}</p>
          <p className={cn("font-display font-bold text-sm sm:text-lg tabular-nums truncate",
            totalBudgeted - totalSpent >= 0 ? "text-emerald-400" : "text-red-400")}>
            {fc(totalBudgeted - totalSpent)}
          </p>
        </div>
      </div>

      {/* Search */}
      {!loading && budgets.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={lang === "en" ? "Search by category..." : "Buscar por categoria..."}
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

      {/* Budget alerts (80% / 100% threshold) — same component as dashboard */}
      <BudgetAlerts budgets={budgets} />

      {/* New month auto-prompt */}
      {showNewMonthPrompt && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Bell size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {lang === "en" ? "New month, new budgets!" : "Novo mês, novos orçamentos!"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "en"
                ? "Copy last month's budgets with one click and adjust as needed."
                : "Copie os orçamentos do mês passado com um clique e ajuste o que precisar."}
            </p>
          </div>
          <Button size="sm" onClick={handleCopyPrevMonth} disabled={copying}>
            {copying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
            {lang === "en" ? "Copy now" : "Copiar agora"}
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
      ) : filteredBudgets.length === 0 && search ? (
        <div className="glass-card">
          <EmptyState icon={Search} title={lang === "en" ? "No results" : "Sem resultados"}
            description={lang === "en" ? `No budgets matching "${search}"` : `Nenhum orçamento para "${search}"`}
            action={<Button size="sm" variant="outline" onClick={() => setSearch("")}><X size={14} /> {lang === "en" ? "Clear search" : "Limpar busca"}</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredBudgets.map(b => {
            const spent = b.spent ?? 0;
            const pct   = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
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
                        {over ? tx.overLimit : warn ? tx.almostLimit : `${fc(b.amount - spent)} ${tx.remaining}`}
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
                  <span className="tabular-nums">{fc(spent)} {tx.spent.toLowerCase()}</span>
                  <span className="font-medium tabular-nums">{pct}{tx.pctUsed}{fc(b.amount)}</span>
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
