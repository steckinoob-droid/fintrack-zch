"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  PiggyBank, Pencil, Trash2, RefreshCw, Upload, Zap, Check,
  SlidersHorizontal, X, AlertTriangle, MoreVertical, Calendar, Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionRowSkeleton } from "@/components/shared/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TransactionDialog } from "./transaction-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { RecurringManagerDialog } from "./recurring-manager-dialog";
import { suggestCategory } from "@/lib/utils/auto-categorize";
import { useDashboardRefresh } from "@/lib/context/dashboard-refresh";
import type { Transaction, Category } from "@/lib/types";
import { formatRelativeDate, formatGroupDate, getDateRange, type Period } from "@/lib/utils/date";
import { cleanTitle } from "@/lib/utils/parse-santander-pdf";
import { generateRecurringTransactions } from "@/lib/utils/recurring";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

const PERIODS: { value: Period; label: string; labelEn: string }[] = [
  { value: "this_month",  label: "Este mês",     labelEn: "This month"   },
  { value: "last_month",  label: "Mês passado",  labelEn: "Last month"   },
  { value: "3months",     label: "3 meses",      labelEn: "3 months"     },
  { value: "year",        label: "Este ano",     labelEn: "This year"    },
  { value: "all",         label: "Tudo",         labelEn: "All time"     },
];

const PAGE_SIZE = 200;

