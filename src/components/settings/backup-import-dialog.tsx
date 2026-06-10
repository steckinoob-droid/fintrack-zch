"use client";

import { useState, useRef } from "react";
import {
  Upload, CheckCircle2, AlertCircle, Loader2,
  FileJson, Info, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

// ── Backup shape validation ────────────────────────────────────────────────────

interface RawBackup {
  exported_at?: string;
  profile?: { name?: string; currency?: string };
  transactions: unknown[];
  categories: unknown[];
  goals: unknown[];
  budgets: unknown[];
}

function isValidBackup(data: unknown): data is RawBackup {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.transactions) &&
    Array.isArray(d.categories) &&
    Array.isArray(d.goals) &&
    Array.isArray(d.budgets)
  );
}

// ── Preview counts after deduplication check ─────────────────────────────────

interface PreviewCounts {
  transactions: { total: number; newCount: number };
  categories:   { total: number; newCount: number };
  goals:        { total: number; newCount: number };
  budgets:      { total: number; newCount: number };
  exportedAt:   string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

type Step = "upload" | "preview" | "result";

export function BackupImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const { lang } = useLang();
  const tx = appT[lang].settings;

  const [step, setStep]       = useState<Step>("upload");
  const [backup, setBackup]   = useState<RawBackup | null>(null);
  const [preview, setPreview] = useState<PreviewCounts | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{
    categories: number; goals: number; transactions: number; budgets: number;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload"); setBackup(null); setPreview(null);
    setError(null); setLoading(false); setResult(null);
  }

