"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PiggyBank, RefreshCw, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";
import type { SavingsGoal } from "@/lib/types";

const schema = z.object({
  amount: z.string().min(1).refine(v => parseFloat(v.replace(",", ".")) > 0),
});
type FormData = z.infer<typeof schema>;

type Mode = "deposit" | "withdraw";

export function GoalDepositDialog({ open, onOpenChange, goal, onSuccess }:
  { open: boolean; onOpenChange: (v: boolean) => void; goal: SavingsGoal; onSuccess: () => void }) {
  const { lang } = useLang();
  const tx = appT[lang].goals.deposit;
  const common = appT[lang].common;
  const [mode, setMode] = useState<Mode>("deposit");
  const [isAutomatic, setIsAutomatic] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function handleClose(v: boolean) {
    onOpenChange(v);
    if (!v) { reset(); setIsAutomatic(false); setMode("deposit"); }
  }

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const added = parseFloat(data.amount.replace(",", "."));

    if (mode === "withdraw") {
      // Withdrawal: take money back out of the goal → income transaction
      const actualRemoved = Math.min(added, goal.current_amount);
      if (actualRemoved <= 0) {
        toast.error(lang === "en" ? "No balance to withdraw" : "Nenhum saldo para retirar");
        return;
      }
      const newAmount = goal.current_amount - actualRemoved;

      const { error } = await supabase
        .from("savings_goals")
        .update({ current_amount: newAmount })
        .eq("id", goal.id);
      if (error) { toast.error(lang === "en" ? "Error withdrawing" : "Erro ao retirar"); return; }

      // Create income transaction so the balance is restored correctly
      try {
        await supabase.from("transactions").insert({
          user_id: goal.user_id,
          title: `${lang === "en" ? "Withdrawal" : "Retirada"}: ${goal.name}`,
          amount: actualRemoved,
          type: "income",
          date: new Date().toISOString().slice(0, 10),
          category_id: null,
          notes: `goal_withdrawal:${goal.id}`,
          is_recurring: false,
          recurrence_interval: null,
        });
      } catch {
        // silently skip if unexpected error
      }

      toast.success(
        lang === "en" ? "Withdrawal made!" : "Retirada realizada!",
        `${formatCurrency(actualRemoved)} ${lang === "en" ? "returned to your balance." : "devolvidos ao seu saldo."}`
      );
      reset();
      setMode("deposit");
      onSuccess();
      return;
    }

    // Deposit mode
    const newAmount = Math.min(goal.target_amount, goal.current_amount + added);
    const actualAdded = newAmount - goal.current_amount; // what actually went in (may be less if goal nearly full)

    if (actualAdded <= 0) {
      toast.error(lang === "en" ? "Goal already completed!" : "Meta já atingida!");
      return;
    }

    const { error } = await supabase
      .from("savings_goals")
      .update({ current_amount: newAmount })
      .eq("id", goal.id);
    if (error) { toast.error(lang === "en" ? "Error depositing" : "Erro ao depositar"); return; }

    // Create saving transaction for the amount that actually went in
    try {
      await supabase.from("transactions").insert({
        user_id: goal.user_id,
        title: `${lang === "en" ? "Deposit" : "Depósito"}: ${goal.name}`,
        amount: actualAdded,
        type: "saving",
        date: new Date().toISOString().slice(0, 10),
        category_id: null,
        notes: `goal_id:${goal.id}`,
        is_recurring: isAutomatic,
        recurrence_interval: isAutomatic ? "monthly" : null,
      });
    } catch {
      // silently skip if DB migration not applied
    }

    const wasCappped = actualAdded < added;
    toast.success(
      isAutomatic
        ? (lang === "en" ? "Auto-deposit set up!" : "Depósito automático configurado!")
        : tx.success,
      wasCappped
        ? (lang === "en"
            ? `${formatCurrency(actualAdded)} deposited — goal completed! 🎉`
            : `${formatCurrency(actualAdded)} depositados — meta concluída! 🎉`)
        : isAutomatic
          ? (lang === "en"
              ? `${formatCurrency(actualAdded)} will be deposited every month.`
              : `${formatCurrency(actualAdded)} será depositado todo mês automaticamente.`)
          : `${formatCurrency(actualAdded)} ${tx.successDesc}`
    );
    reset();
    setIsAutomatic(false);
    onSuccess();
  }

  const goalComplete = goal.current_amount >= goal.target_amount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "withdraw"
              ? (lang === "en" ? "Withdraw from goal" : "Retirar da meta")
              : tx.title}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-4 space-y-4">
          {/* Goal info */}
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: goal.color + "20" }}>
              <PiggyBank size={18} style={{ color: goal.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{goal.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
              </p>
            </div>
            {goalComplete && (
              <span className="text-xs font-semibold text-emerald-400 shrink-0">✓ 100%</span>
            )}
          </div>

          {/* Mode toggle: Deposit / Withdraw */}
          <div className="flex rounded-xl overflow-hidden border border-border text-sm">
            <button
              type="button"
              onClick={() => { setMode("deposit"); setIsAutomatic(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 font-semibold transition-colors",
                mode === "deposit"
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownLeft size={14} />
              {lang === "en" ? "Deposit" : "Depositar"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("withdraw"); setIsAutomatic(false); }}
              disabled={goal.current_amount <= 0}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                mode === "withdraw"
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight size={14} />
              {lang === "en" ? "Withdraw" : "Retirar"}
            </button>
          </div>

          {/* Amount */}
          <form id="deposit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-1.5">
            <Label htmlFor="deposit-amount">
              {mode === "withdraw"
                ? (lang === "en" ? `Amount (max ${formatCurrency(goal.current_amount)})` : `Valor (máx. ${formatCurrency(goal.current_amount)})`)
                : `${tx.amount} *`}
            </Label>
            <Input
              id="deposit-amount"
              placeholder={tx.amountPlaceholder}
              inputMode="decimal"
              {...register("amount")}
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{tx.amountInvalid}</p>}
          </form>

          {/* Auto-deposit toggle — only for deposit mode */}
          {mode === "deposit" && !goalComplete && (
            <button
              type="button"
              onClick={() => setIsAutomatic(v => !v)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3.5 text-sm transition-colors",
                isAutomatic
                  ? "border-primary/40 bg-primary/8 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                isAutomatic ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <RefreshCw size={16} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium leading-none">
                  {lang === "en" ? "Repeat every month" : "Repetir todo mês"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  {lang === "en"
                    ? "This amount will be deposited automatically on the same day each month"
                    : "Este valor será depositado automaticamente todo mês no mesmo dia"}
                </p>
              </div>
              <div className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0", isAutomatic ? "bg-primary" : "bg-muted-foreground/30")}>
                <div className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  isAutomatic ? "translate-x-4" : "translate-x-0.5"
                )} />
              </div>
            </button>
          )}

          {/* Info when withdrawing */}
          {mode === "withdraw" && (
            <p className="text-xs text-amber-400/80 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
              {lang === "en"
                ? "The withdrawn amount will be added back to your account balance as income."
                : "O valor retirado será devolvido ao seu saldo como receita."}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            {common.cancel}
          </Button>
          <Button
            type="submit"
            form="deposit-form"
            disabled={isSubmitting}
            className={mode === "withdraw" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
          >
            {isSubmitting
              ? <><Loader2 size={14} className="animate-spin" /> {tx.submitting}</>
              : mode === "withdraw"
                ? (lang === "en" ? "Withdraw" : "Confirmar retirada")
                : isAutomatic
                  ? (lang === "en" ? "Set up auto-deposit" : "Configurar depósito automático")
                  : tx.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
