"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, X, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useDashboardRefresh } from "@/lib/context/dashboard-refresh";
import { suggestCategory } from "@/lib/utils/auto-categorize";
import { toast } from "@/lib/hooks/use-toast";
import { getCurrencySymbol } from "@/lib/utils/currency";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";
import type { Category } from "@/lib/types";
import { usePathname } from "next/navigation";

export function QuickAddFab() {
  const { lang, currency } = useLang();
  const tx = appT[lang].quickAdd;
  const { refresh } = useDashboardRefresh();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState("__auto__");
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const sheetTitle = tx.title;

  // Don't show on transactions page (it has its own quick add).
  // NOTE: this flag is computed BEFORE the early return so all hooks
  // are always called in the same order (Rules of Hooks).
  const isHidden = pathname === "/transactions";

  useEffect(() => {
    if (isHidden || !open || categories.length > 0) return;
    createClient().from("categories").select("*")
      .then(({ data }) => setCategories(data ?? []));
  }, [isHidden, open, categories.length]);

  // Safe to return null here — all hooks have already been called above.
  if (isHidden) return null;

  const filteredCats = categories.filter(c => c.type === type);

  const suggested = (() => {
    if (catId !== "__auto__" || title.length < 3) return null;
    try { return suggestCategory(title, filteredCats); } catch { return null; }
  })();

  async function handleSave() {
    const num = parseFloat(amount.replace(",", "."));
    if (!title.trim() || isNaN(num) || num <= 0) return;
    setSaving(true);
    const resolvedCat = catId !== "__auto__" ? catId : (suggested?.id ?? null);
    const res = await fetch("/api/transactions/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(), amount: num,
        type, category_id: resolvedCat,
        date: new Date().toISOString().slice(0, 10),
        is_recurring: false, recurrence_interval: null, notes: null,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error(tx.errorSaving); return; }
    toast.success(tx.added);
    setTitle(""); setAmount(""); setCatId("__auto__"); setOpen(false);
    refresh();
  }

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "lg:hidden fixed right-4 z-40 h-12 w-12 rounded-full shadow-xl flex items-center justify-center transition-all",
          open
            ? "bg-muted text-foreground rotate-45"
            : "bg-primary text-primary-foreground shadow-primary/30"
        )}
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
        aria-label={tx.quickAddTransaction}
      >
        {open ? <X size={20} /> : <Plus size={22} />}
      </button>

      {/* Sheet — Radix Dialog styled as a bottom-sheet. Gains focus-trap,
          Escape-to-close and focus restoration for free. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-label={sheetTitle}
          onOpenAutoFocus={(e) => { e.preventDefault(); amountRef.current?.focus(); }}
          // Override the default centered/zoom/slide-from-top positioning of
          // DialogContent and anchor it as a full-width bottom-sheet, preserving
          // the original safe-area inset and maxHeight calc.
          className={cn(
            "lg:hidden left-0 top-auto bottom-0 translate-x-0 translate-y-0",
            "w-full max-w-none rounded-t-2xl rounded-b-none border-0 border-t border-border/50",
            "bg-card p-4 pb-6 space-y-4 shadow-2xl",
            "data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100",
            "data-[state=closed]:slide-out-to-left-0 data-[state=open]:slide-in-from-left-0",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
          )}
          style={{ bottom: "calc(57px + env(safe-area-inset-bottom, 0px))", maxHeight: "calc(100svh - 80px)" }}
        >
          <div className="flex items-center justify-between">
            <DialogTitle asChild>
              <p className="text-sm font-semibold text-foreground">{sheetTitle}</p>
            </DialogTitle>
          </div>

          {/* Type toggle — radiogroup so SR users hear "radio, checked/not checked".
              Selecting a type still resets the chosen category (existing behavior). */}
          <div role="radiogroup" aria-label={tx.transactionType} className="flex rounded-xl overflow-hidden border border-border text-sm">
            <button
              type="button"
              role="radio"
              aria-checked={type === "expense"}
              onClick={() => { setType("expense"); setCatId("__auto__"); }}
              className={cn("flex-1 py-2.5 font-semibold transition-colors",
                type === "expense" ? "bg-red-500/20 text-red-400" : "text-muted-foreground")}
            >
              − {tx.expense}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={type === "income"}
              onClick={() => { setType("income"); setCatId("__auto__"); }}
              className={cn("flex-1 py-2.5 font-semibold transition-colors",
                type === "income" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground")}
            >
              + {tx.income}
            </button>
          </div>

          {/* Amount */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">{getCurrencySymbol(currency)}</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              aria-label={tx.amount}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full h-12 rounded-xl border border-border bg-background pl-10 pr-4 text-xl font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Description */}
          <input
            type="text"
            placeholder={tx.description}
            aria-label={tx.description}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />

          {/* Category chips */}
          {filteredCats.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCatId("__auto__")}
                className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                  catId === "__auto__"
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground")}
              >
                {suggested ? `✓ ${suggested.name}` : tx.auto}
              </button>
              {filteredCats.slice(0, 6).map(c => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCatId(c.id)}
                  className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                    catId === c.id
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground")}
                >
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">{c.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim() || !amount}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> {tx.saving}</>
              : <><Check size={15} /> {tx.addTransaction}</>}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
