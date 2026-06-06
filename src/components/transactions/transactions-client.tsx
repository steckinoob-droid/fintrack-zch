"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  PiggyBank, Pencil, Trash2, RefreshCw, Upload, Zap, Check, SlidersHorizontal, X, AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionRowSkeleton } from "@/components/shared/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TransactionDialog } from "./transaction-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { suggestCategory } from "@/lib/utils/auto-categorize";
import type { Transaction, Category } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatRelativeDate, getDateRange, type Period } from "@/lib/utils/date";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

// ── Period labels ────────────────────────────────────────────────────────────
const PERIODS: { value: Period; label: string; labelEn: string }[] = [
  { value: "this_month",  label: "Este mês",     labelEn: "This month"   },
  { value: "last_month",  label: "Mês passado",  labelEn: "Last month"   },
  { value: "3months",     label: "3 meses",      labelEn: "3 months"     },
  { value: "year",        label: "Este ano",     labelEn: "This year"    },
  { value: "all",         label: "Tudo",         labelEn: "All time"     },
];

export function TransactionsClient() {
  const { lang } = useLang();
  const tx     = appT[lang].transactions;
  const common = appT[lang].common;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search, setSearch]     = useState("");
  const [tab, setTab]           = useState<"all" | "income" | "expense" | "saving">("all");
  const [period, setPeriod]     = useState<Period>("this_month");
  const [catFilter, setCatFilter] = useState("__all__");
  const [showFilters, setShowFilters] = useState(false);

  // ── Dialogs ──────────────────────────────────────────────────────────────
  const [editTx, setEditTx]           = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting]       = useState(false);

  // ── Quick Add ────────────────────────────────────────────────────────────
  const [quickOpen, setQuickOpen]     = useState(false);
  const [quickTitle, setQuickTitle]   = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickType, setQuickType]     = useState<"income" | "expense">("expense");
  const [quickCatId, setQuickCatId]   = useState("__auto__");
  const [quickLoading, setQuickLoading] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [txRes, catRes] = await Promise.all([
      supabase.from("transactions").select("*, category:categories(*)")
        .eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("categories").select("*")
        .eq("user_id", user.id).order("name"),
    ]);
    setTransactions(txRes.data ?? []);
    setCategories(catRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Delete single ─────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir"); return; }
    toast.success(lang === "en" ? "Deleted" : "Excluída");
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  // ── Delete all ────────────────────────────────────────────────────────────
  async function handleDeleteAll() {
    if (deleteConfirm.toUpperCase() !== "APAGAR") return;
    setDeleting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(false); return; }
    const { error } = await supabase.from("transactions").delete().eq("user_id", user.id);
    setDeleting(false);
    if (error) { toast.error("Erro ao apagar. Tente novamente."); return; }
    toast.success(`${transactions.length} transações apagadas.`);
    setTransactions([]);
    setDeleteAllOpen(false);
    setDeleteConfirm("");
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const dateRange = useMemo(() => getDateRange(period), [period]);

  const filtered = useMemo(() => transactions.filter(t => {
    if (dateRange && (t.date < dateRange.start || t.date > dateRange.end)) return false;
    if (tab !== "all" && t.type !== tab) return false;
    if (catFilter !== "__all__" && t.category_id !== catFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [transactions, dateRange, tab, catFilter, search]);

  const activeFilters = (catFilter !== "__all__" ? 1 : 0) + (period !== "this_month" ? 1 : 0);

  // ── Quick Add ─────────────────────────────────────────────────────────────
  const liveQuickCat = useMemo(() => {
    if (quickCatId !== "__auto__" || quickTitle.length < 3) return null;
    try {
      return suggestCategory(quickTitle, categories.filter(c => c.type === quickType));
    } catch { return null; }
  }, [quickTitle, quickType, quickCatId, categories]);

  async function handleQuickAdd() {
    const amount = parseFloat(quickAmount.replace(",", "."));
    if (!quickTitle.trim() || isNaN(amount) || amount <= 0) return;
    setQuickLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setQuickLoading(false); return; }
    const typedCats = categories.filter(c => c.type === quickType);
    const suggested = quickCatId === "__auto__" ? suggestCategory(quickTitle, typedCats) : null;
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id, title: quickTitle.trim(), amount,
      type: quickType, category_id: (quickCatId !== "__auto__" ? quickCatId : suggested?.id) ?? null,
      date: new Date().toISOString().slice(0, 10),
      notes: null, is_recurring: false, recurrence_interval: null,
    });
    setQuickLoading(false);
    if (error) { toast.error(lang === "en" ? "Error" : "Erro ao adicionar"); return; }
    toast.success(lang === "en" ? "Added!" : "Adicionada!");
    // Clear fields but keep Quick Add open for rapid entry
    setQuickTitle(""); setQuickAmount(""); setQuickCatId("__auto__");
    load();
  }

  // ── Summary totals (for current filter) ──────────────────────────────────
  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalSaving  = filtered.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0);
  const netBalance   = totalIncome - totalExpense - totalSaving;

  // Clear all filters helper
  function clearFilters() {
    setSearch(""); setTab("all"); setPeriod("this_month"); setCatFilter("__all__");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={tx.title}
        description={tx.description}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              className="text-red-400 hover:text-red-300 hover:border-red-500/50 hover:bg-red-500/10"
              onClick={() => { setDeleteConfirm(""); setDeleteAllOpen(true); }}
            >
              <Trash2 size={14} /> {lang === "en" ? "Delete all" : "Apagar tudo"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload size={14} /> CSV
            </Button>
            <Button
              variant={quickOpen ? "default" : "outline"} size="sm"
              onClick={() => setQuickOpen(v => !v)}
            >
              <Zap size={14} /> {lang === "en" ? "Quick" : "Rápido"}
            </Button>
            <Button size="sm" onClick={() => { setEditTx(null); setDialogOpen(true); }}>
              <Plus size={15} /> {tx.add}
            </Button>
          </div>
        }
      />

      {/* ── Quick Add ──────────────────────────────────────────────────── */}
      {quickOpen && (
        <div className="glass-card p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Zap size={12} className="text-primary" />
            {lang === "en" ? "Quick add — press Enter to save" : "Adicionar rápido — Enter para salvar"}
          </p>
          <div className="flex flex-wrap gap-2 items-start">
            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border text-xs shrink-0">
              <button onClick={() => { setQuickType("expense"); setQuickCatId("__auto__"); }}
                className={cn("px-3 py-1.5 transition-colors", quickType === "expense"
                  ? "bg-red-500/20 text-red-400 font-medium" : "text-muted-foreground hover:text-foreground")}>
                − {lang === "en" ? "Expense" : "Despesa"}
              </button>
              <button onClick={() => { setQuickType("income"); setQuickCatId("__auto__"); }}
                className={cn("px-3 py-1.5 transition-colors", quickType === "income"
                  ? "bg-emerald-500/20 text-emerald-400 font-medium" : "text-muted-foreground hover:text-foreground")}>
                + {lang === "en" ? "Income" : "Receita"}
              </button>
            </div>
            <Input className="flex-1 min-w-32 h-8 text-sm"
              placeholder={lang === "en" ? "Description (auto-categorizes)" : "Descrição (auto-categoriza)"}
              value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuickAdd()} autoFocus />
            <Input className="w-28 h-8 text-sm" placeholder="R$ 0,00" inputMode="decimal"
              value={quickAmount} onChange={e => setQuickAmount(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuickAdd()} />
            <div className="flex flex-col gap-0.5">
              <Select value={quickCatId} onValueChange={setQuickCatId}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__" className="text-xs">
                    {lang === "en" ? "Auto-detect" : "Auto-detectar"}
                  </SelectItem>
                  {categories.filter(c => c.type === quickType).map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {quickCatId === "__auto__" && liveQuickCat && (
                <span className="text-[10px] text-indigo-400 pl-1 flex items-center gap-0.5">
                  <Check size={9} /> {liveQuickCat.name}
                </span>
              )}
              {quickCatId === "__auto__" && !liveQuickCat && quickTitle.length >= 3 && (
                <span className="text-[10px] text-muted-foreground pl-1">sem sugestão</span>
              )}
            </div>
            <Button size="sm" className="h-8" onClick={handleQuickAdd} disabled={quickLoading}>
              {quickLoading ? <RefreshCw size={13} className="animate-spin" /> : lang === "en" ? "Add" : "Adicionar"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{tx.incomeFiltered}</p>
          <p className="font-display font-bold text-lg text-emerald-400 tabular-nums">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{tx.expensesFiltered}</p>
          <p className="font-display font-bold text-lg text-red-400 tabular-nums">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{tx.savingsFiltered}</p>
          <p className="font-display font-bold text-lg text-indigo-400 tabular-nums">{formatCurrency(totalSaving)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{tx.balanceFilter}</p>
          <p className={cn("font-display font-bold text-lg tabular-nums", netBalance >= 0 ? "text-primary" : "text-red-400")}>
            {formatCurrency(netBalance)}
          </p>
        </div>
      </div>

      {/* ── Filters row ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Top row: search + type tabs + filter toggle */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={tx.search} value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">{tx.allTab}</TabsTrigger>
              <TabsTrigger value="income">{tx.incomeTab}</TabsTrigger>
              <TabsTrigger value="expense">{tx.expenseTab}</TabsTrigger>
              <TabsTrigger value="saving">{tx.savingTab}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowFilters(v => !v)}
            className={cn("shrink-0", activeFilters > 0 && "border-primary text-primary")}
          >
            <SlidersHorizontal size={14} />
            {lang === "en" ? "Filters" : "Filtros"}
            {activeFilters > 0 && (
              <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        {/* Period chips + category filter (collapsible) */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/40">
            {/* Period chips */}
            <div className="flex flex-wrap gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    period === p.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {lang === "en" ? p.labelEn : p.label}
                </button>
              ))}
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-border/60 hidden sm:block" />

            {/* Category filter */}
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-7 text-xs w-44">
                <SelectValue placeholder={lang === "en" ? "All categories" : "Todas as categorias"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">
                  {lang === "en" ? "All categories" : "Todas as categorias"}
                </SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear */}
            {activeFilters > 0 && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <X size={11} /> {lang === "en" ? "Clear" : "Limpar"}
              </button>
            )}
          </div>
        )}

        {/* Active filter chips summary */}
        {!showFilters && activeFilters > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-primary font-medium">
              {PERIODS.find(p => p.value === period)
                ? (lang === "en" ? PERIODS.find(p => p.value === period)!.labelEn : PERIODS.find(p => p.value === period)!.label)
                : ""}
            </span>
            {catFilter !== "__all__" && (
              <>
                <span>·</span>
                <span className="text-primary font-medium">
                  {categories.find(c => c.id === catFilter)?.name}
                </span>
              </>
            )}
            <button onClick={clearFilters} className="hover:text-foreground transition-colors ml-1">
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {/* ── Transaction list ──────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => <TransactionRowSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title={search || activeFilters > 0 ? (lang === "en" ? "No results" : "Nenhum resultado") : tx.empty}
            description={
              search ? `${lang === "en" ? "No transactions matching" : "Nenhuma transação com"} "${search}"`
              : activeFilters > 0 ? (lang === "en" ? "Try changing the filters above." : "Tente mudar os filtros acima.")
              : tx.emptyDesc
            }
            action={
              activeFilters > 0 || search
                ? <Button size="sm" variant="outline" onClick={clearFilters}><X size={14} /> {lang === "en" ? "Clear filters" : "Limpar filtros"}</Button>
                : <Button size="sm" onClick={() => { setEditTx(null); setDialogOpen(true); }}><Plus size={15} /> {tx.add}</Button>
            }
          />
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                {/* Icon */}
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  t.type === "income" ? "bg-emerald-500/10"
                  : t.type === "saving" ? "bg-indigo-500/10"
                  : "bg-red-500/10")}>
                  {t.type === "income"
                    ? <ArrowUpRight size={16} className="text-emerald-400" />
                    : t.type === "saving"
                    ? <PiggyBank size={16} className="text-indigo-400" />
                    : <ArrowDownRight size={16} className="text-red-400" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                    {t.is_recurring && (
                      <span title={tx.recurring} className="shrink-0 text-primary"><RefreshCw size={11} /></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {t.category?.name ?? common.noCategory}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatRelativeDate(t.date, t.created_at)}
                    </span>
                  </div>
                </div>

                {/* Amount */}
                <span className={cn("text-sm font-semibold tabular-nums shrink-0",
                  t.type === "income" ? "text-emerald-400"
                  : t.type === "saving" ? "text-indigo-400"
                  : "text-red-400")}>
                  {t.type === "income" ? "+" : "−"}{formatCurrency(t.amount)}
                </span>

                {/* Actions */}
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditTx(t); setDialogOpen(true); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(t.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Count hint */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {filtered.length} {lang === "en" ? "transactions" : "transações"}
          {activeFilters > 0 || search ? (lang === "en" ? " matching filters" : " com filtros ativos") : ""}
        </p>
      )}

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen}
        transaction={editTx} categories={categories}
        onSuccess={() => { setDialogOpen(false); load(); }} />

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen}
        categories={categories} onSuccess={() => { load(); }} />

      {/* ── Delete all confirmation ───────────────────────────────────── */}
      <Dialog open={deleteAllOpen} onOpenChange={v => { setDeleteAllOpen(v); setDeleteConfirm(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} /> {lang === "en" ? "Delete all transactions" : "Apagar todas as transações"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            {/* Warning banner */}
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-1">
              <p className="text-sm font-semibold text-red-400">
                {lang === "en" ? "This action cannot be undone." : "Esta ação não pode ser desfeita."}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === "en"
                  ? `All ${transactions.length} transactions will be permanently deleted. Budgets and goals are not affected.`
                  : `Todas as ${transactions.length} transações serão apagadas permanentemente. Orçamentos e metas não são afetados.`}
              </p>
            </div>

            {/* Confirm input */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? 'Type ' : 'Digite '}
                <span className="font-mono font-bold text-foreground">APAGAR</span>
                {lang === "en" ? ' to confirm:' : ' para confirmar:'}
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleDeleteAll()}
                placeholder="APAGAR"
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteAllOpen(false); setDeleteConfirm(""); }}>
              {lang === "en" ? "Cancel" : "Cancelar"}
            </Button>
            <Button
              onClick={handleDeleteAll}
              disabled={deleteConfirm.toUpperCase() !== "APAGAR" || deleting}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
            >
              {deleting
                ? <><RefreshCw size={13} className="animate-spin" /> {lang === "en" ? "Deleting..." : "Apagando..."}</>
                : <><Trash2 size={14} /> {lang === "en" ? `Delete ${transactions.length}` : `Apagar ${transactions.length} transações`}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
