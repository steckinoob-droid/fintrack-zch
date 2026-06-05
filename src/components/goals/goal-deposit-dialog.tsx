"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
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

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const added     = parseFloat(data.amount.replace(",", "."));
    const newAmount = Math.min(goal.target_amount, goal.current_amount + added);

    // 1. Update goal amount
    const { error } = await supabase.from("savings_goals").update({ current_amount: newAmount }).eq("id", goal.id);
    if (error) { toast.error(lang === "en" ? "Error depositing" : "Erro ao depositar"); return; }

    // 2. Create a saving transaction to properly track it in finances
    //    (requires DB migration 003 — silently skips if not applied yet)
    try {
      await supabase.from("transactions").insert({
        user_id: goal.user_id,
        title: `${lang === "en" ? "Deposit" : "Depósito"}: ${goal.name}`,
        amount: added,
        type: "saving",
        date: new Date().toISOString().slice(0, 10),
        category_id: null,
        notes: `${lang === "en" ? "Savings goal" : "Meta de poupança"}: ${goal.name}`,
      });
    } catch {
      // DB migration not applied yet — goal still updated, transaction skipped
    }

    toast.success(tx.success, `${formatCurrency(added)} ${tx.successDesc}`);
    reset();
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tx.title}</DialogTitle></DialogHeader>
        <div className="p-6 pt-4 space-y-4">
          <div className="glass-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: goal.color + "20" }}>
              <PiggyBank size={18} style={{ color: goal.color }} />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">{goal.name}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}</p>
            </div>
          </div>
          <form id="deposit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-1.5">
            <Label htmlFor="deposit-amount">{tx.amount} *</Label>
            <Input id="deposit-amount" placeholder={tx.amountPlaceholder} inputMode="decimal" {...register("amount")} aria-invalid={!!errors.amount} />
            {errors.amount && <p className="text-xs text-destructive">{tx.amountInvalid}</p>}
          </form>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button type="submit" form="deposit-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> {tx.submitting}</> : tx.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
