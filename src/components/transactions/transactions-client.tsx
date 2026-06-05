"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight, PiggyBank, Pencil, Trash2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionRowSkeleton } from "@/components/shared/skeleton";
import { TransactionDialog } from "./transaction-dialog";
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

  const load = useCallback(async () => {
    const supabase = createClient();
    const [txRes, catRes] = await Promise.all([
      supabase.from("transactions").select("*, category:categories(*)").order("date", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
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
          <Button onClick={() => { setEditTx(null); setDialogOpen(true); }} size="sm">
            <Plus size={15} /> {tx.add}
          </Button>
        }
      />

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
    </div>
  );
}
