"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { Budget, Category } from "@/lib/types";

const schema = z.object({
  category_id: z.string().min(1),
  amount:      z.string().min(1).refine(v => parseFloat(v.replace(",", ".")) > 0),
});
type FormData = z.infer<typeof schema>;

export function BudgetDialog({ open, onOpenChange, budget, categories, currentMonth, onSuccess }:
  { open: boolean; onOpenChange: (v: boolean) => void; budget: Budget | null; categories: Category[]; currentMonth: string; onSuccess: () => void }) {
  const { lang } = useLang();
  const tx = appT[lang].budgets.dialog;
  const common = appT[lang].common;
  const isEdit = !!budget;

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) reset(budget ? { category_id: budget.category_id, amount: String(budget.amount) } : { category_id: "", amount: "" });
  }, [open, budget, reset]);

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { user_id: user.id, category_id: data.category_id, amount: parseFloat(data.amount.replace(",", ".")), month: currentMonth };
    const { error } = isEdit
      ? await supabase.from("budgets").update({ amount: payload.amount }).eq("id", budget!.id)
      : await supabase.from("budgets").upsert(payload, { onConflict: "user_id,category_id,month" });
    if (error) { toast.error(lang === "en" ? "Error saving" : "Erro ao salvar"); return; }
    toast.success(isEdit
      ? (lang === "en" ? "Budget updated" : "Orçamento atualizado")
      : (lang === "en" ? "Budget created" : "Orçamento criado"));
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? tx.edit : tx.new}</DialogTitle></DialogHeader>
        <form id="budget-form" onSubmit={handleSubmit(onSubmit)} className="p-6 pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>{tx.category} *</Label>
            <Select onValueChange={v => setValue("category_id", v)} defaultValue={budget?.category_id ?? ""} disabled={isEdit}>
              <SelectTrigger><SelectValue placeholder={tx.categoryPlaceholder} /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && <p className="text-xs text-destructive">{tx.categoryRequired}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">{tx.amount} *</Label>
            <Input id="budget-amount" placeholder={tx.amountPlaceholder} inputMode="decimal" {...register("amount")} />
            {errors.amount && <p className="text-xs text-destructive">{tx.amountInvalid}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button type="submit" form="budget-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> {common.saving}</> : isEdit ? tx.save : tx.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
