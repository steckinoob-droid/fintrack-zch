"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Trash2, Pencil, CalendarDays, Loader2, Search, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { TransactionDialog } from "./transaction-dialog";
import { cn } from "@/lib/utils/cn";
import { format, addDays, addWeeks, addMonths, addYears, parseISO } from "date-fns";
import type { Transaction, Category } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  onSuccess: () => void;
}

function getNextExpected(parent: Transaction): string | null {
  if (!parent.recurrence_interval) return null;
  const base = parseISO(parent.date);
  let next: Date;
  switch (parent.recurrence_interval) {
    case "daily":   next = addDays(base, 1); break;
    case "weekly":  next = addWeeks(base, 1); break;
    case "monthly": next = addMonths(base, 1); break;
    case "yearly":  next = addYears(base, 1); break;
    default: return null;
  }
  // Advance to the upcoming occurrence (≥ today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (next < today) {
    switch (parent.recurrence_interval) {
      case "daily":   next = addDays(next, 1); break;
      case "weekly":  next = addWeeks(next, 1); break;
      case "monthly": next = addMonths(next, 1); break;
      case "yearly":  next = addYears(next, 1); break;
    }
  }
  return format(next, "yyyy-MM-dd");
}

export function RecurringManagerDialog({ open, onOpenChange, categories, onSuccess }: Props) {
  const { lang, fc } = useLang();
  const [parents, setParents]   = useState<Transaction[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editTx, setEditTx]     = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [search, setSearch]     = useState("");

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filteredParents = search
    ? parents.filter(p =>
        norm(p.title).includes(norm(search)) ||
        (p.category?.name && norm(p.category.name).includes(norm(search))) ||
        (p.recurrence_interval && norm(p.recurrence_interval).includes(norm(search)))
      )
    : parents;

  const load = useCallback(async () => {
    setLoading(true);
    // Use the server-side API (service role) to bypass browser client RLS issue.
    const res = await fetch("/api/transactions/list?isRecurring=true&limit=500");
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json() as { transactions: Transaction[]; categories: Category[] };
    const catMap = new Map(json.categories.map(c => [c.id, c]));
    setParents(json.transactions.map(t => ({
      ...t,
      category: t.category_id ? catMap.get(t.category_id) : undefined,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/transactions/delete-recurring?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir");
      return;
    }
    toast.success(
      lang === "en" ? "Recurring transaction deleted" : "Transação recorrente excluída",
      lang === "en" ? "All future occurrences removed." : "Todas as ocorrências futuras foram removidas."
    );
    setParents(prev => prev.filter(p => p.id !== id));
    onSuccess();
  }

  const intervalLabel = (interval: string | null) => {
    if (!interval) return "";
    const map: Record<string, Record<"en" | "pt", string>> = {
      daily:   { en: "Daily",        pt: "Diariamente"   },
      weekly:  { en: "Weekly",       pt: "Semanalmente"  },
      monthly: { en: "Every month",  pt: "Todo mês"      },
      yearly:  { en: "Every year",   pt: "Todo ano"      },
    };
    return map[interval]?.[lang] ?? interval;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw size={16} className="text-primary" />
              {lang === "en" ? "Recurring Transactions" : "Transações Recorrentes"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-4 space-y-2">
            {/* Search input */}
            {!loading && parents.length > 0 && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={lang === "en" ? "Filter by name, category..." : "Filtrar por nome, categoria..."}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X size={13} />
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={22} className="animate-spin text-muted-foreground" />
              </div>
            ) : parents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center">
                  <RefreshCw size={20} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {lang === "en" ? "No recurring transactions" : "Nenhuma transação recorrente"}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {lang === "en"
                    ? "When you create a transaction and enable 'Recurring', it will appear here."
                    : "Ao criar uma transação com 'Recorrente' habilitado, ela aparecerá aqui."}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {filteredParents.length === 0 && search && (
                  <p className="text-center text-xs text-muted-foreground py-6">
                    {lang === "en" ? `No results for "${search}"` : `Nenhum resultado para "${search}"`}
                  </p>
                )}
                {filteredParents.map(p => {
                  const nextDate = getNextExpected(p);
                  const typeColor =
                    p.type === "income"  ? "text-emerald-400" :
                    p.type === "saving"  ? "text-indigo-400"  :
                                           "text-red-400";
                  const typeBg =
                    p.type === "income"  ? "bg-emerald-500/10" :
                    p.type === "saving"  ? "bg-indigo-500/10"  :
                                           "bg-red-500/10";

                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 rounded-xl border border-border/50 p-3.5 hover:bg-muted/20 transition-colors"
                    >
                      {/* Type icon */}
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", typeBg)}>
                        <RefreshCw size={14} className={typeColor} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className={cn("text-xs font-semibold tabular-nums", typeColor)}>
                            {p.type === "income" ? "+" : "−"}{fc(p.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {intervalLabel(p.recurrence_interval)}
                          </span>
                          {p.category?.name && (
                            <span className="text-xs text-muted-foreground">
                              · {p.category.name}
                            </span>
                          )}
                        </div>
                        {nextDate && (
                          <div className="flex items-center gap-1 mt-1">
                            <CalendarDays size={10} className="text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">
                              {lang === "en" ? "Next:" : "Próximo:"}{" "}
                              <span className="text-foreground font-medium">{nextDate}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditTx(p); setEditOpen(true); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title={lang === "en" ? "Edit" : "Editar"}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title={lang === "en" ? "Delete (all future occurrences)" : "Excluir (todas as ocorrências futuras)"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && parents.length > 0 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                {search ? filteredParents.length : parents.length}{search ? ` / ${parents.length}` : ""} {lang === "en"
                  ? `recurring transaction${parents.length !== 1 ? "s" : ""} active`
                  : `transação${parents.length !== 1 ? "ões" : ""} recorrente${parents.length !== 1 ? "s" : ""} ativa${parents.length !== 1 ? "s" : ""}`}
              </p>
            )}

            <div className="pt-2 rounded-lg bg-muted/20 p-3 text-xs text-muted-foreground">
              {lang === "en"
                ? "⚠️ Deleting a recurring transaction removes the template AND all past/future generated occurrences."
                : "⚠️ Ao excluir uma transação recorrente, o modelo E todas as ocorrências geradas serão removidas."}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editTx && (
        <TransactionDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          transaction={editTx}
          categories={categories}
          onSuccess={() => {
            setEditOpen(false);
            load();
            onSuccess();
          }}
        />
      )}
    </>
  );
}
