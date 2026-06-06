"use client";

import { useState, useEffect } from "react";
import { Plus, X, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDashboardRefresh } from "@/lib/context/dashboard-refresh";
import { suggestCategory } from "@/lib/utils/auto-categorize";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { cn } from "@/lib/utils/cn";
import type { Category } from "@/lib/types";
import { usePathname } from "next/navigation";

export function QuickAddFab() {
  const { lang } = useLang();
  const { refresh } = useDashboardRefresh();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState("__auto__");
  const [saving, setSaving] = useState(false);

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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const resolvedCat = catId !== "__auto__" ? catId : (suggested?.id ?? null);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id, title: title.trim(), amount: num,
      type, category_id: resolvedCat,
      date: new Date().toISOString().slice(0, 10),
      is_recurring: false, recurrence_interval: null, notes: null,
    });
    setSaving(false);
    if (error) { toast.error(lang === "en" ? "Error saving" : "Erro ao salvar"); return; }
    toast.success(lang === "en" ? "Added!" : "Adicionada!");
    setTitle(""); setAmount(""); setCatId("__auto__"); setOpen(false);
    refresh();
  }

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "lg:hidden fixed bottom-[72px] right-4 z-40 h-12 w-12 rounded-full shadow-xl flex items-center justify-center transition-all",
          open
            ? "bg-muted text-foreground rotate-45"
            : "bg-primary text-primary-foreground shadow-primary/30"
        )}
        aria-label={lang === "en" ? "Quick add transaction" : "Adicionar transação"}
      >
        {open ? <X size={20} /> : <Plus size={22} />}
      </button>

      {/* Sheet */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Bottom sheet */}
          <div className="lg:hidden fixed bottom-[57px] left-0 right-0 z-40 bg-card border-t border-border/50 rounded-t-2xl p-4 pb-6 space-y-4 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {lang === "en" ? "Quick add" : "Adicionar rápido"}
              </p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {/* Type toggle */}
            <div className="flex rounded-xl overflow-hidden border border-border text-sm">
              <button
                onClick={() => { setType("expense"); setCatId("__auto__"); }}
                className={cn("flex-1 py-2.5 font-semibold transition-colors",
                  type === "expense" ? "bg-red-500/20 text-red-400" : "text-muted-foreground")}
              >
                − {lang === "en" ? "Expense" : "Despesa"}
              </button>
              <button
                onClick={() => { setType("income"); setCatId("__auto__"); }}
                className={cn("flex-1 py-2.5 font-semibold transition-colors",
                  type === "income" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground")}
              >
                + {lang === "en" ? "Income" : "Receita"}
              </button>
            </div>

            {/* Amount */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full h-12 rounded-xl border border-border bg-background pl-10 pr-4 text-xl font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                autoFocus
              />
            </div>

            {/* Description */}
            <input
              type="text"
              placeholder={lang === "en" ? "Description" : "Descrição"}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            {/* Category chips */}
            {filteredCats.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCatId("__auto__")}
                  className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                    catId === "__auto__"
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {suggested ? `✓ ${suggested.name}` : (lang === "en" ? "Auto" : "Auto")}
                </button>
                {filteredCats.slice(0, 6).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCatId(c.id)}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                      catId === c.id
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground")}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !title.trim() || !amount}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
            >
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> {lang === "en" ? "Saving..." : "Salvando..."}</>
                : <><Check size={15} /> {lang === "en" ? "Add transaction" : "Adicionar transação"}</>}
            </button>
          </div>
        </>
      )}
    </>
  );
}
