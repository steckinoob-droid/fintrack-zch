"use client";

const ICON_LABELS: Record<string, string> = {
  briefcase: "💼", "code-2": "💻", "trending-up": "📈", home: "🏠",
  utensils: "🍽️", car: "🚗", "gamepad-2": "🎮", "heart-pulse": "❤️‍🩹",
  "book-open": "📚", shirt: "👕", plane: "✈️", target: "🎯",
  shield: "🛡️", laptop: "💻", "building-2": "🏢", circle: "⚪",
};

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, RefreshCw, PiggyBank, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";
import { suggestCategory } from "@/lib/utils/auto-categorize";
import type { Transaction, Category } from "@/lib/types";
import { usePlan } from "@/lib/hooks/use-plan";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { FREE_RECURRING_LIMIT } from "@/lib/utils/plan-limits";

const schema = z.object({
  title:               z.string().min(1),
  amount:              z.string().min(1).refine(v => parseFloat(v.replace(",", ".")) > 0),
  type:                z.enum(["income", "expense"]),
  category_id:         z.string().optional(),
  date:                z.string().min(1),
  notes:               z.string().optional(),
  is_recurring:        z.boolean().optional(),
  recurrence_interval: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean; onOpenChange: (v: boolean) => void;
  transaction: Transaction | null; categories: Category[];
  onSuccess: () => void;
}

export function TransactionDialog({ open, onOpenChange, transaction, categories, onSuccess }: Props) {
  const { lang } = useLang();
  const tx = appT[lang].transactions.dialog;
  const common = appT[lang].common;
  const isEdit = !!transaction;
  const isSavingTx = !!(transaction && transaction.type === "saving");
  const [isRecurring, setIsRecurring] = useState(false);
  const plan = usePlan();
  const [recurringCount, setRecurringCount] = useState<number | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "expense", date: new Date().toISOString().slice(0, 10) },
  });
  const type         = watch("type");
  const watchedTitle = watch("title");
  const filteredCats = categories.filter(c => c.type === type);

  // Auto-suggest category when typing title (only for new transactions)
  const prevTitleRef = useRef("");
  useEffect(() => {
    try {
      if (isEdit || !open) return;
      if (!watchedTitle || watchedTitle === prevTitleRef.current) return;
      prevTitleRef.current = watchedTitle;
      if (watchedTitle.length < 3) return;
      const currentCat = watch("category_id");
      if (currentCat) return; // don't override a manual selection
      const suggested = suggestCategory(watchedTitle, filteredCats);
      if (suggested) setValue("category_id", suggested.id);
    } catch {
      // silently ignore auto-suggest errors — never crash the dialog
    }
  }, [watchedTitle, type, open, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      if (transaction) {
        reset({ title: transaction.title, amount: String(transaction.amount), type: transaction.type === "saving" ? "expense" : transaction.type as "income" | "expense",
          category_id: transaction.category_id ?? "", date: transaction.date,
          notes: (transaction.notes?.startsWith("ofx:") || transaction.notes?.startsWith("goal_id:") || transaction.notes?.startsWith("goal_withdrawal:") ? "" : transaction.notes) ?? "", is_recurring: transaction.is_recurring,
          recurrence_interval: transaction.recurrence_interval ?? undefined });
        setIsRecurring(transaction.is_recurring);
      } else {
        reset({ type: "expense", date: new Date().toISOString().slice(0, 10) });
        setIsRecurring(false);
      }
    }
  }, [open, transaction, reset]);

  // Fetch recurring count for Free users opening a NEW transaction dialog.
  // Pro users skip this (no limit). Edit dialogs skip this (not creating).
  useEffect(() => {
    if (!open || transaction || plan !== "free") return;
    fetch("/api/transactions/list?isRecurring=true&limit=1")
      .then(r => r.ok ? r.json() : null)
      .then(json => setRecurringCount(json?.total ?? 0))
      .catch(() => setRecurringCount(0));
  }, [open, transaction, plan]);

  // True only when plan has resolved to "free", this is a new tx, and the count is at/above limit.
  const recurringLimitReached = !isEdit && plan === "free" && recurringCount !== null && recurringCount >= FREE_RECURRING_LIMIT;

  async function onSubmit(data: FormData) {
    // Server-side re-check: block if Free user would exceed recurring limit at submit time.
    if (!isEdit && isRecurring && plan === "free") {
      const res = await fetch("/api/transactions/list?isRecurring=true&limit=1");
      const json = res.ok ? await res.json() : null;
      const liveCount: number = json?.total ?? 0;
      if (liveCount >= FREE_RECURRING_LIMIT) {
        setUpgradeOpen(true);
        return;
      }
    }

    const payload = {
      title: data.title,
      amount: parseFloat(data.amount.replace(",", ".")),
      type: isSavingTx ? "saving" : data.type,
      category_id: data.category_id || null,
      date: data.date,
      notes: data.notes || null,
      is_recurring: isRecurring,
      recurrence_interval: isRecurring ? (data.recurrence_interval ?? "monthly") : null,
    };

    if (isEdit) {
      const res = await fetch("/api/transactions/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transaction!.id, ...payload }),
      });
      if (!res.ok) { toast.error(lang === "en" ? "Error saving" : "Erro ao salvar"); return; }
    } else {
      const res = await fetch("/api/transactions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error(lang === "en" ? "Error saving" : "Erro ao salvar"); return; }
    }

    toast.success(isEdit
      ? (lang === "en" ? "Transaction updated" : "Transação atualizada")
      : (lang === "en" ? "Transaction added"   : "Transação adicionada"));
    onSuccess();
  }

  const RECURRENCE = [
    { value: "daily",   label: tx.daily   },
    { value: "weekly",  label: tx.weekly  },
    { value: "monthly", label: tx.monthly },
    { value: "yearly",  label: tx.yearly  },
  ];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? tx.edit : tx.new}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-4 space-y-4">
          {isSavingTx ? (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/8 px-3 py-2.5">
              <PiggyBank size={14} className="text-indigo-400 shrink-0" />
              <p className="text-xs text-indigo-400 font-medium">
                {lang === "en" ? "Goal deposit — type is locked" : "Aporte em meta — tipo não pode ser alterado"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{tx.type}</Label>
              <Tabs value={type} onValueChange={v => { setValue("type", v as "income" | "expense"); setValue("category_id", ""); }}>
                <TabsList className="w-full">
                  <TabsTrigger value="expense" className="flex-1">{tx.expense}</TabsTrigger>
                  <TabsTrigger value="income"  className="flex-1">{tx.income}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tx-title">{tx.titleField} *</Label>
            <Input id="tx-title" placeholder={tx.titlePlaceholder} {...register("title")} aria-invalid={!!errors.title} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">{tx.amount} *</Label>
              <Input id="tx-amount" placeholder={tx.amountPlaceholder} inputMode="decimal" {...register("amount")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">{tx.date} *</Label>
              <Input id="tx-date" type="date" {...register("date")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{tx.category}</Label>
            {filteredCats.length === 0 ? (
              <div className="flex h-9 w-full items-center rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground">
                {tx.noCategoryMsg}{" "}
                <a href="/categories" className="ml-1 text-primary underline">{tx.categoriesLink}</a>
              </div>
            ) : (
              <Select onValueChange={v => setValue("category_id", v)} defaultValue={transaction?.category_id ?? ""}>
                <SelectTrigger><SelectValue placeholder={tx.categoryPlaceholder} /></SelectTrigger>
                <SelectContent>
                  {filteredCats.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm">
                          {ICON_LABELS[cat.icon] ?? "📌"}
                        </span>
                        <span className="leading-none">{cat.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Recurring toggle */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                if (recurringLimitReached) { setUpgradeOpen(true); return; }
                setIsRecurring(v => !v);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                recurringLimitReached
                  ? "border-border bg-muted/20 text-muted-foreground/60 cursor-pointer"
                  : isRecurring
                  ? "border-primary/40 bg-primary/8 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                recurringLimitReached ? "bg-muted text-muted-foreground/50"
                  : isRecurring ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {recurringLimitReached ? <Lock size={14} /> : <RefreshCw size={15} />}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium leading-none">{tx.recurring}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {recurringLimitReached ? tx.recurringGate.limitReached : tx.recurringDesc}
                </p>
              </div>
              {recurringLimitReached ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary ring-1 ring-primary/25">
                  {tx.recurringGate.limitBadge}
                </span>
              ) : (
                <div className={cn("h-5 w-9 rounded-full transition-colors relative", isRecurring ? "bg-primary" : "bg-muted-foreground/30")}>
                  <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    isRecurring ? "translate-x-4" : "translate-x-0.5")} />
                </div>
              )}
            </button>
            {isRecurring && !recurringLimitReached && (
              <Select onValueChange={v => setValue("recurrence_interval", v as any)}
                defaultValue={transaction?.recurrence_interval ?? "monthly"}>
                <SelectTrigger><SelectValue placeholder={tx.frequency} /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-notes">{tx.notes}</Label>
            <Input id="tx-notes" placeholder={tx.notesPlaceholder} {...register("notes")} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> {common.saving}</> : isEdit ? common.save : common.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <UpgradeModal
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
      title={tx.recurringGate.modalTitle}
      description={tx.recurringGate.modalDesc}
      cta={tx.recurringGate.modalCta}
      highlightBenefit={2}
    />
    </>
  );
}
