"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { SavingsGoal } from "@/lib/types";

const COLORS = ["#10B981","#6366F1","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#3B82F6"];
const schema = z.object({
  name:           z.string().min(1),
  target_amount:  z.string().min(1).refine(v => parseFloat(v.replace(",", ".")) > 0),
  current_amount: z.string().optional().refine(v => !v || parseFloat(v.replace(",", ".")) >= 0, { message: "invalid" }),
  deadline:       z.string().optional(),
  color:          z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export function GoalDialog({ open, onOpenChange, goal, onSuccess }:
  { open: boolean; onOpenChange: (v: boolean) => void; goal: SavingsGoal | null; onSuccess: () => void }) {
  const { lang } = useLang();
  const tx = appT[lang].goals.dialog;
  const common = appT[lang].common;
  const isEdit = !!goal;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { color: COLORS[0] },
  });
  const selectedColor = watch("color");

  useEffect(() => {
    if (open) {
      reset(goal
        ? { name: goal.name, target_amount: String(goal.target_amount), current_amount: String(goal.current_amount), deadline: goal.deadline ?? "", color: goal.color }
        : { color: COLORS[0], current_amount: "0" });
    }
  }, [open, goal, reset]);

  async function onSubmit(data: FormData) {
    const payload = {
      name: data.name,
      target_amount: parseFloat(data.target_amount.replace(",", ".")),
      current_amount: parseFloat((data.current_amount || "0").replace(",", ".")),
      deadline: data.deadline || null,
      color: data.color,
      icon: "target",
    };

    if (isEdit) {
      // Server-side PATCH: admin client guarantees the update persists regardless
      // of browser client JWT state (stale token → 0 rows, no error).
      const res = await fetch("/api/goals/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goal!.id, ...payload }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        console.error("[goal-dialog] update error:", json.error);
        toast.error(lang === "en" ? "Error saving" : "Erro ao salvar");
        return;
      }
    } else {
      // Server-side POST: bypasses browser client JWT issues that cause INSERT
      // to fail with RLS violation when auth.uid() is null on the DB side.
      const res = await fetch("/api/goals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        console.error("[goal-dialog] create error:", json.error);
        toast.error(lang === "en" ? "Error saving" : "Erro ao salvar");
        return;
      }
    }

    toast.success(isEdit
      ? (lang === "en" ? "Goal updated" : "Meta atualizada")
      : (lang === "en" ? "Goal created!" : "Meta criada!"));
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? tx.edit : tx.new}</DialogTitle></DialogHeader>
        <form id="goal-form" onSubmit={handleSubmit(onSubmit)} className="p-6 pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">{tx.name} *</Label>
            <Input id="goal-name" placeholder={tx.namePlaceholder} {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{tx.nameRequired}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="target">{tx.target} *</Label>
              <Input id="target" placeholder={lang === "en" ? "0.00" : "0,00"} inputMode="decimal" {...register("target_amount")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="current">{tx.current}</Label>
              <Input id="current" placeholder={lang === "en" ? "0.00" : "0,00"} inputMode="decimal" {...register("current_amount")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deadline">{tx.deadline}</Label>
            <Input id="deadline" type="date" {...register("deadline")} />
          </div>
          <div className="space-y-2">
            <Label>{tx.color}</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setValue("color", c)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: selectedColor === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }} />
              ))}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button type="submit" form="goal-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> {common.saving}</> : isEdit ? tx.save : tx.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
