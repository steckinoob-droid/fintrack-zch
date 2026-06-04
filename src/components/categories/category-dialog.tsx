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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/hooks/use-toast";
import type { Category } from "@/lib/types";

const COLORS = ["#10B981","#6366F1","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316","#3B82F6","#A855F7"];
const ICONS = ["briefcase","code-2","trending-up","home","utensils","car","gamepad-2","heart-pulse","book-open","shirt","plane","target","shield","laptop","building-2","circle"];

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  type: z.enum(["income", "expense"]),
  color: z.string().min(1),
  icon: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category | null;
  onSuccess: () => void;
}

export function CategoryDialog({ open, onOpenChange, category, onSuccess }: Props) {
  const isEdit = !!category;
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "expense", color: COLORS[0], icon: "circle" },
  });

  const selectedColor = watch("color");
  const selectedIcon = watch("icon");
  const type = watch("type");

  useEffect(() => {
    if (open) {
      reset(category
        ? { name: category.name, type: category.type, color: category.color, icon: category.icon }
        : { type: "expense", color: COLORS[0], icon: "circle" }
      );
    }
  }, [open, category, reset]);

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { user_id: user.id, ...data };
    const { error } = isEdit
      ? await supabase.from("categories").update(data).eq("id", category!.id)
      : await supabase.from("categories").insert(payload);
    if (error) { toast.error("Erro ao salvar categoria"); return; }
    toast.success(isEdit ? "Categoria atualizada" : "Categoria criada");
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
        </DialogHeader>
        <form id="cat-form" onSubmit={handleSubmit(onSubmit)} className="p-6 pt-4 space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Tabs value={type} onValueChange={(v) => setValue("type", v as "income" | "expense")}>
              <TabsList className="w-full">
                <TabsTrigger value="expense" className="flex-1">Despesa</TabsTrigger>
                <TabsTrigger value="income" className="flex-1">Receita</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nome *</Label>
            <Input id="cat-name" placeholder="Ex: Alimentação" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setValue("color", c)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: selectedColor === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }}
                  aria-label={c} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ícone</Label>
            <Select onValueChange={(v) => setValue("icon", v)} defaultValue={category?.icon ?? "circle"}>
              <SelectTrigger><SelectValue placeholder="Selecionar ícone" /></SelectTrigger>
              <SelectContent>
                {ICONS.map((icon) => (
                  <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="cat-form" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
