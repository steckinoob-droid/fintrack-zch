"use client";

import { useState, useEffect, useCallback, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight, ArrowDownRight, PiggyBank, Tag, Target, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n/context";
import type { TransactionType } from "@/lib/types";

interface SearchResult {
  id: string;
  type: "transaction" | "category" | "goal";
  title: string;
  subtitle: string;
  href: string;
  amount?: number;
  transactionType?: TransactionType;
  color?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const router      = useRouter();
  const { lang, fc } = useLang();
  const pt          = lang === "pt";

  const [query,    setQuery]   = useState("");
  const [results,  setResults] = useState<SearchResult[]>([]);
  const [loading,  setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listId   = useId();
  const labelId  = useId();
  // Stable per-option DOM id derived from the result id, used by both the
  // <li role="option"> and aria-activedescendant on the combobox input.
  const optionId = (id: string) => `${listId}-opt-${id}`;

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);

    // Use the server-side search API (service role) so results are never empty
    // due to the browser client's auth.uid()=null RLS issue.
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) { setLoading(false); return; }

    const json = await res.json() as {
      transactions: Array<{ id: string; title: string; amount: number; type: TransactionType; date: string; categoryName: string | null }>;
      categories:   Array<{ id: string; name: string; type: string; color: string }>;
      goals:        Array<{ id: string; name: string; current_amount: number; target_amount: number; color: string }>;
    };

    const noCategory = pt ? "Sem categoria" : "No category";

    const txResults: SearchResult[] = json.transactions.map(t => ({
      id: t.id, type: "transaction",
      title: t.title,
      subtitle: `${t.categoryName ?? noCategory} · ${formatDate(t.date)}`,
      href: "/transactions",
      amount: t.amount,
      transactionType: t.type,
    }));

    const catResults: SearchResult[] = json.categories.map(c => ({
      id: c.id, type: "category",
      title: c.name,
      subtitle: c.type === "income"
        ? (pt ? "Receita" : "Income")
        : (pt ? "Despesa" : "Expense"),
      href: "/categories",
      color: c.color,
    }));

    const goalResults: SearchResult[] = json.goals.map(g => ({
      id: g.id, type: "goal",
      title: g.name,
      subtitle: `${fc(g.current_amount)} / ${fc(g.target_amount)}`,
      href: "/goals",
      color: g.color,
    }));

    setResults([...txResults, ...catResults, ...goalResults]);
    setSelected(0);
    setLoading(false);
  }, [pt, fc]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  // Keyboard navigation. Escape is intentionally NOT handled here — Radix Dialog
  // already closes on Escape; handling it here too would double-fire onClose.
  // Arrow keys only move the highlighted index (and aria-activedescendant); DOM
  // focus stays on the input.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && results[selected]) { router.push(results[selected].href); onClose(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected, router, onClose]);

  function typeIcon(r: SearchResult) {
    if (r.type === "transaction") {
      if (r.transactionType === "income")  return <ArrowUpRight  size={15} className="text-emerald-400" />;
      if (r.transactionType === "saving")  return <PiggyBank      size={15} className="text-indigo-400" />;
      return <ArrowDownRight size={15} className="text-red-400" />;
    }
    if (r.type === "category") return <Tag    size={15} className="text-indigo-400" />;
    return                             <Target size={15} className="text-amber-400" />;
  }

  function txIconBg(r: SearchResult) {
    if (r.type !== "transaction") return r.type === "category" ? "bg-indigo-500/10" : "bg-amber-500/10";
    if (r.transactionType === "income")  return "bg-emerald-500/10";
    if (r.transactionType === "saving")  return "bg-indigo-500/10";
    return "bg-red-500/10";
  }

  function amountColor(r: SearchResult) {
    if (r.transactionType === "income")  return "text-emerald-400";
    if (r.transactionType === "saving")  return "text-indigo-400";
    return "text-red-400";
  }

  function amountPrefix(r: SearchResult) {
    return r.transactionType === "expense" ? "-" : "+";
  }

  const activeId = results[selected] ? optionId(results[selected].id) : undefined;
  const inputLabel = pt ? "Buscar" : "Search";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
        // Anchor near the top (original pt-20 placement) instead of centered, and
        // drop the default padding so the inner sections keep their own spacing.
        className={cn(
          "top-20 translate-y-0 p-0 overflow-hidden border border-border/60"
        )}
      >
        {/* Radix requires a DialogTitle for an accessible name; visually hidden. */}
        <DialogTitle className="sr-only">{pt ? "Busca" : "Search"}</DialogTitle>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 pr-12">
          <Search size={17} className="text-muted-foreground shrink-0" aria-hidden="true" />
          <label htmlFor={labelId} className="sr-only">
            {pt ? "Buscar transações, categorias e metas" : "Search transactions, categories and goals"}
          </label>
          <input
            ref={inputRef}
            id={labelId}
            role="combobox"
            aria-label={inputLabel}
            aria-controls={listId}
            aria-expanded={results.length > 0}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pt
              ? "Buscar transações, categorias, metas..."
              : "Search transactions, categories, goals..."}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={pt ? "Limpar busca" : "Clear search"}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
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
              <Search size={24} className="text-muted-foreground mb-2" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {pt
                  ? <>Nenhum resultado para &ldquo;<span className="text-foreground">{query}</span>&rdquo;</>
                  : <>No results for &ldquo;<span className="text-foreground">{query}</span>&rdquo;</>}
              </p>
            </div>
          )}

          {!loading && !query && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {pt
                  ? "Digite para buscar em transações, categorias e metas"
                  : "Type to search transactions, categories, and goals"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {pt
                  ? "Use ↑↓ para navegar, Enter para abrir"
                  : "Use ↑↓ to navigate, Enter to open"}
              </p>
            </div>
          )}

          {/* listbox is always rendered so aria-controls always resolves */}
          <ul
            id={listId}
            role="listbox"
            aria-label={pt ? "Resultados da busca" : "Search results"}
            className={cn(results.length > 0 ? "p-1.5 space-y-0.5" : "sr-only")}
          >
            {results.map((r, i) => (
              <li
                key={r.id}
                id={optionId(r.id)}
                role="option"
                aria-selected={i === selected}
                onClick={() => { router.push(r.href); onClose(); }}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer",
                  i === selected ? "bg-primary/10" : "hover:bg-muted/50"
                )}
              >
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", txIconBg(r))}>
                  {typeIcon(r)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                </div>
                {r.amount !== undefined && (
                  <span className={cn("text-sm font-semibold tabular-nums shrink-0", amountColor(r))}>
                    {amountPrefix(r)}{fc(r.amount)}
                  </span>
                )}
                {r.color && r.type !== "transaction" && (
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/50 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd>
            {pt ? "navegar" : "navigate"}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 py-0.5">↵</kbd>
            {pt ? "abrir" : "open"}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 py-0.5">ESC</kbd>
            {pt ? "fechar" : "close"}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
