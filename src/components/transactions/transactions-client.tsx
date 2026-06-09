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
  // Ref so loadMore / loadAll always join against the latest categories
  // without needing to add `categories` to their useCallback deps.
  const categoriesRef = useRef<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [dbOffset, setDbOffset]         = useState(PAGE_SIZE);

  const [search, setSearch]       = useState("");
  // When a search query is active, fetch ALL matching rows from the DB (not just the first 200).
  // null = no search active; array = server results ready.
  const [serverSearchTxs, setServerSearchTxs]   = useState<Transaction[] | null>(null);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);

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
  const [exporting, setExporting]       = useState(false);
  const [dbTotals, setDbTotals]         = useState<{ income: number; expense: number; count: number } | null>(null);
  const [loadAllLoading, setLoadAllLoading] = useState(false);
  const [totalsKey, setTotalsKey]       = useState(0);

  const load = useCallback(async () => {
    // Keep browser client only for generateRecurringTransactions (INSERT — not affected by RLS issue).
    const supabase = createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr) console.error("[load] auth error:", authErr.message);
    if (!user) { setLoading(false); return; }

    try {
      await generateRecurringTransactions(supabase, user.id);
    } catch (err) {
      console.error("[load] generateRecurringTransactions threw:", err);
    }

    // Fetch via API route — service role bypasses RLS regardless of client JWT state.
    const res = await fetch(`/api/transactions/list?offset=0&limit=${PAGE_SIZE}`);
    if (!res.ok) {
      console.error("[load] API error:", res.status);
      toast.error(lang === "en" ? "Error loading transactions. Reload the page." : "Erro ao carregar transações. Recarregue a página.");
      setLoading(false);
      return;
    }

    const json = await res.json() as { transactions: Transaction[]; total: number; categories: Category[] };
    const catMap = new Map(json.categories.map(c => [c.id, c]));
    const txsWithCats: Transaction[] = json.transactions.map(t => ({
      ...t,
      category: t.category_id ? catMap.get(t.category_id) : undefined,
    }));

    console.log(`[load] transactions=${json.transactions.length} total=${json.total}`);
    categoriesRef.current = json.categories;
    setTransactions(txsWithCats);
    setTotalCount(json.total);
    setDbOffset(PAGE_SIZE);
    setCategories(json.categories);
    setLoading(false);
    setTotalsKey(k => k + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(`/api/transactions/list?offset=${dbOffset}&limit=${PAGE_SIZE}`);
    if (!res.ok) { setLoadingMore(false); return; }
    const json = await res.json() as { transactions: Transaction[] };
    const catMap = new Map(categoriesRef.current.map(c => [c.id, c]));
    const withCats: Transaction[] = json.transactions.map(t => ({
      ...t,
      category: t.category_id ? catMap.get(t.category_id) : undefined,
    }));
    setTransactions(prev => [...prev, ...withCats]);
    setDbOffset(prev => prev + PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, dbOffset]);

  const loadAll = useCallback(async () => {
    if (loadAllLoading) return;
    setLoadAllLoading(true);
    const BATCH = 1000;
    const allRows: Transaction[] = [];
    const catMap = new Map(categoriesRef.current.map(c => [c.id, c]));
    let from = dbOffset;
    while (true) {
      const res = await fetch(`/api/transactions/list?offset=${from}&limit=${BATCH}`);
      if (!res.ok) break;
      const json = await res.json() as { transactions: Transaction[] };
      if (!json.transactions || json.transactions.length === 0) break;
      allRows.push(...json.transactions.map((t): Transaction => ({
        ...t,
        category: t.category_id ? catMap.get(t.category_id) : undefined,
      })));
      if (json.transactions.length < BATCH) break;
      from += BATCH;
    }
    setTransactions(prev => [...prev, ...allRows]);
    setDbOffset(prev => prev + allRows.length);
    setLoadAllLoading(false);
  }, [loadAllLoading, dbOffset]);

  useEffect(() => { load(); }, [load]);

  // Server-side search: fires when search query changes (350ms debounce).
  // Fetches up to 2000 matching rows from the full DB so filtering by period /
  // category works on the complete result set, not just the first 200 loaded.
  useEffect(() => {
    if (!search.trim()) {
      setServerSearchTxs(null);
      setServerSearchLoading(false);
      return;
    }
    setServerSearchLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/transactions/list?search=${encodeURIComponent(search)}&limit=2000`
      );
      setServerSearchLoading(false);
      if (!res.ok) return;
      const json = await res.json() as { transactions: Transaction[]; categories: Category[] };
      const catMap = new Map(json.categories.map(c => [c.id, c]));
      setServerSearchTxs(json.transactions.map(t => ({
        ...t,
        category: t.category_id ? catMap.get(t.category_id) : undefined,
      })));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function fetchDbTotals() {
      const effectiveStart = dateFrom || dateRange?.start || null;
      const effectiveEnd   = dateTo   || dateRange?.end   || null;
      const params = new URLSearchParams();
      if (effectiveStart)                params.set("dateFrom", effectiveStart);
      if (effectiveEnd)                  params.set("dateTo", effectiveEnd);
      if (tab !== "all")                 params.set("type", tab);
      if (catFilter !== "__all__")       params.set("categoryId", catFilter);
      if (search)                        params.set("search", search);
      const minV = parseFloat(minValue.replace(",", "."));
      const maxV = parseFloat(maxValue.replace(",", "."));
      if (!isNaN(minV) && minV > 0)      params.set("minValue", String(minV));
      if (!isNaN(maxV) && maxV > 0)      params.set("maxValue", String(maxV));
      const res = await fetch(`/api/transactions/totals?${params}`);
      if (cancelled || !res.ok) return;
      const json = await res.json() as { income: number; expense: number; count: number };
      if (cancelled) return;
      setDbTotals(json);
    }
    fetchDbTotals();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, tab, catFilter, search, dateFrom, dateTo, minValue, maxValue, totalsKey]);

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
        toast.error(tx.errorDelete);
      } else { refresh(); }
    }, 4000);
    toast({
      title: tx.deleted,
      variant: "default",
      action: {
        label: tx.undo,
        onClick: () => {
          clearTimeout(timeoutId);
          setTransactions(prev => [...prev, deleted].sort((a, b) => b.date.localeCompare(a.date)));
          setTotalCount(prev => prev + 1);
        },
      },
    });
  }

  async function handleDeleteAll() {
    if (deleteConfirm.toUpperCase() !== tx.deleteAllWord) return;
    setDeleting(true);
    // Use the server-side API route so the delete runs via service role,
    // bypassing the anon-client stale-JWT issue that silently deletes 0 rows.
    const res = await fetch("/api/transactions/delete-all", { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) { toast.error(tx.deleteAllError); return; }
    const json = await res.json().catch(() => ({})) as { deleted?: number };
    const n = json.deleted ?? totalCount;
    const successMsg = n === 1 ? tx.deleteAllSuccessSingle : tx.deleteAllSuccessPlural;
    toast.success(successMsg.replace("{n}", String(n)));
    setTransactions([]);
    setTotalCount(0);
    setDbOffset(PAGE_SIZE);
    setDeleteAllOpen(false);
    setDeleteConfirm("");
    refresh();
  }

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const filtered = useMemo(() => {
    // When a server search is active, use server results (covers full DB).
    // Otherwise fall back to the locally loaded page.
    const base = serverSearchTxs ?? transactions;
    const normStr = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

    return base.filter(t => {
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
      // Title search: server already filtered when serverSearchTxs is active.
      // For the locally loaded fallback, apply accent-normalised client filter.
      if (search && !serverSearchTxs && !normStr(t.title).includes(normStr(search))) return false;
      // Value filters
      const minV = parseFloat(minValue.replace(",", "."));
      const maxV = parseFloat(maxValue.replace(",", "."));
      if (!isNaN(minV) && t.amount < minV) return false;
      if (!isNaN(maxV) && t.amount > maxV) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSearchTxs, transactions, dateRange, tab, catFilter, search, dateFrom, dateTo, minValue, maxValue]);

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
    if (error) { toast.error(tx.quickError); return; }
    toast.success(tx.quickSuccess);
    setQuickTitle(""); setQuickAmount(""); setQuickCatId("__auto__");
    load(); refresh();
  }

  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);
  const netBalance   = totalIncome - totalExpense;

  // DB-level totals — always accurate regardless of how many rows are loaded
  const displayIncome  = dbTotals?.income  ?? totalIncome;
  const displayExpense = dbTotals?.expense ?? totalExpense;
  const displayBalance = displayIncome - displayExpense;

  function clearFilters() {
    setSearch(""); setTab("all"); setPeriod("this_month"); setCatFilter("__all__");
    setDateFrom(""); setDateTo(""); setMinValue(""); setMaxValue("");
    setServerSearchTxs(null);
  }

  async function handleExportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      const effectiveStart = dateFrom || dateRange?.start || null;
      const effectiveEnd   = dateTo   || dateRange?.end   || null;

      const baseParams = new URLSearchParams();
      if (effectiveStart)                  baseParams.set("dateFrom", effectiveStart);
      if (effectiveEnd)                    baseParams.set("dateTo", effectiveEnd);
      if (tab !== "all")                   baseParams.set("type", tab);
      if (catFilter !== "__all__")         baseParams.set("categoryId", catFilter);
      if (search)                          baseParams.set("search", search);
      const minV = parseFloat(minValue.replace(",", "."));
      const maxV = parseFloat(maxValue.replace(",", "."));
      if (!isNaN(minV) && minV > 0)        baseParams.set("minValue", String(minV));
      if (!isNaN(maxV) && maxV > 0)        baseParams.set("maxValue", String(maxV));

      const BATCH = 1000;
      const allRows: Transaction[] = [];
      let catMapExport = new Map(categoriesRef.current.map(c => [c.id, c]));
      let from = 0;
      while (true) {
        baseParams.set("offset", String(from));
        baseParams.set("limit", String(BATCH));
        const res = await fetch(`/api/transactions/list?${baseParams}`);
        if (!res.ok) break;
        const json = await res.json() as { transactions: Transaction[]; categories: Category[] };
        if (from === 0 && json.categories.length > 0) {
          catMapExport = new Map(json.categories.map(c => [c.id, c]));
        }
        if (!json.transactions || json.transactions.length === 0) break;
        allRows.push(...json.transactions.map((t): Transaction => ({
          ...t,
          category: t.category_id ? catMapExport.get(t.category_id) : undefined,
        })));
        if (json.transactions.length < BATCH) break;
        from += BATCH;
      }

      if (allRows.length === 0) {
        toast.success(tx.exportSuccess.replace("{n}", "0"));
        return;
      }

      const header = lang === "en"
        ? ["Date", "Title", "Type", "Amount", "Category", "Notes"]
        : ["Data", "Título", "Tipo", "Valor", "Categoria", "Notas"];

      const typeLabel = (t: Transaction) => {
        if (t.type === "income")  return lang === "en" ? "Income"   : "Receita";
        if (t.type === "saving")  return lang === "en" ? "Savings"  : "Poupança";
        return                           lang === "en" ? "Expense"  : "Despesa";
      };

      const csvRows = [
        header,
        ...allRows.map(t => {
          const note = (t.notes ?? "")
            .replace(/goal_id:[^\s]*/g, "")
            .replace(/goal_withdrawal:[^\s]*/g, "")
            .replace(/ofx:[^\s]*/g, "")
            .trim();
          return [
            t.date,
            `"${t.title.replace(/"/g, '""')}"`,
            typeLabel(t),
            t.amount.toFixed(2),
            `"${(t.category?.name ?? "").replace(/"/g, '""')}"`,
            `"${note.replace(/"/g, '""')}"`,
          ];
        }),
      ];

      const csv  = csvRows.map(r => r.join(",")).join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `fintrack-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(tx.exportSuccess.replace("{n}", String(allRows.length)));
    } finally {
      setExporting(false);
    }
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
                <Trash2 size={14} /> {tx.deleteAll}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload size={14} /> {tx.importStatement}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRecurringOpen(true)}>
                <RefreshCw size={14} /> {tx.recurringBtn}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleExportCsv}
                disabled={filtered.length === 0 || exporting}
                title={tx.exportTooltip.replace("{n}", String(filtered.length))}
              >
                {exporting
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <Download size={14} />
                } CSV
              </Button>
              <Button
                variant={quickOpen ? "default" : "outline"} size="sm"
                onClick={() => setQuickOpen(v => !v)}
              >
                <Zap size={14} /> {tx.quick}
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
                    <Upload size={14} className="mr-2" /> {tx.importStatement}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRecurringOpen(true)}>
                    <RefreshCw size={14} className="mr-2" /> {tx.recurringBtn}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQuickOpen(v => !v)}>
                    <Zap size={14} className="mr-2" /> {tx.quick}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCsv} disabled={filtered.length === 0 || exporting}>
                    <Download size={14} className="mr-2" /> {tx.exportCsvMobile.replace("{n}", String(filtered.length))}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-400 focus:text-red-400"
                    onClick={() => { setDeleteConfirm(""); setDeleteAllOpen(true); }}
                  >
                    <Trash2 size={14} className="mr-2" /> {tx.deleteAll}
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
            {tx.quickAddHint}
            <span className="ml-auto text-muted-foreground font-normal hidden sm:inline">
              {tx.quickAddToggle}
            </span>
          </p>
          <div className="flex flex-wrap gap-2 items-start">
            <div className="flex rounded-lg overflow-hidden border border-border text-xs shrink-0">
              <button onClick={() => { setQuickType("expense"); setQuickCatId("__auto__"); }}
                className={cn("px-3 py-1.5 transition-colors", quickType === "expense"
                  ? "bg-red-500/20 text-red-400 font-medium" : "text-muted-foreground hover:text-foreground")}>
                − {common.expense}
              </button>
              <button onClick={() => { setQuickType("income"); setQuickCatId("__auto__"); }}
                className={cn("px-3 py-1.5 transition-colors", quickType === "income"
                  ? "bg-emerald-500/20 text-emerald-400 font-medium" : "text-muted-foreground hover:text-foreground")}>
                + {common.income}
              </button>
            </div>
            <Input className="flex-1 min-w-32 h-8 text-sm"
              placeholder={tx.quickDesc}
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
                    {tx.autoDetect}
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
              {quickLoading ? <RefreshCw size={13} className="animate-spin" /> : common.add}
            </Button>
          </div>
        </div>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-card p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs text-muted-foreground mb-1 truncate">{tx.incomeFiltered}</p>
          <p className="font-display font-bold text-sm sm:text-lg text-emerald-400 tabular-nums truncate">{fck(displayIncome)}</p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs text-muted-foreground mb-1 truncate">
            {tab === "saving" ? tx.savingsTab : tx.expensesFiltered}
          </p>
          <p className="font-display font-bold text-sm sm:text-lg text-red-400 tabular-nums truncate">{fck(displayExpense)}</p>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs text-muted-foreground mb-1 truncate">{tx.balanceFilter}</p>
          <p className={cn("font-display font-bold text-sm sm:text-lg tabular-nums truncate", displayBalance >= 0 ? "text-primary" : "text-red-400")}>
            {fck(displayBalance)}
          </p>
        </div>
      </div>

      {/* ── Filters row ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {serverSearchLoading
              ? <RefreshCw size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
              : <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
            <Input placeholder={tx.search} value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            {search && !serverSearchLoading && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => setShowFilters(v => !v)}
            className={cn("shrink-0 h-9", activeFilters > 0 && "border-primary text-primary")}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline ml-1">{tx.filtersBtn}</span>
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
                  <SelectValue placeholder={tx.allCategories} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__" className="text-xs">
                    {tx.allCategories}
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
                  {tx.noInPeriod.replace("{period}",
                    lang === "en"
                      ? (PERIODS.find(p => p.value === period)?.labelEn ?? "this period")
                      : (PERIODS.find(p => p.value === period)?.label  ?? "este período")
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {(totalCount === 1 ? tx.otherPeriodsSingle : tx.otherPeriodsPlural)
                    .replace("{n}", String(totalCount))}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPeriod("all")}>
                {tx.viewAllTransactions}
              </Button>
            </div>
          ) : (() => {
              const hasFilters = !!(search || catFilter !== "__all__" || dateFrom || dateTo || minValue || maxValue);
              return (
                <EmptyState
                  icon={hasFilters ? Search : ArrowLeftRight}
                  title={hasFilters ? tx.noResultsTitle : tx.empty}
                  description={
                    search ? `${tx.noMatchingSearch} "${search}"`
                    : hasFilters ? tx.noResultsDesc
                    : tx.emptyDesc
                  }
                  action={
                    hasFilters
                      ? <Button size="sm" variant="outline" onClick={clearFilters}><X size={14} /> {tx.filters.clearAll}</Button>
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
                        {rows.length} {rows.length === 1 ? tx.txSingular : tx.txPlural}
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
                              title={tx.changeCategory}
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
                                {t.category?.name ?? common.noCategory}
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

      {/* ── Pagination banner — hidden during server search (results are complete) */}
      {!loading && !serverSearchTxs && transactions.length < totalCount && (
        <div className="glass-card border border-amber-500/20 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {tx.partialLoad
                .replace("{n}", String(transactions.length))
                .replace("{total}", String(totalCount))}
            </p>
            {dbTotals && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {tx.partialLoadTotals.replace("{total}", String(dbTotals.count))}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline" size="sm"
              onClick={loadMore}
              disabled={loadingMore || loadAllLoading}
            >
              {loadingMore
                ? <><RefreshCw size={13} className="animate-spin" /> {tx.loadingMoreBtn}</>
                : <>{tx.loadMore} ({Math.min(PAGE_SIZE, totalCount - transactions.length)} {tx.loadMoreCount})</>}
            </Button>
            {totalCount <= 5000 && (
              <Button
                variant="ghost" size="sm"
                onClick={loadAll}
                disabled={loadAllLoading || loadingMore}
                className="text-muted-foreground hover:text-foreground"
              >
                {loadAllLoading
                  ? <><RefreshCw size={13} className="animate-spin" /> {tx.loadAllLoading}</>
                  : tx.loadAllBtn.replace("{n}", String(totalCount - transactions.length))}
              </Button>
            )}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {filtered.length} {filtered.length === 1 ? tx.txSingular : tx.txPlural}
          {(activeFilters > 0 || search) ? ` ${tx.matchingFilters}` : ""}
          {search && (
            serverSearchTxs
              ? <> — <span className="text-primary/70">{lang === "en" ? "Searched all records" : "Buscou em todos os registros"}</span></>
              : transactions.length < totalCount
                ? <> — <span className="text-amber-400/70">{tx.searchLoadedOnly.replace("{n}", String(transactions.length))}</span></>
                : null
          )}
        </p>
      )}

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen}
        transaction={editTx} categories={categories}
        onSuccess={() => { setDialogOpen(false); load(); refresh(); }} />

      <CsvImportDialog
        open={importOpen}
        onOpenChange={(v) => {
          setImportOpen(v);
          // Re-fetch when dialog closes so the list reflects server-side inserts.
          // Called here (not just in onSuccess) because onSuccess fires while the
          // dialog is still mounted; any silent load() failure there would leave
          // the list stale.  By the time the user dismisses the dialog the async
          // fetch has had time to settle.
          if (!v) { load(); refresh(); }
        }}
        categories={categories}
        onSuccess={() => { load(); refresh(); setPeriod("all"); }}
      />

      <RecurringManagerDialog open={recurringOpen} onOpenChange={setRecurringOpen}
        categories={categories} onSuccess={() => { load(); refresh(); }} />

      {/* Delete all dialog */}
      <Dialog open={deleteAllOpen} onOpenChange={v => { setDeleteAllOpen(v); setDeleteConfirm(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} /> {tx.deleteAllTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4">
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-1">
              <p className="text-sm font-semibold text-red-400">{tx.deleteAllCannotUndo}</p>
              <p className="text-xs text-muted-foreground">
                {tx.deleteAllCountMsg.replace("{n}", String(totalCount))}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{tx.deleteAllConfirmLabel}</p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleDeleteAll()}
                placeholder={tx.deleteAllWord}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/60"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteAllOpen(false); setDeleteConfirm(""); }}>
              {common.cancel}
            </Button>
            <Button
              onClick={handleDeleteAll}
              disabled={deleteConfirm.toUpperCase() !== tx.deleteAllWord || deleting}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
            >
              {deleting
                ? <><RefreshCw size={13} className="animate-spin" /> {tx.deletingBtn}</>
                : <><Trash2 size={14} /> {tx.deleteConfirmBtn.replace("{n}", String(totalCount))}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
