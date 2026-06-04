"use client";

const ICON_LABELS: Record<string, string> = {
  briefcase: "💼", "code-2": "💻", "trending-up": "📈", home: "🏠",
  utensils: "🍽️", car: "🚗", "gamepad-2": "🎮", "heart-pulse": "❤️‍🩹",
  "book-open": "📚", shirt: "👕", plane: "✈️", target: "🎯",
  shield: "🛡️", laptop: "💻", "building-2": "🏢", circle: "⚪",
};

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import type { Transaction, Category } from "@/lib/types";

const RECURRENCE_OPTIONS = [
  { value: "daily",   label: "Diariamente" },
  { value: "weekly",  label: "Semanalmente" },
  { value: "monthly", label: "Todo mês" },
  { value: "yearly",  label: "Todo ano" },
];

const schema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  amount: z.string().min(1).refine((v) => parseFloat(v.replace(",", ".")) > 0, "Valor inválido"),
  type: z.enum(["income", "expense"]),
  category_id: z.string().optional(),
  date: z.string().min(1, "Data obrigatória"),
  notes: z.string().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_interval: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  categories: Category[];
  onSuccess: () => void;
}

export function TransactionDialog({ open, onOpenChange, transaction, categories, onSuccess }: Props) {
  const isEdit = !!transaction;
  const [isRecurring, setIsRecurring] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "expense", date: new Date().toISOString().slice(0, 10) },
  });

  const type = watch("type");
  const filteredCats = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (open) {
      if (transaction) {
        reset({
          title: transaction.title,
          amount: String(transaction.amount),
          type: transaction.type,
          category_id: transaction.category_id ?? "",
          date: transaction.date,
          notes: transaction.notes ?? "",
          is_recurring: transaction.is_recurring,
          recurrence_interval: transaction.recurrence_interval ?? undefined,
        });
        setIsRecurring(transaction.is_recurring);
      } else {
        reset({ type: "expense", date: new Date().toISOString().slice(0, 10) });
        setIsRecurring(false);
      }
    }
  }, [open, transaction, reset]);

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      title: data.title,
      amount: parseFloat(data.amount.replace(",", ".")),
      type: data.type,
      category_id: data.category_id || null,
      date: data.date,
      notes: data.notes || null,
      is_recurring: isRecurring,
      recurrence_interval: isRecurring ? (data.recurrence_interval ?? "monthly") : null,
    };

    const { error } = isEdit
      ? await supabase.from("transactions").update(payload).eq("id", transaction!.id)
      : await supabase.from("transactions").insert(payload);

    if (error) { toast.error("Erro ao salvar transação"); return; }
    toast.success(isEdit ? "Transação atualizada" : "Transação adicionada");
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Transação" : "Nova Transação"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-4 space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Tabs value={type} onValueChange={(v) => { setValue("type", v as "income" | "expense"); setValue("category_id", ""); }}>
              <TabsList className="w-full">
                <TabsTrigger value="expense" className="flex-1">Despesa</TabsTrigger>
                <TabsTrigger value="income" className="flex-1">Receita</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" placeholder="Ex: Aluguel de junho" {...register("title")} aria-invalid={!!errors.title} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input id="amount" placeholder="0,00" inputMode="decimal" {...register("amount")} aria-invalid={!!errors.amount} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Data *</Label>
              <Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            {filteredCats.length === 0 ? (
              <div className="flex h-9 w-full items-center rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground">
                Nenhuma categoria — crie em{" "}
                <a href="/categories" className="ml-1 text-primary underline">Categorias</a>
              </div>
            ) : (
              <Select onValueChange={(v) => setValue("category_id", v)} defaultValue={transaction?.category_id ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCats.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm">{ICON_LABELS[cat.icon] ?? "📌"}</span>
                        <span className="leading-none">{cat.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Recorrência */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsRecurring((v) => !v)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                isRecurring
                  ? "border-primary/40 bg-primary/8 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                isRecurring ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <RefreshCw size={15} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium leading-none">Transação recorrente</p>
                <p className="text-xs text-muted-foreground mt-0.5">Repete automaticamente</p>
              </div>
              <div className={cn(
                "h-5 w-9 rounded-full transition-colors relative",
                isRecurring ? "bg-primary" : "bg-muted-foreground/30"
              )}>
                <div className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  isRecurring ? "translate-x-4" : "translate-x-0.5"
                )} />
              </div>
            </button>

            {isRecurring && (
              <Select
                onValueChange={(v) => setValue("recurrence_interval", v as any)}
                defaultValue={transaction?.recurrence_interval ?? "monthly"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Frequência" />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" placeholder="Observações opcionais..." {...register("notes")} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : isEdit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
