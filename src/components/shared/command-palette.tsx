"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight, ArrowDownRight, Tag, Target, PieChart, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import type { Transaction, Category, SavingsGoal } from "@/lib/types";

interface SearchResult {
  id: string;
  type: "transaction" | "category" | "goal";
  title: string;
  subtitle: string;
  href: string;
  amount?: number;
  transactionType?: "income" | "expense";
  color?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const supabase = createClient();
    const [txRes, catRes, goalRes] = await Promise.all([
      supabase.from("transactions").select("*, category:categories(*)").ilike("title", `%${q}%`).limit(5),
      supabase.from("categories").select("*").ilike("name", `%${q}%`).limit(4),
      supabase.from("savings_goals").select("*").ilike("name", `%${q}%`).limit(3),
    ]);

    const txResults: SearchResult[] = (txRes.data ?? []).map((t: Transaction) => ({
      id: t.id, type: "transaction",
      title: t.title,
      subtitle: `${t.category?.name ?? "Sem categoria"} · ${formatDate(t.date)}`,
      href: "/transactions",
      amount: t.amount,
      transactionType: t.type,
    }));

    const catResults: SearchResult[] = (catRes.data ?? []).map((c: Category) => ({
      id: c.id, type: "category",
      title: c.name,
      subtitle: c.type === "income" ? "Receita" : "Despesa",
      href: "/categories",
      color: c.color,
    }));

    const goalResults: SearchResult[] = (goalRes.data ?? []).map((g: SavingsGoal) => ({
      id: g.id, type: "goal",
      title: g.name,
      subtitle: `${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)}`,
      href: "/goals",
      color: g.color,
    }));

    setResults([...txResults, ...catResults, ...goalResults]);
    setSelected(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && results[selected]) { router.push(results[selected].href); onClose(); }
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected, router, onClose]);

  // Global Cmd+K / Ctrl+K shortcut — handled by parent

  if (!open) return null;

  const typeIcon = (r: SearchResult) => {
    if (r.type === "transaction") return r.transactionType === "income"
      ? <ArrowUpRight size={15} className="text-emerald-400" />
      : <ArrowDownRight size={15} className="text-red-400" />;
    if (r.type === "category") return <Tag size={15} className="text-indigo-400" />;
    return <Target size={15} className="text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg animate-slide-up">
        <div className="glass-card border border-border/60 shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50">
            <Search size={17} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar transações, categorias, metas..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X size={15} />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <Search size={24} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum resultado para "<span className="text-foreground">{query}</span>"</p>
              </div>
            )}

            {!loading && !query && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">Digite para buscar em transações, categorias e metas</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Use ↑↓ para navegar, Enter para abrir</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="p-1.5 space-y-0.5">
                {results.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => { router.push(r.href); onClose(); }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      i === selected ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      r.type === "transaction" ? (r.transactionType === "income" ? "bg-emerald-500/10" : "bg-red-500/10")
                        : r.type === "category" ? "bg-indigo-500/10"
                        : "bg-amber-500/10"
                    )}>
                      {typeIcon(r)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                    </div>
                    {r.amount !== undefined && (
                      <span className={cn("text-sm font-semibold tabular-nums shrink-0",
                        r.transactionType === "income" ? "text-emerald-400" : "text-red-400"
                      )}>
                        {r.transactionType === "income" ? "+" : "-"}{formatCurrency(r.amount)}
                      </span>
                    )}
                    {r.color && r.type !== "transaction" && (
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd> navegar</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5">↵</kbd> abrir</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5">ESC</kbd> fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
