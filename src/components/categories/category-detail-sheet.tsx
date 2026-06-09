"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ArrowUpRight, ArrowDownRight, PiggyBank, RefreshCw } from "lucide-react";
import type { Category, Transaction } from "@/lib/types";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { getDateRange, formatGroupDate, type Period } from "@/lib/utils/date";
import { cleanTitle } from "@/lib/utils/parse-santander-pdf";
import { cn } from "@/lib/utils/cn";

const ICON_LABELS: Record<string, string> = {
  briefcase: "💼", "code-2": "💻", "trending-up": "📈", home: "🏠",
  utensils: "🍽️", car: "🚗", "gamepad-2": "🎮", "heart-pulse": "❤️‍🩹",
  "book-open": "📚", shirt: "👕", plane: "✈️", target: "🎯",
  shield: "🛡️", laptop: "💻", "building-2": "🏢", circle: "⚪",
};

const PERIODS: { value: Period; labelEn: string; labelPt: string }[] = [
  { value: "this_month", labelEn: "This month",  labelPt: "Este mês"    },
  { value: "last_month", labelEn: "Last month",  labelPt: "Mês passado" },
  { value: "3months",    labelEn: "3 months",    labelPt: "3 meses"     },
  { value: "year",       labelEn: "This year",   labelPt: "Este ano"    },
  { value: "all",        labelEn: "All time",    labelPt: "Tudo"        },
];

interface Props {
  category: Category | null;
  open: boolean;
  onClose: () => void;
}

export function CategoryDetailSheet({ category, open, onClose }: Props) {
  const { lang, fc } = useLang();
  const tx     = appT[lang].categories;
  const detail = tx.detail;

  const [period, setPeriod]             = useState<Period>("this_month");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(false);
  const [mounted, setMounted]           = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    const dateRange = getDateRange(period);
    const params = new URLSearchParams();
    params.set("categoryId", category.id);
    params.set("limit", "2000");
    if (dateRange) {
      params.set("dateFrom", dateRange.start);
      params.set("dateTo",   dateRange.end);
    }
    const res = await fetch(`/api/transactions/list?${params}`);
    setLoading(false);
    if (!res.ok) return;
    const json = await res.json() as { transactions: Transaction[] };
    setTransactions(json.transactions ?? []);
  }, [category, period]);

  useEffect(() => {
    if (open && category) {
      load();
    } else if (!open) {
      setTransactions([]);
    }
  }, [open, category, load]);

  // Body scroll lock
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else      document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!category || !mounted) return null;

  const isIncome  = category.type === "income";
  const total     = transactions.reduce((s, t) => s + t.amount, 0);
  const count     = transactions.length;
  const avg       = count > 0 ? total / count : 0;
  const totalLabel = isIncome ? detail.totalReceived : detail.totalSpent;

  // Group by date, descending
  const grouped = (() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of transactions) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  })();

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal
        aria-label={category.name}
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 flex flex-col",
          "w-full sm:max-w-lg bg-background border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: category.color + "20" }}
          >
            <span>{ICON_LABELS[category.icon] ?? "📌"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{category.name}</p>
            <p className="text-xs text-muted-foreground">
              {isIncome ? tx.badge.income : tx.badge.expense}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={appT[lang].common.close}
          >
            <X size={16} />
          </button>
        </div>

        {/* Period pills */}
        <div className="px-4 pt-3 pb-2.5 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0 border-b border-border/40">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                period === p.value
                  ? "bg-primary/15 text-primary"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {lang === "en" ? p.labelEn : p.labelPt}
            </button>
          ))}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2 px-4 py-3 shrink-0 border-b border-border/40">
          <div className="glass-card p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">{totalLabel}</p>
            <p
              className={cn("font-display font-bold text-sm tabular-nums truncate", loading && "opacity-40")}
              style={{ color: category.color }}
            >
              {loading ? "—" : fc(total)}
            </p>
          </div>
          <div className="glass-card p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">
              {lang === "en" ? "Count" : "Qtd."}
            </p>
            <p className={cn("font-display font-bold text-sm tabular-nums", loading && "opacity-40")}>
              {loading ? "—" : count}
            </p>
          </div>
          <div className="glass-card p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">{detail.average}</p>
            <p className={cn("font-display font-bold text-sm tabular-nums truncate", loading && "opacity-40")}>
              {loading ? "—" : (count > 0 ? fc(avg) : "—")}
            </p>
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <RefreshCw size={14} className="animate-spin" />
              <span className="text-sm">{appT[lang].common.loading}</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: category.color + "20" }}
              >
                <span>{ICON_LABELS[category.icon] ?? "📌"}</span>
              </div>
              <p className="text-sm text-muted-foreground">{detail.noTransactions}</p>
            </div>
          ) : (
            <div>
              {grouped.map(([dateKey, rows]) => (
                <div key={dateKey}>
                  {/* Date group header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/10 border-b border-border/30">
                    <span className="text-xs font-semibold text-muted-foreground capitalize tracking-wide">
                      {formatGroupDate(dateKey, lang)}
                    </span>
                    <span className="text-xs text-muted-foreground/50">
                      {rows.length}{" "}
                      {rows.length === 1
                        ? detail.txCountSingular
                        : detail.txCount}
                    </span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-border/30">
                    {rows.map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                        {/* Type icon */}
                        <div className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                          t.type === "income"  ? "bg-emerald-500/10"
                          : t.type === "saving" ? "bg-indigo-500/10"
                          : "bg-red-500/10"
                        )}>
                          {t.type === "income"
                            ? <ArrowUpRight   size={13} className="text-emerald-400" />
                            : t.type === "saving"
                            ? <PiggyBank      size={13} className="text-indigo-400"  />
                            : <ArrowDownRight size={13} className="text-red-400"     />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {cleanTitle(t.title)}
                          </p>
                          {t.notes &&
                            !t.notes.startsWith("goal_id:") &&
                            !t.notes.startsWith("goal_withdrawal:") &&
                            !t.notes.startsWith("ofx:") && (
                              <p className="text-[10px] text-muted-foreground/60 truncate italic leading-tight mt-0.5">
                                {t.notes}
                              </p>
                            )}
                        </div>

                        {/* Amount */}
                        <span className={cn(
                          "text-sm font-semibold tabular-nums shrink-0",
                          t.type === "income"  ? "text-emerald-400"
                          : t.type === "saving" ? "text-indigo-400"
                          : "text-red-400"
                        )}>
                          {t.type === "income" ? "+" : "−"}{fc(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
