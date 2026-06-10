"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Tag, Search, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryDialog } from "./category-dialog";
import { CategoryDetailSheet } from "./category-detail-sheet";
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

  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<"expense" | "income">("expense");
  const [editCat, setEditCat]           = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [search, setSearch]             = useState("");
  const [detailCat, setDetailCat]       = useState<Category | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const load = useCallback(async () => {
    const res = await fetch("/api/categories/list");
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json() as { categories: Category[] };
    setCategories(json.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/categories/delete?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error(lang === "en" ? "Error deleting" : "Erro ao excluir"); return; }
    toast.success(lang === "en" ? "Category deleted" : "Categoria excluída");
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  const filtered = categories.filter(c =>
    c.type === tab && (!search || norm(c.name).includes(norm(search)))
  );

  return (
    <div className="space-y-6">
      <PageHeader title={tx.title} description={tx.description}
        action={
          <Button onClick={() => { setEditCat(null); setDialogOpen(true); }} size="sm">
            <Plus size={15} /> {tx.new}
          </Button>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={tab} onValueChange={v => { setTab(v as typeof tab); setSearch(""); }}>
          <TabsList>
            <TabsTrigger value="expense">{tx.expensesTab}</TabsTrigger>
            <TabsTrigger value="income">{tx.incomeTab}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={lang === "en" ? "Search categories..." : "Buscar categorias..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card p-4 h-20 shimmer" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card">
          {search ? (
            <EmptyState icon={Search} title={lang === "en" ? "No results" : "Sem resultados"}
              description={lang === "en" ? `No categories matching "${search}"` : `Nenhuma categoria para "${search}"`}
              action={<Button size="sm" variant="outline" onClick={() => setSearch("")}><X size={14} /> {lang === "en" ? "Clear search" : "Limpar busca"}</Button>}
            />
          ) : (
            <EmptyState icon={Tag} title={tx.empty}
              description={`${tx.emptyDesc} ${tab === "expense" ? tx.emptyExpenses : tx.emptyIncome}.`}
              action={<Button size="sm" onClick={() => { setEditCat(null); setDialogOpen(true); }}><Plus size={15} /> {tx.create}</Button>}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(cat => (
            <div key={cat.id} className="glass-card-hover p-4 flex items-center gap-3 group">
              <button
                className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-opacity hover:opacity-80"
                style={{ backgroundColor: cat.color + "20" }}
                onClick={() => { setDetailCat(cat); setDetailOpen(true); }}
                title={tx.viewTransactions}
              >
                <span>{ICON_LABELS[cat.icon] ?? "📌"}</span>
              </button>
              <div className="flex-1 min-w-0">
                <button
                  className="font-medium text-foreground text-sm hover:text-primary transition-colors text-left truncate w-full"
                  onClick={() => { setDetailCat(cat); setDetailOpen(true); }}
                >
                  {cat.name}
                </button>
                <Badge variant={cat.type === "income" ? "income" : "expense"} className="mt-1">
                  {cat.type === "income" ? tx.badge.income : tx.badge.expense}
                </Badge>
              </div>
              <div className="card-actions">
                <button
                  onClick={() => { setDetailCat(cat); setDetailOpen(true); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  title={tx.viewTransactions}
                >
                  <ChevronRight size={13} />
                </button>
                <button onClick={() => { setEditCat(cat); setDialogOpen(true); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title={common.edit}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(cat.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title={common.delete}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editCat}
        onSuccess={() => { setDialogOpen(false); load(); }} />

      <CategoryDetailSheet
        category={detailCat}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
