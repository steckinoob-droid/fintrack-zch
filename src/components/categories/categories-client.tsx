"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryDialog } from "./category-dialog";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { Category } from "@/lib/types";

const ICON_LABELS: Record<string, string> = {
  briefcase: "💼", "code-2": "💻", "trending-up": "📈", home: "🏠",
  utensils: "🍽️", car: "🚗", "gamepad-2": "🎮", "heart-pulse": "❤️‍🩹",
  "book-open": "📚", shirt: "👕", plane: "✈️", target: "🎯",
  shield: "🛡️", laptop: "💻", "building-2": "🏢", circle: "⚪",
};

export function CategoriesClient() {
  const { lang } = useLang();
  const tx = appT[lang].categories;
  const common = appT[lang].common;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"expense" | "income">("expense");
  const [editCat, setEditCat]       = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("categories").select("*")
      .eq("user_id", user.id).order("name");
    setCategories(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir"); return; }
    toast.success(lang === "en" ? "Category deleted" : "Categoria excluída");
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  const filtered = categories.filter(c => c.type === tab);

  return (
    <div className="space-y-6">
      <PageHeader title={tx.title} description={tx.description}
        action={
          <Button onClick={() => { setEditCat(null); setDialogOpen(true); }} size="sm">
            <Plus size={15} /> {tx.new}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="expense">{tx.expensesTab}</TabsTrigger>
          <TabsTrigger value="income">{tx.incomeTab}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card p-4 h-20 shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card">
          <EmptyState icon={Tag} title={tx.empty}
            description={`${tx.emptyDesc} ${tab === "expense" ? tx.emptyExpenses : tx.emptyIncome}.`}
            action={<Button size="sm" onClick={() => { setEditCat(null); setDialogOpen(true); }}><Plus size={15} /> {tx.create}</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(cat => (
            <div key={cat.id} className="glass-card-hover p-4 flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: cat.color + "20" }}>
                <span>{ICON_LABELS[cat.icon] ?? "📌"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{cat.name}</p>
                <Badge variant={cat.type === "income" ? "income" : "expense"} className="mt-1">
                  {cat.type === "income" ? tx.badge.income : tx.badge.expense}
                </Badge>
              </div>
              <div className="hidden group-hover:flex items-center gap-1">
                <button onClick={() => { setEditCat(cat); setDialogOpen(true); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(cat.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editCat}
        onSuccess={() => { setDialogOpen(false); load(); }} />
    </div>
  );
}