  // ── Parse + check duplicates ─────────────────────────────────────────────

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);

    // Guard against files that would freeze the browser tab
    if (file.size > 10 * 1024 * 1024) {
      setError(tx.importTooLarge);
      setLoading(false);
      return;
    }

    try {
      const text = await file.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); }
      catch { setError(tx.importError); setLoading(false); return; }

      if (!isValidBackup(parsed)) {
        setError(tx.importError);
        setLoading(false);
        return;
      }

      if (parsed.transactions.length > 50_000) {
        setError(tx.importTooMany);
        setLoading(false);
        return;
      }

      // Validate individual item shapes minimally (must have string id)
      if (parsed.transactions.some((t: unknown) => typeof (t as Record<string,unknown>).id !== "string")) {
        setError(tx.importCorrupt);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Fetch existing IDs for deduplication
      const existingIds = await fetchExistingIds(supabase, user.id);

      const catIds   = new Set(parsed.categories.map((c: unknown) => (c as Record<string,unknown>).id as string));
      const goalIds  = new Set(parsed.goals.map((g: unknown)  => (g as Record<string,unknown>).id as string));

      const newCats  = parsed.categories.filter((c: unknown) => !existingIds.categories.has((c as Record<string,unknown>).id as string));
      const newGoals = parsed.goals.filter((g: unknown)       => !existingIds.goals.has((g as Record<string,unknown>).id as string));
      const newTx    = parsed.transactions.filter((t: unknown) => !existingIds.transactions.has((t as Record<string,unknown>).id as string));
      const newBudgets = parsed.budgets.filter((b: unknown) => {
        const bid = (b as Record<string,unknown>).id as string;
        return !existingIds.budgets.has(bid);
      });

      // Count orphaned refs for info only — we null them out at import time
      const allCatIds  = new Set([...catIds,  ...existingIds.categories]);
      const allGoalIds = new Set([...goalIds, ...existingIds.goals]);
      newTx.forEach((t: unknown) => {
        const tx2 = t as Record<string, unknown>;
        if (tx2.category_id && !allCatIds.has(tx2.category_id as string)) {
          // category_id will be nulled on import
        }
        if (tx2.goal_id && !allGoalIds.has(tx2.goal_id as string)) {
          // goal_id will be nulled on import
        }
      });

      setPreview({
        transactions: { total: parsed.transactions.length, newCount: newTx.length },
        categories:   { total: parsed.categories.length,   newCount: newCats.length },
        goals:        { total: parsed.goals.length,         newCount: newGoals.length },
        budgets:      { total: parsed.budgets.length,       newCount: newBudgets.length },
        exportedAt:   parsed.exported_at ?? null,
      });
      setBackup(parsed);
      setStep("preview");
    } catch {
      setError(tx.importCorrupt);
    }
    setLoading(false);
  }

  // ── Do import ────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!backup) return;
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    try {
      const existingIds = await fetchExistingIds(supabase, user.id);

      // 1. Categories
      const newCats = backup.categories
        .filter((c: unknown) => !existingIds.categories.has((c as Record<string,unknown>).id as string))
        .map((c: unknown) => {
          const cat = c as Record<string,unknown>;
          return {
            id:         cat.id,
            user_id:    user.id,
            name:       cat.name,
            type:       cat.type,
            color:      cat.color ?? "#10B981",
            icon:       cat.icon ?? "circle",
            created_at: cat.created_at,
          };
        });
      if (newCats.length > 0) {
        await supabase.from("categories").insert(newCats);
      }

      // 2. Goals
      const newGoals = backup.goals
        .filter((g: unknown) => !existingIds.goals.has((g as Record<string,unknown>).id as string))
        .map((g: unknown) => {
          const goal = g as Record<string,unknown>;
          return {
            id:             goal.id,
            user_id:        user.id,
            name:           goal.name,
            target_amount:  goal.target_amount,
            current_amount: goal.current_amount ?? 0,
            deadline:       goal.deadline ?? null,
            color:          goal.color ?? "#6366F1",
            icon:           goal.icon ?? "target",
            created_at:     goal.created_at,
          };
        });
      if (newGoals.length > 0) {
        await supabase.from("savings_goals").insert(newGoals);
      }

      // Refresh existing IDs to include just-inserted categories + goals
      const refreshedIds = await fetchExistingIds(supabase, user.id);

      // 3. Transactions
      // Build the full set of transaction IDs that will exist after this import
      // (existing in DB + every ID present in the backup) so we can resolve
      // recurrence_parent_id links from within the same backup file.
      const allTxIdsInBackup = new Set<string>(
        backup.transactions
          .filter((t: unknown) => typeof (t as Record<string, unknown>).id === "string")
          .map((t: unknown) => (t as Record<string, unknown>).id as string)
      );
      const allKnownTxIds = new Set<string>([
        ...refreshedIds.transactions,
        ...allTxIdsInBackup,
      ]);

      const newTx = backup.transactions
        .filter((t: unknown) => !existingIds.transactions.has((t as Record<string,unknown>).id as string))
        .map((t: unknown) => {
          const trx = t as Record<string,unknown>;
          const catId = trx.category_id
            ? (refreshedIds.categories.has(trx.category_id as string) ? trx.category_id : null)
            : null;
          const goalId = trx.goal_id
            ? (refreshedIds.goals.has(trx.goal_id as string) ? trx.goal_id : null)
            : null;
          // Preserve parent link when the parent exists in DB or in this backup;
          // null it only when the parent is genuinely missing (partial/corrupt backup).
          const parentId = trx.recurrence_parent_id
            ? (allKnownTxIds.has(trx.recurrence_parent_id as string)
                ? trx.recurrence_parent_id
                : null)
            : null;
          return {
            id:                    trx.id,
            user_id:               user.id,
            category_id:           catId,
            title:                 trx.title,
            amount:                trx.amount,
            type:                  trx.type,
            date:                  trx.date,
            notes:                 trx.notes ?? null,
            is_recurring:          trx.is_recurring ?? false,
            recurrence_interval:   trx.recurrence_interval ?? null,
            recurrence_parent_id:  parentId,
            goal_id:               goalId,
            created_at:            trx.created_at,
          };
        });

      // Sort parents (recurrence_parent_id = null) before children to satisfy the
      // self-referential FK constraint during bulk insert chunks.
      const sortedNewTx = [...newTx].sort((a, b) => {
        const aIsChild = a.recurrence_parent_id != null ? 1 : 0;
        const bIsChild = b.recurrence_parent_id != null ? 1 : 0;
        return aIsChild - bIsChild;
      });

      if (sortedNewTx.length > 0) {
        for (let i = 0; i < sortedNewTx.length; i += 500) {
          await supabase.from("transactions").insert(sortedNewTx.slice(i, i + 500));
        }
      }

      // 4. Budgets
      const newBudgets = backup.budgets
        .filter((b: unknown) => !existingIds.budgets.has((b as Record<string,unknown>).id as string))
        .map((b: unknown) => {
          const budget = b as Record<string,unknown>;
          const catId = budget.category_id
            ? (refreshedIds.categories.has(budget.category_id as string) ? budget.category_id : null)
            : null;
          if (!catId) return null; // budget without valid category is meaningless
          return {
            id:          budget.id,
            user_id:     user.id,
            category_id: catId,
            amount:      budget.amount,
            month:       budget.month,
            created_at:  budget.created_at,
          };
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);
      if (newBudgets.length > 0) {
        await supabase.from("budgets").insert(newBudgets);
      }

      setResult({
        categories:   newCats.length,
        goals:        newGoals.length,
        transactions: sortedNewTx.length,
        budgets:      newBudgets.length,
      });
      setStep("result");
      onSuccess();
      toast.success(tx.importSuccess, tx.importSuccessDesc);
    } catch (err) {
      console.error("[backup-import]", err);
      toast.error(tx.importCorrupt);
    }
    setLoading(false);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function fetchExistingIds(supabase: ReturnType<typeof createClient>, userId: string) {
    const [cats, goals, txs, budgets] = await Promise.all([
      supabase.from("categories").select("id").eq("user_id", userId),
      supabase.from("savings_goals").select("id").eq("user_id", userId),
      supabase.from("transactions").select("id").eq("user_id", userId),
      supabase.from("budgets").select("id").eq("user_id", userId),
    ]);
    return {
      categories:   new Set<string>((cats.data ?? []).map(r => r.id)),
      goals:        new Set<string>((goals.data ?? []).map(r => r.id)),
      transactions: new Set<string>((txs.data ?? []).map(r => r.id)),
      budgets:      new Set<string>((budgets.data ?? []).map(r => r.id)),
    };
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson size={16} className="text-primary" />
            {tx.importBackupTitle}
          </DialogTitle>
        </DialogHeader>

        {/* ── UPLOAD ── */}
        {step === "upload" && (
          <div className="px-6 pb-2 space-y-4">
            {error && (
              <div className="alert-error flex items-start gap-2 px-3 py-2.5 text-xs">
                <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 size={24} className="text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">{tx.importAnalysing}</p>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className="border-2 border-dashed border-border/50 hover:border-primary/50 rounded-2xl py-10 px-6 text-center cursor-pointer transition-all hover:bg-primary/[0.02]"
              >
                <div className="h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-3">
                  <Upload size={22} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  {lang === "en" ? "Click or drop backup file" : "Clique ou arraste o arquivo de backup"}
                </p>
                <p className="text-xs text-muted-foreground">{tx.importBackupBtn}</p>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            )}

            <div className="alert-info px-3 py-2.5 flex items-start gap-2 text-xs">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>
                {lang === "en"
                  ? "Existing records (same ID) are automatically skipped — no duplicates will be created."
                  : "Registros existentes (mesmo ID) são ignorados automaticamente — sem duplicatas."}
              </span>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === "preview" && preview && (
          <div className="px-6 pb-2 space-y-3">
            {preview.exportedAt && (
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "Exported:" : "Exportado em:"}{" "}
                <span className="text-foreground font-medium">
                  {new Date(preview.exportedAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}
                </span>
              </p>
            )}

            <p className="text-sm font-semibold text-foreground">{tx.importPreviewTitle}</p>

            <div className="space-y-2">
              {(
                [
                  { key: "transactions", label: tx.importTransactions },
                  { key: "categories",   label: tx.importCategories   },
                  { key: "goals",        label: tx.importGoals        },
                  { key: "budgets",      label: tx.importBudgets      },
                ] as const
              ).map(({ key, label }) => {
                const { total, newCount } = preview[key];
                const skipped = total - newCount;
                return (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-sm">
                    <span className="text-muted-foreground capitalize">{label}</span>
                    <div className="flex items-center gap-2 text-xs">
                      {newCount > 0 && (
                        <span className="font-semibold text-emerald-400">
                          +{newCount} {tx.importNew}
                        </span>
                      )}
                      {skipped > 0 && (
                        <span className="text-muted-foreground/60">
                          {skipped} {tx.importSkip}
                        </span>
                      )}
                      {newCount === 0 && skipped === 0 && (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {preview.transactions.newCount === 0 &&
             preview.categories.newCount === 0 &&
             preview.goals.newCount === 0 &&
             preview.budgets.newCount === 0 && (
              <div className="alert-warning px-3 py-2.5 flex items-start gap-2 text-xs">
                <Info size={13} className="shrink-0 mt-0.5" />
                {lang === "en"
                  ? "All records already exist. Nothing will be imported."
                  : "Todos os registros já existem. Nada será importado."}
              </div>
            )}
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <div className="px-6 pb-2">
            <div className="alert-success p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{tx.importSuccess}</p>
                  <p className="text-sm text-muted-foreground">{tx.importSuccessDesc}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  [tx.importTransactions, result.transactions],
                  [tx.importCategories,   result.categories],
                  [tx.importGoals,        result.goals],
                  [tx.importBudgets,      result.budgets],
                ].map(([label, count]) => (
                  <div key={label as string} className="rounded-lg bg-muted/20 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="ml-2 font-bold text-emerald-400">+{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X size={14} /> {lang === "en" ? "Cancel" : "Cancelar"}
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                ← {lang === "en" ? "Back" : "Voltar"}
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || (
                  preview!.transactions.newCount === 0 &&
                  preview!.categories.newCount === 0 &&
                  preview!.goals.newCount === 0 &&
                  preview!.budgets.newCount === 0
                )}
              >
                {loading
                  ? <><Loader2 size={13} className="animate-spin" /> {tx.importImporting}</>
                  : tx.importConfirm}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={() => { onOpenChange(false); reset(); }}>
              {lang === "en" ? "Close" : "Fechar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
