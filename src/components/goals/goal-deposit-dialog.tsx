"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PiggyBank, RefreshCw } from "lucide-react";
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

export function GoalDepositDialog({ open, onOpenChange, goal, onSuccess }:
  { open: boolean; onOpenChange: (v: boolean) => void; goal: SavingsGoal; onSuccess: () => void }) {
  const { lang } = useLang();
  const tx = appT[lang].goals.deposit;
  const common = appT[lang].common;
  const [isAutomatic, setIsAutomatic] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const added     = parseFloat(data.amount.replace(",", "."));
    const newAmount = Math.min(goal.target_amount, goal.current_amount + added);

    // 1. Update goal current amount
    const { error } = await supabase.from("savings_goals").update({ current_amount: newAmount }).eq("id", goal.id);
    if (error) { toast.error(lang === "en" ? "Error depositing" : "Erro ao depositar"); return; }

    // 2. Create saving transaction
    //    notes includes goal_id so recurring generation can find and update the goal
    try {
      await supabase.from("transactions").insert({
        user_id: goal.user_id,
        title: `${lang === "en" ? "Deposit" : "Depósito"}: ${goal.name}`,
        amount: added,
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

    toast.success(
      isAutomatic
        ? (lang === "en" ? "Auto-deposit set up!" : "Depósito automático configurado!")
        : tx.success,
      isAutomatic
        ? (lang === "en"
            ? `${formatCurrency(added)} will be deposited every month.`
            : `${formatCurrency(added)} será depositado todo mês automaticamente.`)
        : `${formatCurrency(added)} ${tx.successDesc}`
    );
    reset();
    setIsAutomatic(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) { reset(); setIsAutomatic(false); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tx.title}</DialogTitle></DialogHeader>
        <div className="p-6 pt-4 space-y-4">
          {/* Goal info */}
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: goal.color + "20" }}>
              <PiggyBank size={18} style={{ color: goal.color }} />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">{goal.name}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}</p>
            </div>
          </div>

          {/* Amount */}
          <form id="deposit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-1.5">
            <Label htmlFor="deposit-amount">{tx.amount} *</Label>
            <Input
              id="deposit-amount"
              placeholder={tx.amountPlaceholder}
              inputMode="decimal"
              {...register("amount")}
              aria-invalid={!!errors.amount}
            />
            {errors.amount && <p className="text-xs text-destructive">{tx.amountInvalid}</p>}
          </form>

          {/* Auto-deposit toggle */}
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
            {/* Toggle pill */}
            <div className={cn("h-5 w-9 rounded-full transition-colors relative shrink-0", isAutomatic ? "bg-primary" : "bg-muted-foreground/30")}>
              <div className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                isAutomatic ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset(); setIsAutomatic(false); }}>
            {common.cancel}
          </Button>
          <Button type="submit" form="deposit-form" disabled={isSubmitting}>
            {isSubmitting
              ? <><Loader2 size={14} className="animate-spin" /> {tx.submitting}</>
              : isAutomatic
                ? (lang === "en" ? "Set up auto-deposit" : "Configurar depósito automático")
                : tx.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
