"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight, PiggyBank, Pencil, Trash2, RefreshCw, Upload, Zap, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionRowSkeleton } from "@/components/shared/skeleton";
import { TransactionDialog } from "./transaction-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { suggestCategory } from "@/lib/utils/auto-categorize";
import type { Transaction, Category } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

export function TransactionsClient() {
  const { lang } = useLang();
  const tx = appT[lang].transactions;
  const common = appT[lang].common;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [tab, setTab]                   = useState<"all" | "income" | "expense" | "saving">("all");
  const [editTx, setEditTx]             = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [importOpen, setImportOpen]     = useState(false);
  const [quickOpen, setQuickOpen]       = useState(false);
  const [quickTitle, setQuickTitle]     = useState("");
  const [quickAmount, setQuickAmount]   = useState("");
  const [quickType, setQuickType]       = useState<"income" | "expense">("expense");
  const [quickCatId, setQuickCatId]     = useState("__auto__");
  const [quickLoading, setQuickLoading] = useState(false);

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

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir"); return; }
    toast.success(lang === "en" ? "Transaction deleted" : "Transação excluída");
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  const filtered = transactions.filter(t => {
    if (tab !== "all" && t.type !== tab) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
    if (error) { toast.error(lang === "en" ? "Error adding" : "Erro ao adicionar"); return; }
    toast.success(lang === "en" ? "Transaction added" : "Transação adicionada");
    setQuickTitle(""); setQuickAmount(""); setQuickCatId("__auto__");
    load();
  }

  // Live category preview for Quick Add (auto-detect mode)
  const liveQuickCat = useMemo(() => {
    if (quickCatId !== "__auto__" || quickTitle.length < 3) return null;
    try {
      const typedCats = categories.filter(c => c.type === quickType);
      return suggestCategory(quickTitle, typedCats);
    } catch { return null; }
  }, [quickTitle, quickType, quickCatId, categories]);

  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalSaving  = filtered.filter(t => t.type === "saving").reduce((s, t) => s + t.amount, 0);
  // balance = income - expenses - savings (savings are outflows from liquid cash)
  const netBalance   = totalIncome - totalExpense - totalSaving;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx.title}
        description={tx.description}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload size={14} /> CSV
            </Button>
            <Button
              variant={quickOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setQuickOpen(!quickOpen)}
            >
              <Zap size={14} /> {lang === "en" ? "Quick" : "Rápido"}
            </Button>
            <Button size="sm" onClick={() => { setEditTx(null); setDialogOpen(true); }}>
              <Plus size={15} /> {tx.add}
            </Button>
          </div>
        }
      />

      {/* Quick Add */}
      {quickOpen && (
        <div className="glass-card p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Zap size={12} className="text-primary" />
            {lang === "en" ? "Quick add" : "Adicionar rápido"}
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg overflow-hidden border border-border text-xs shrink-0">
              <button onClick={() => { setQuickType("expense"); setQuickCatId("__auto__"); }}
                className={cn("px-3 py-1.5 transition-colors", quickType === "expense" ? "bg-red-500/20 text-red-400 font-medium" : "text-muted-foreground hover:text-foreground")}>
                − {lang === "en" ? "Expense" : "Despesa"}
              </button>
              <button onClick={() => { setQuickType("income"); setQuickCatId("__auto__"); }}
                className={cn("px-3 py-1.5 transition-colors", quickType === "income" ? "bg-emerald-500/20 text-emerald-400 font-medium" : "text-muted-foreground hover:text-foreground")}>
                + {lang === "en" ? "Income" : "Receita"}
              </button>
            </div>
            <Input className="flex-1 min-w-32 h-8 text-sm"
              placeholder={lang === "en" ? "Description (auto-categorizes)" : "Descrição (auto-categoriza)"}
              value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuickAdd()} />
            <Input className="w-28 h-8 text-sm" placeholder="R$ 0,00" inputMode="decimal"
              value={quickAmount} onChange={e => setQuickAmount(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleQuickAdd()} />
            <div className="flex flex-col gap-0.5">
              <Select value={quickCatId} onValueChange={setQuickCatId}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
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

      {/* Summary */}
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
          <p className={cn("font-display font-bold text-lg tabular-nums",
            netBalance >= 0 ? "text-primary" : "text-red-400")}>
            {formatCurrency(netBalance)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={tx.search} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">{tx.allTab}</TabsTrigger>
            <TabsTrigger value="income">{tx.incomeTab}</TabsTrigger>
            <TabsTrigger value="expense">{tx.expenseTab}</TabsTrigger>
            <TabsTrigger value="saving">{tx.savingTab}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => <TransactionRowSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title={tx.empty}
            description={search ? tx.emptySearch : tx.emptyDesc}
            action={<Button size="sm" onClick={() => { setEditTx(null); setDialogOpen(true); }}><Plus size={15} /> {tx.add}</Button>}
          />
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                    {t.is_recurring && (
                      <span title={tx.recurring} className="shrink-0 text-primary"><RefreshCw size={11} /></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{t.category?.name ?? common.noCategory}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                  </div>
                </div>
                <span className={cn("text-sm font-semibold tabular-nums",
                  t.type === "income" ? "text-emerald-400"
                  : t.type === "saving" ? "text-indigo-400"
                  : "text-red-400")}>
                  {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                </span>
                <div className="hidden group-hover:flex items-center gap-1">
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

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen}
        transaction={editTx} categories={categories}
        onSuccess={() => { setDialogOpen(false); load(); }} />

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen}
        categories={categories} onSuccess={load} />
    </div>
  );
}
