"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PiggyBank, RefreshCw, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/hooks/use-toast";
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
  const { lang, fc } = useLang();
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
    const added = parseFloat(data.amount.replace(",", "."));

    if (mode === "withdraw") {
      const actualRemoved = Math.min(added, goal.current_amount);
      if (actualRemoved <= 0) {
        toast.error(tx.noBalanceToWithdraw);
        return;
      }
      const newAmount = goal.current_amount - actualRemoved;

      const goalRes = await fetch("/api/goals/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal.id, current_amount: newAmount }),
      });
      if (!goalRes.ok) { toast.error(tx.errWithdrawing); return; }

      try {
        await fetch("/api/transactions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${tx.withdrawalTitle}: ${goal.name}`,
            amount: actualRemoved, type: "income",
            date: new Date().toISOString().slice(0, 10),
            category_id: null, notes: `goal_withdrawal:${goal.id}`,
            is_recurring: false, recurrence_interval: null,
          }),
        });
      } catch { /* silently skip */ }

      toast.success(
        tx.withdrawalMade,
        `${fc(actualRemoved)} ${tx.returnedToBalance}`
      );
      reset();
      setMode("deposit");
      onSuccess();
      return;
    }

    // Deposit mode
    const newAmount = Math.min(goal.target_amount, goal.current_amount + added);
    const actualAdded = newAmount - goal.current_amount;

    if (actualAdded <= 0) {
      toast.error(tx.goalAlreadyCompleted);
      return;
    }

    const goalRes = await fetch("/api/goals/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: goal.id, current_amount: newAmount }),
    });
    if (!goalRes.ok) { toast.error(tx.errDepositing); return; }

    try {
      await fetch("/api/transactions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${tx.depositTitle}: ${goal.name}`,
          amount: actualAdded, type: "saving",
          date: new Date().toISOString().slice(0, 10),
          category_id: null, notes: `goal_id:${goal.id}`,
          is_recurring: isAutomatic,
          recurrence_interval: isAutomatic ? "monthly" : null,
        }),
      });
    } catch { /* silently skip */ }

    const wasCappped = actualAdded < added;
    toast.success(
      isAutomatic
        ? tx.autoDepositSetUp
        : tx.success,
      wasCappped
        ? tx.depositedGoalCompleted.replace("{amount}", fc(actualAdded))
        : isAutomatic
          ? tx.willBeDepositedMonthly.replace("{amount}", fc(actualAdded))
          : `${fc(actualAdded)} ${tx.successDesc}`
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
              ? tx.withdrawFromGoal
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
                {fc(goal.current_amount)} / {fc(goal.target_amount)}
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
              {tx.depositBtn}
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
              {tx.withdrawBtn}
            </button>
          </div>

          {/* Amount */}
          <form id="deposit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-1.5">
            <Label htmlFor="deposit-amount">
              {mode === "withdraw"
                ? tx.amountMaxLabel.replace("{max}", fc(goal.current_amount))
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
                  {tx.repeatEveryMonth}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  {tx.repeatEveryMonthDesc}
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
              {tx.withdrawInfo}
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
                ? tx.confirmWithdraw
                : isAutomatic
                  ? tx.setUpAutoDeposit
                  : tx.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
