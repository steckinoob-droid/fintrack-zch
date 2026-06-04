"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, PieChart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { BudgetDialog } from "./budget-dialog";
import { toast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import { getCurrentMonth, formatMonthYear } from "@/lib/utils/date";
import type { Budget, Category, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { parseISO } from "date-fns";

export function BudgetsClient() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const currentMonth = getCurrentMonth();

  const load = useCallback(async () => {
    const supabase = createClient();
    const [bRes, cRes, tRes] = await Promise.all([
      supabase.from("budgets").select("*, category:categories(*)").eq("month", currentMonth),
      supabase.from("categories").select("*").eq("type", "expense").order("name"),
      supabase.from("transactions").select("*").eq("type", "expense")
        .gte("date", currentMonth).lte("date", currentMonth.replace("-01", "-31")),
    ]);
    const bs: Budget[] = bRes.data ?? [];
    const txs: Transaction[] = tRes.data ?? [];
    const withSpent = bs.map((b) => ({
      ...b,
      spent: txs.filter((t) => t.category_id === b.category_id).reduce((s, t) => s + t.amount, 0),
    }));
    setBudgets(withSpent);
    setCategories(cRes.data ?? []);
    setTransactions(txs);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Orçamento excluído");
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamentos"
        description={`Controle seus gastos — ${formatMonthYear(currentMonth)}`}
        action={
          <Button onClick={() => { setEditBudget(null); setDialogOpen(true); }} size="sm">
            <Plus size={15} /> Novo orçamento
          </Button>
        }
      />

      {/* Month summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Orçado</p>
          <p className="font-display font-bold text-lg tabular-nums text-foreground">{formatCurrency(totalBudgeted)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Gasto</p>
          <p className={cn("font-display font-bold text-lg tabular-nums", totalSpent > totalBudgeted ? "text-red-400" : "text-foreground")}>
            {formatCurrency(totalSpent)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Disponível</p>
          <p className={cn("font-display font-bold text-lg tabular-nums", totalBudgeted - totalSpent >= 0 ? "text-emerald-400" : "text-red-400")}>
            {formatCurrency(totalBudgeted - totalSpent)}
          </p>
        </div>
      </div>

      {/* Budget cards */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-24 shimmer" />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={PieChart}
            title="Nenhum orçamento"
            description="Defina limites de gasto por categoria para este mês."
            action={<Button size="sm" onClick={() => setDialogOpen(true)}><Plus size={15} /> Criar</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {budgets.map((b) => {
            const spent = b.spent ?? 0;
            const pct = Math.min(100, Math.round((spent / b.amount) * 100));
            const over = pct >= 100;
            const warn = pct >= 80;
            const remaining = b.amount - spent;

            return (
              <div key={b.id} className="glass-card-hover p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (b.category?.color ?? "#10b981") + "20" }}>
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: b.category?.color ?? "#10b981" }} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{b.category?.name ?? "Sem categoria"}</p>
                      <p className="text-xs text-muted-foreground">
                        {over ? "⚠️ Limite excedido" : warn ? "⚡ Quase no limite" : `${formatCurrency(remaining)} restantes`}
                      </p>
                    </div>
                  </div>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button onClick={() => { setEditBudget(b); setDialogOpen(true); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(b.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <Progress
                  value={pct}
                  className="h-2 mb-2"
                  indicatorClassName={over ? "bg-red-500" : warn ? "bg-amber-500" : "bg-primary"}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatCurrency(spent)} gasto</span>
                  <span className="font-medium tabular-nums">{pct}% · {formatCurrency(b.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        budget={editBudget}
        categories={categories}
        currentMonth={currentMonth}
        onSuccess={() => { setDialogOpen(false); load(); }}
      />
    </div>
  );
}
