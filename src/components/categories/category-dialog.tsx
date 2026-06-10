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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";
import type { Category } from "@/lib/types";

const COLORS = ["#10B981","#6366F1","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316","#3B82F6","#A855F7"];
const ICONS  = ["briefcase","code-2","trending-up","home","utensils","car","gamepad-2","heart-pulse","book-open","shirt","plane","target","shield","laptop","building-2","circle"];

const ICON_LABELS: Record<string, string> = {
  briefcase: "💼", "code-2": "💻", "trending-up": "📈", home: "🏠",
  utensils: "🍽️", car: "🚗", "gamepad-2": "🎮", "heart-pulse": "❤️‍🩹",
  "book-open": "📚", shirt: "👕", plane: "✈️", target: "🎯",
  shield: "🛡️", laptop: "💻", "building-2": "🏢", circle: "⚪",
};

const schema = z.object({
  name:  z.string().min(1),
  type:  z.enum(["income","expense"]),
  color: z.string().min(1),
  icon:  z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export function CategoryDialog({ open, onOpenChange, category, onSuccess }:
  { open: boolean; onOpenChange: (v: boolean) => void; category: Category | null; onSuccess: () => void }) {
  const { lang } = useLang();
  const tx = appT[lang].categories.dialog;
  const common = appT[lang].common;
  const isEdit = !!category;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "expense", color: COLORS[0], icon: "circle" },
  });
  const selectedColor = watch("color");
  const selectedIcon  = watch("icon");
  const type          = watch("type");

  useEffect(() => {
    if (open) {
      reset(category
        ? { name: category.name, type: category.type === "saving" ? "expense" : category.type, color: category.color, icon: category.icon }
        : { type: "expense", color: COLORS[0], icon: "circle" });
    }
  }, [open, category, reset]);

  async function onSubmit(data: FormData) {
    const res = await fetch("/api/categories/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: category!.id, ...data } : data),
    });
    if (!res.ok) { toast.error(lang === "en" ? "Error saving" : "Erro ao salvar"); return; }
    toast.success(isEdit
      ? (lang === "en" ? "Category updated" : "Categoria atualizada")
      : (lang === "en" ? "Category created" : "Categoria criada"));
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? tx.edit : tx.new}</DialogTitle></DialogHeader>
        <form id="cat-form" onSubmit={handleSubmit(onSubmit)} className="p-6 pt-4 space-y-4">
          <div className="space-y-2">
            <Label>{tx.type}</Label>
            <Tabs value={type} onValueChange={v => setValue("type", v as "income" | "expense")}>
              <TabsList className="w-full">
                <TabsTrigger value="expense" className="flex-1">{tx.expense}</TabsTrigger>
                <TabsTrigger value="income"  className="flex-1">{tx.income}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">{tx.name} *</Label>
            <Input id="cat-name" placeholder={tx.namePlaceholder} {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{tx.nameRequired}</p>}
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
          <div className="space-y-2">
            <Label>{tx.icon}</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setValue("icon", name)}
                  aria-label={name}
                  title={name}
                  className={cn(
                    "h-9 w-9 rounded-lg text-lg flex items-center justify-center transition-all hover:scale-110",
                    selectedIcon === name
                      ? "bg-primary/15 ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  {ICON_LABELS[name]}
                </button>
              ))}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button type="submit" form="cat-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> {common.saving}</> : isEdit ? tx.save : tx.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
