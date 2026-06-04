"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Filter, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Pencil, Trash2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionRowSkeleton } from "@/components/shared/skeleton";
import { TransactionDialog } from "./transaction-dialog";
import type { Transaction, Category } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { toast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

export function TransactionsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "income" | "expense">("all");
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Transação excluída");
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = transactions.filter((tx) => {
    if (tab !== "all" && tx.type !== tab) return false;
    if (search && !tx.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transações"
        description="Gerencie todas as suas movimentações financeiras"
        action={
          <Button onClick={() => { setEditTx(null); setDialogOpen(true); }} size="sm">
            <Plus size={15} />Adicionar
          </Button>
        }
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Receitas filtradas</p>
          <p className="font-display font-bold text-lg text-emerald-400 tabular-nums">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Despesas filtradas</p>
          <p className="font-display font-bold text-lg text-red-400 tabular-nums">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="glass-card p-4 hidden lg:block">
          <p className="text-xs text-muted-foreground mb-1">Saldo do filtro</p>
          <p className={cn("font-display font-bold text-lg tabular-nums", totalIncome - totalExpense >= 0 ? "text-primary" : "text-red-400")}>
            {formatCurrency(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar transação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="income">Receitas</TabsTrigger>
            <TabsTrigger value="expense">Despesas</TabsTrigger>
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
          <EmptyState
            icon={ArrowLeftRight}
            title="Nenhuma transação encontrada"
            description={search ? "Tente outros termos de busca." : "Adicione sua primeira transação."}
            action={
              <Button size="sm" onClick={() => { setEditTx(null); setDialogOpen(true); }}>
                <Plus size={15} /> Adicionar
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  tx.type === "income" ? "bg-emerald-500/10" : "bg-red-500/10"
                )}>
                  {tx.type === "income"
                    ? <ArrowUpRight size={16} className="text-emerald-400" />
                    : <ArrowDownRight size={16} className="text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{tx.title}</p>
                    {tx.is_recurring && (
                      <span title="Recorrente" className="shrink-0 text-primary">
                        <RefreshCw size={11} />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {tx.category && (
                      <span className="text-xs text-muted-foreground">{tx.category.name}</span>
                    )}
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                  </div>
                </div>
                <span className={cn("text-sm font-semibold tabular-nums",
                  tx.type === "income" ? "text-emerald-400" : "text-red-400"
                )}>
                  {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                </span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={() => { setEditTx(tx); setDialogOpen(true); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Editar"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label="Excluir"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editTx}
        categories={categories}
        onSuccess={() => { setDialogOpen(false); load(); }}
      />
    </div>
  );
}