export function TransactionsClient() {
  const { lang, fc, fck } = useLang();
  const tx     = appT[lang].transactions;
  const common = appT[lang].common;
  const { refresh } = useDashboardRefresh();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount]     = useState(0);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [dbOffset, setDbOffset]         = useState(PAGE_SIZE);

  const [search, setSearch]       = useState("");
  const [tab, setTab]             = useState<"all" | "income" | "expense" | "saving">("all");
  // Read last-used period from sessionStorage so navigating away and back
  // (e.g. after an import) doesn't reset to "this_month" and hide transactions.
  const [period, _setPeriod]      = useState<Period>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("fintrack_tx_period") as Period | null;
      if (saved && PERIODS.some(p => p.value === saved)) return saved;
    }
    return "this_month";
  });
  const [catFilter, setCatFilter] = useState("__all__");
  // Advanced filters
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [minValue, setMinValue]   = useState("");
  const [maxValue, setMaxValue]   = useState("");

  // Wrapper that also persists the chosen period across navigation.
  const setPeriod = useCallback((p: Period) => {
    _setPeriod(p);
    if (typeof window !== "undefined") sessionStorage.setItem("fintrack_tx_period", p);
  }, []);
  const [showFilters, setShowFilters] = useState(false);

  const [editTx, setEditTx]           = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [importOpen, setImportOpen]         = useState(false);
  const [recurringOpen, setRecurringOpen]   = useState(false);
  const [deleteAllOpen, setDeleteAllOpen]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting]       = useState(false);
  const [inlineCatTxId, setInlineCatTxId] = useState<string | null>(null);

  const [quickOpen, setQuickOpen]     = useState(false);
  const [quickTitle, setQuickTitle]   = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickType, setQuickType]     = useState<"income" | "expense">("expense");
  const [quickCatId, setQuickCatId]   = useState("__auto__");
  const [quickLoading, setQuickLoading] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    // Generate any recurring transactions for the current month before loading
    await generateRecurringTransactions(supabase, user.id);
    const [txRes, catRes] = await Promise.all([
      supabase.from("transactions")
        .select("*, category:categories(*)", { count: "exact" })
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(PAGE_SIZE),
      supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
    ]);
    setTransactions(txRes.data ?? []);
    setTotalCount(txRes.count ?? 0);
    setDbOffset(PAGE_SIZE);
    setCategories(catRes.data ?? []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingMore(false); return; }
    const { data } = await supabase
      .from("transactions")
      .select("*, category:categories(*)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(dbOffset, dbOffset + PAGE_SIZE - 1);
    setTransactions(prev => [...prev, ...(data ?? [])]);
    setDbOffset(prev => prev + PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, dbOffset]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (e.key === "n" && !inInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setQuickOpen(v => !v);
      }
      if (e.key === "Escape") setInlineCatTxId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleInlineCat(txId: string, catId: string) {
    const resolved = catId === "__none__" ? null : catId;
    const supabase = createClient();
    await supabase.from("transactions").update({ category_id: resolved }).eq("id", txId);
    setTransactions(prev => prev.map(t =>
      t.id !== txId ? t : { ...t, category_id: resolved, category: categories.find(c => c.id === resolved) }
    ));
    setInlineCatTxId(null);
    refresh();
  }

  function handleDelete(id: string) {
    const deleted = transactions.find(t => t.id === id);
    if (!deleted) return;
    setTransactions(prev => prev.filter(t => t.id !== id));
    setTotalCount(prev => Math.max(0, prev - 1));
    const timeoutId = setTimeout(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) {
        setTransactions(prev => [...prev, deleted].sort((a, b) => b.date.localeCompare(a.date)));
        setTotalCount(prev => prev + 1);
        toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir");
      } else { refresh(); }
    }, 4000);
    toast({
      title: lang === "en" ? "Transaction deleted" : "Transação excluída",
      variant: "default",
      action: {
        label: lang === "en" ? "Undo" : "Desfazer",
        onClick: () => {
          clearTimeout(timeoutId);
          setTransactions(prev => [...prev, deleted].sort((a, b) => b.date.localeCompare(a.date)));
          setTotalCount(prev => prev + 1);
        },
      },
    });
  }

  async function handleDeleteAll() {
    const CONFIRM_WORD = lang === "en" ? "DELETE" : "APAGAR";
    if (deleteConfirm.toUpperCase() !== CONFIRM_WORD) return;
    setDeleting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(false); return; }
    const { error } = await supabase.from("transactions").delete().eq("user_id", user.id);
    setDeleting(false);
    if (error) { toast.error(lang === "en" ? "Error deleting. Try again." : "Erro ao apagar. Tente novamente."); return; }
    toast.success(lang === "en"
      ? `${totalCount} transaction${totalCount !== 1 ? "s" : ""} deleted.`
      : `${totalCount} transações apagadas.`);
    setTransactions([]);
    setTotalCount(0);
    setDbOffset(PAGE_SIZE);
    setDeleteAllOpen(false);
    setDeleteConfirm("");
    refresh();
  }

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const filtered = useMemo(() => transactions.filter(t => {
    // Date: custom range (dateFrom/dateTo) overrides period pills
    if (dateFrom || dateTo) {
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo   && t.date > dateTo)   return false;
    } else if (dateRange) {
      if (t.date < dateRange.start || t.date > dateRange.end) return false;
    }
    if (tab === "income"  && t.type !== "income")  return false;
    if (tab === "expense" && t.type !== "expense") return false;
    if (tab === "saving"  && t.type !== "saving")  return false;
    if (catFilter !== "__all__" && t.category_id !== catFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    // Value filters
    const minV = parseFloat(minValue.replace(",", "."));
    const maxV = parseFloat(maxValue.replace(",", "."));
    if (!isNaN(minV) && t.amount < minV) return false;
    if (!isNaN(maxV) && t.amount > maxV) return false;
    return true;
  }), [transactions, dateRange, tab, catFilter, search, dateFrom, dateTo, minValue, maxValue]);

  // ── Group by date ─────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of filtered) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // Count active "hidden" filters (those inside the collapsible panel)
  const activeFilters = [
    catFilter !== "__all__",
    !!(dateFrom || dateTo),
    !!(minValue || maxValue),
  ].filter(Boolean).length;

  // Auto-expand period once per page visit when data has loaded but the
  // current period filter hides all transactions.  Typical case: user imports
  // last month's statement → navigates to Transactions → period is still
  // "this_month" → nothing visible.  We silently widen to "all" so they see
  // their data without having to know about the filter.
  const didAutoExpand = useRef(false);
  useEffect(() => {
    if (loading || didAutoExpand.current) return;
    if (
      transactions.length > 0 &&
      filtered.length === 0 &&
      !search &&
      catFilter === "__all__" &&
      tab === "all" &&
      !dateFrom && !dateTo &&
      !minValue && !maxValue
    ) {
      didAutoExpand.current = true;
      setPeriod("all");
    }
  // Run only when loading state or transaction counts change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, transactions.length, filtered.length]);

  const liveQuickCat = useMemo(() => {
    if (quickCatId !== "__auto__" || quickTitle.length < 3) return null;
    try { return suggestCategory(quickTitle, categories.filter(c => c.type === quickType)); }
    catch { return null; }
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
    setQuickTitle(""); setQuickAmount(""); setQuickCatId("__auto__");
    load(); refresh();
  }

  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);
  const netBalance   = totalIncome - totalExpense;

  function clearFilters() {
    setSearch(""); setTab("all"); setPeriod("this_month"); setCatFilter("__all__");
    setDateFrom(""); setDateTo(""); setMinValue(""); setMaxValue("");
  }

  function handleExportCsv() {
    const header = lang === "en"
      ? ["Date", "Title", "Type", "Amount", "Category"]
      : ["Data", "Título", "Tipo", "Valor", "Categoria"];
    const typeLabel = (t: typeof filtered[0]) =>
      lang === "en"
        ? (t.type === "income" ? "Income" : t.type === "saving" ? "Savings" : "Expense")
        : (t.type === "income" ? "Receita" : t.type === "saving" ? "Poupança" : "Despesa");
    const rows = [
      header,
      ...filtered.map(t => [
        t.date,
        `"${t.title.replace(/"/g, '""')}"`,
        typeLabel(t),
        t.amount.toFixed(2),
        `"${(t.category?.name ?? "").replace(/"/g, '""')}"`,
      ]),
    ];
    const csv  = rows.map(r => r.join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `fintrack-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      lang === "en"
        ? `Exported ${filtered.length} transactions`
        : `${filtered.length} transações exportadas`
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx.title}
        description={tx.description}
        action={
          <div className="flex items-center gap-2">
            {/* Desktop: show all actions */}
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                className="text-red-400 hover:text-red-300 hover:border-red-500/50 hover:bg-red-500/10"
                onClick={() => { setDeleteConfirm(""); setDeleteAllOpen(true); }}
              >
                <Trash2 size={14} /> {lang === "en" ? "Delete all" : "Apagar tudo"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload size={14} /> Extrato
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRecurringOpen(true)}>
                <RefreshCw size={14} /> {lang === "en" ? "Recurring" : "Recorrentes"}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleExportCsv}
                disabled={filtered.length === 0}
                title={lang === "en" ? `Export ${filtered.length} transactions as CSV` : `Exportar ${filtered.length} transações em CSV`}
              >
                <Download size={14} /> CSV
              </Button>
              <Button
                variant={quickOpen ? "default" : "outline"} size="sm"
                onClick={() => setQuickOpen(v => !v)}
              >
                <Zap size={14} /> {lang === "en" ? "Quick" : "Rápido"}
              </Button>
            </div>

            {/* Mobile: overflow menu */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical size={15} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setImportOpen(true)}>
                    <Upload size={14} className="mr-2" /> {lang === "en" ? "Import Statement" : "Importar Extrato"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRecurringOpen(true)}>
                    <RefreshCw size={14} className="mr-2" /> {lang === "en" ? "Recurring" : "Recorrentes"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQuickOpen(v => !v)}>
                    <Zap size={14} className="mr-2" /> {lang === "en" ? "Quick add" : "Rápido"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCsv} disabled={filtered.length === 0}>
                    <Download size={14} className="mr-2" /> {lang === "en" ? `Export CSV (${filtered.length})` : `Exportar CSV (${filtered.length})`}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-400 focus:text-red-400"
                    onClick={() => { setDeleteConfirm(""); setDeleteAllOpen(true); }}
                  >
                    <Trash2 size={14} className="mr-2" /> {lang === "en" ? "Delete all" : "Apagar tudo"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button size="sm" onClick={() => { setEditTx(null); setDialogOpen(true); }}>
              <Plus size={15} />
              <span className="hidden sm:inline ml-1">{tx.add}</span>
            </Button>
          </div>
        }
      />

      {/* ── Quick Add ──────────────────────────────────────────────────── */}
      {quickOpen && (
        <div className="glass-card p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Zap size={12} className="text-primary" />
            {lang === "en" ? "Quick add — Enter to save" : "Adicionar rápido — Enter para salvar"}
            <span className="ml-auto text-muted-foreground font-normal hidden sm:inline">
              {lang === "en" ? "press N to toggle" : "tecla N para fechar"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2 items-start">
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
              placeholder={lang === "en" ? "Description" : "Descrição"}
              value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuickAdd()} autoFocus />
            <Input className="w-28 h-8 text-sm" placeholder={lang === "en" ? "0.00" : "0,00"} inputMode="decimal"
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
            </div>
            <Button size="sm" className="h-8" onClick={handleQuickAdd} disabled={quickLoading}>
              {quickLoading ? <RefreshCw size={13} className="animate-spin" /> : lang === "en" ? "Add" : "Adicionar"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-card p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs text-muted-foreground mb-1 truncate">{tx.incomeFiltered}</p>
          <p className="font-display font-bold text-sm sm:text-lg text-emerald-400 tabular-nums truncate">{fck(totalIncome)}</p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs text-muted-foreground mb-1 truncate">
            {tab === "saving" ? tx.savingsTab : tx.expensesFiltered}
          </p>
          <p className="font-display font-bold text-sm sm:text-lg text-red-400 tabular-nums truncate">{fck(totalExpense)}</p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs text-muted-foreground mb-1 truncate">{tx.balanceFilter}</p>
          <p className={cn("font-display font-bold text-sm sm:text-lg tabular-nums truncate", netBalance >= 0 ? "text-primary" : "text-red-400")}>
            {fck(netBalance)}
          </p>
        </div>
      </div>

      {/* ── Filters row ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={tx.search} value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowFilters(v => !v)}
            className={cn("shrink-0 h-9", activeFilters > 0 && "border-primary text-primary")}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline ml-1">{lang === "en" ? "Filters" : "Filtros"}</span>
            {activeFilters > 0 && (
              <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        {/* Type tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all" className="flex-1 sm:flex-none">{tx.allTab}</TabsTrigger>
            <TabsTrigger value="income" className="flex-1 sm:flex-none">{tx.incomeTab}</TabsTrigger>
            <TabsTrigger value="expense" className="flex-1 sm:flex-none">{tx.expenseTab}</TabsTrigger>
            <TabsTrigger value="saving" className="flex-1 sm:flex-none">{tx.savingsTab}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Period pills — always visible so user always knows which time range is active */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => { setPeriod(p.value); setDateFrom(""); setDateTo(""); }}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                period === p.value && !dateFrom && !dateTo
                  ? "bg-primary/15 text-primary"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {lang === "en" ? p.labelEn : p.label}
            </button>
          ))}
        </div>

        {/* Advanced filters — collapsible via Filters button */}
        {showFilters && (
          <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-2">
            {/* Row 1: Category + Date range */}
            <div className="flex flex-wrap items-center gap-2">
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

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{tx.filters.dateFrom}</span>
                <Input type="date" value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="h-7 text-xs px-2 w-32" />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{tx.filters.dateTo}</span>
                <Input type="date" value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-7 text-xs px-2 w-32" />
              </div>
            </div>

            {/* Row 2: Value range + Clear */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{tx.filters.minValue}</span>
                <Input type="number" value={minValue}
                  onChange={e => setMinValue(e.target.value)}
                  className="h-7 text-xs px-2 w-24"
                  placeholder="0" min="0" step="0.01" />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{tx.filters.maxValue}</span>
                <Input type="number" value={maxValue}
                  onChange={e => setMaxValue(e.target.value)}
                  className="h-7 text-xs px-2 w-24"
                  placeholder="∞" min="0" step="0.01" />
              </div>

              {(activeFilters > 0 || search) && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
                  <X size={11} /> {tx.filters.clearAll}
                </button>
              )}
            </div>

            {/* Indicator when custom date range is active */}
            {(dateFrom || dateTo) && (
              <p className="text-[10px] text-amber-400/80 flex items-center gap-1.5 pt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70 shrink-0" />
                {tx.filters.customActive}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Transaction list (grouped by date) ────────────────────────── */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => <TransactionRowSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          /* ── Smart empty state ──────────────────────────────────────────
             Case 1: user has data but it's hidden by the period filter
             Case 2: search/category filter with no matches
             Case 3: truly no data at all                                 */
          transactions.length > 0 && !search && catFilter === "__all__" && !dateFrom && !dateTo && !minValue && !maxValue ? (
            <div className="flex flex-col items-center gap-4 py-12 px-4 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center">
                <Calendar size={22} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {lang === "en"
                    ? `No transactions in "${PERIODS.find(p => p.value === period)?.labelEn ?? "this period"}"`
                    : `Nenhuma transação em "${PERIODS.find(p => p.value === period)?.label ?? "este período"}"`}
                </p>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {lang === "en"
                    ? `You have ${totalCount} transaction${totalCount !== 1 ? "s" : ""} in other periods`
                    : `Você tem ${totalCount} transação${totalCount !== 1 ? "ões" : ""} em outros períodos`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPeriod("all")}>
                {lang === "en" ? "View all transactions" : "Ver todas as transações"}
              </Button>
            </div>
          ) : (() => {
              const hasFilters = !!(search || catFilter !== "__all__" || dateFrom || dateTo || minValue || maxValue);
              return (
                <EmptyState
                  icon={hasFilters ? Search : ArrowLeftRight}
                  title={hasFilters ? (lang === "en" ? "No results" : "Nenhum resultado") : tx.empty}
                  description={
                    search ? `${lang === "en" ? "No transactions matching" : "Nenhuma transação com"} "${search}"`
                    : hasFilters ? (lang === "en" ? "Try changing the filters above." : "Tente mudar os filtros acima.")
                    : tx.emptyDesc
                  }
                  action={
                    hasFilters
                      ? <Button size="sm" variant="outline" onClick={clearFilters}><X size={14} /> {lang === "en" ? "Clear filters" : "Limpar filtros"}</Button>
                      : <Button size="sm" onClick={() => { setEditTx(null); setDialogOpen(true); }}><Plus size={15} /> {tx.add}</Button>
                  }
                />
              );
            })()
        ) : (
          <div>
            {grouped.map(([dateKey, rows]) => (
              <div key={dateKey}>
                {/* Date group header */}
                {(() => {
                  const net = rows.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
                  return (
                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/10 border-b border-border/30">
                      <span className="text-xs font-semibold text-muted-foreground capitalize tracking-wide">
                        {formatGroupDate(dateKey, lang)}
                      </span>
                      <span className="text-xs text-muted-foreground/50">
                        {rows.length} {rows.length === 1 ? (lang === "en" ? "transaction" : "transação") : (lang === "en" ? "transactions" : "transações")}
                      </span>
                      {/* Only show group total for 2+ transactions — with 1 tx
                          the total is the same number as the row, which looks
                          like a duplicate and confuses users. */}
                      {rows.length > 1 && (
                        <span className={cn("ml-auto text-xs font-semibold tabular-nums",
                          net >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {(net >= 0 ? "+" : "−") + fck(Math.abs(net))}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Rows */}
                <div className="divide-y divide-border/30">
                  {rows.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                      {/* Type icon */}
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        t.type === "income" ? "bg-emerald-500/10"
                        : t.type === "saving" ? "bg-indigo-500/10"
                        : "bg-red-500/10")}>
                        {t.type === "income"
                          ? <ArrowUpRight size={15} className="text-emerald-400" />
                          : t.type === "saving"
                          ? <PiggyBank size={15} className="text-indigo-400" />
                          : <ArrowDownRight size={15} className="text-red-400" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-medium text-foreground truncate">{cleanTitle(t.title)}</p>
                          {t.type === "saving" && (
                            <span className="shrink-0 text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                              {tx.goalDepositBadge}
                            </span>
                          )}
                          {t.type === "income" && t.notes?.startsWith("goal_withdrawal:") && (
                            <span className="shrink-0 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                              {tx.withdrawalBadge}
                            </span>
                          )}
                          {t.is_recurring && (
                            <span title={tx.recurring} className="shrink-0">
                              <RefreshCw size={10} className="text-primary" />
                            </span>
                          )}
                        </div>

                        {/* Category + inline edit */}
                        <div className="flex items-center gap-1.5">
                          {inlineCatTxId === t.id ? (
                            <Select
                              defaultOpen
                              value={t.category_id ?? "__none__"}
                              onValueChange={v => handleInlineCat(t.id, v)}
                              onOpenChange={open => { if (!open) setInlineCatTxId(null); }}
                            >
                              <SelectTrigger className="h-5 text-xs border-none bg-transparent p-0 w-auto gap-1 focus:ring-0 shadow-none">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-xs">{common.noCategory}</SelectItem>
                                {categories.filter(c => c.type === t.type || t.type === "saving").map(c => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <button
                              onClick={() => setInlineCatTxId(t.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                              title={lang === "en" ? "Click to change category" : "Clique para mudar categoria"}
                            >
                              {/* Category color dot */}
                              {t.category?.color ? (
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: t.category.color }}
                                />
                              ) : (
                                <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/30" />
                              )}
                              <span className={cn(!t.category?.name && "italic opacity-50")}>
                                {t.category?.name ?? (lang === "en" ? "No category" : "Sem categoria")}
                              </span>
                            </button>
                          )}
                        </div>
                        {/* User notes — shown only when non-empty and not a system note */}
                        {t.notes &&
                          !t.notes.startsWith("goal_id:") &&
                          !t.notes.startsWith("goal_withdrawal:") &&
                          !t.notes.startsWith("ofx:") && (
                          <p className="text-[10px] text-muted-foreground/60 truncate italic leading-tight mt-0.5 max-w-[200px] sm:max-w-xs">
                            {t.notes}
                          </p>
                        )}
                      </div>

                      {/* Amount */}
                      <span className={cn("text-sm font-semibold tabular-nums shrink-0",
                        t.type === "income" ? "text-emerald-400"
                        : t.type === "saving" ? "text-indigo-400"
                        : "text-red-400")}>
                        {t.type === "income" ? "+" : "−"}{fc(t.amount)}
                      </span>

                      {/* Actions — card-actions: always visible on touch, hover-revealed on desktop */}
                      <div className="card-actions shrink-0">
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Load more / partial load banner ──────────────────────────── */}
      {!loading && transactions.length < totalCount && (
        <div className="glass-card p-4 flex flex-col items-center gap-3 text-center">
          <p className="text-xs text-muted-foreground">
            {tx.partialLoad
              .replace("{n}", String(transactions.length))
              .replace("{total}", String(totalCount))}
          </p>
          <Button
            variant="outline" size="sm"
            onClick={loadMore}
            disabled={loadingMore}
            className="min-w-32"
          >
            {loadingMore
              ? <><RefreshCw size={13} className="animate-spin" /> {lang === "en" ? "Loading..." : "Carregando..."}</>
              : <>{tx.loadMore} ({totalCount - transactions.length} {tx.loadMoreCount})</>}
          </Button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {filtered.length} {lang === "en" ? "transactions" : "transações"}
          {activeFilters > 0 || search ? (lang === "en" ? " matching filters" : " com filtros ativos") : ""}
          {transactions.length < totalCount && (
            <span className="ml-1 text-amber-400/70">
              {lang === "en" ? `(of ${transactions.length} loaded)` : `(de ${transactions.length} carregadas)`}
            </span>
          )}
        </p>
      )}

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen}
        transaction={editTx} categories={categories}
        onSuccess={() => { setDialogOpen(false); load(); refresh(); }} />

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen}
        categories={categories} onSuccess={() => { load(); refresh(); setPeriod("all"); }} />

      <RecurringManagerDialog open={recurringOpen} onOpenChange={setRecurringOpen}
        categories={categories} onSuccess={() => { load(); refresh(); }} />

      {/* Delete all dialog */}
      <Dialog open={deleteAllOpen} onOpenChange={v => { setDeleteAllOpen(v); setDeleteConfirm(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} /> {lang === "en" ? "Delete all transactions" : "Apagar todas as transações"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-1">
              <p className="text-sm font-semibold text-red-400">
                {lang === "en" ? "This action cannot be undone." : "Esta ação não pode ser desfeita."}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === "en"
                  ? `All ${totalCount} transactions will be permanently deleted.`
                  : `Todas as ${totalCount} transações serão apagadas permanentemente.`}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? 'Type ' : 'Digite '}
                <span className="font-mono font-bold text-foreground">{lang === "en" ? "DELETE" : "APAGAR"}</span>
                {lang === "en" ? ' to confirm:' : ' para confirmar:'}
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleDeleteAll()}
                placeholder={lang === "en" ? "DELETE" : "APAGAR"}
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
              disabled={deleteConfirm.toUpperCase() !== (lang === "en" ? "DELETE" : "APAGAR") || deleting}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
            >
              {deleting
                ? <><RefreshCw size={13} className="animate-spin" /> {lang === "en" ? "Deleting..." : "Apagando..."}</>
                : <><Trash2 size={14} /> {lang === "en" ? `Delete ${totalCount}` : `Apagar ${totalCount}`}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
