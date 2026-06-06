"use client";

import { useState, useRef } from "react";
import { Upload, Check, Loader2, AlertCircle, Settings2, RefreshCw, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import { parseCSV, buildParsedRows, type ParsedRow, type ColumnMap } from "@/lib/utils/csv-parser";
import { suggestCategory, suggestType } from "@/lib/utils/auto-categorize";
import { cn } from "@/lib/utils/cn";
import type { Category } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  onSuccess: () => void;
}

interface ImportRow extends ParsedRow {
  categoryId: string;
  skip: boolean;
  autoTyped: boolean;  // true when type was determined from title keywords (more reliable)
  autoCat: boolean;    // true when category was auto-suggested
}

type Step = "upload" | "preview" | "result";

export function CsvImportDialog({ open, onOpenChange, categories, onSuccess }: Props) {
  const [step, setStep]           = useState<Step>("upload");
  const [headers, setHeaders]     = useState<string[]>([]);
  const [rawRows, setRawRows]     = useState<string[][]>([]);
  const [colMap, setColMap]       = useState<Partial<ColumnMap>>({});
  const [autoMapped, setAutoMapped] = useState(false);   // true = all 3 were auto-detected
  const [showMapping, setShowMapping] = useState(false); // user can reveal manual mapping
  const [rows, setRows]           = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    examples: { date: string; title: string; amount: number }[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload"); setRows([]); setHeaders([]); setRawRows([]);
    setColMap({}); setError(null); setAutoMapped(false); setShowMapping(false);
    setImportResult(null);
  }

  function buildPreview(raw: string[][], map: ColumnMap) {
    const parsed = buildParsedRows(raw, map);
    const withCats: ImportRow[] = parsed.map(r => {
      // Refine type using title keywords — more reliable than amount-sign alone
      const titleType = suggestType(r.title);
      const type: "income" | "expense" = titleType ?? r.type;
      const autoTyped = !!titleType && titleType !== r.type; // type was corrected from title

      const typedCats = categories.filter(c => c.type === type);
      const suggested = suggestCategory(r.title, typedCats);
      return {
        ...r,
        type,
        categoryId: suggested?.id ?? "__none__",
        skip: false,
        autoTyped,
        autoCat: !!suggested,
      };
    });
    setRows(withCats);
  }

  function applyMap(newMap: Partial<ColumnMap>) {
    setColMap(newMap);
    setAutoMapped(false);
    if (newMap.dateCol !== undefined && newMap.titleCol !== undefined && newMap.amountCol !== undefined) {
      buildPreview(rawRows, newMap as ColumnMap);
    } else {
      setRows([]);
    }
  }

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const { headers, rows, suggestedMap } = parseCSV(content);
        setHeaders(headers);
        setRawRows(rows);
        setColMap(suggestedMap);
        setStep("preview");

        const allDetected =
          suggestedMap.dateCol !== undefined &&
          suggestedMap.titleCol !== undefined &&
          suggestedMap.amountCol !== undefined;

        setAutoMapped(allDetected);
        setShowMapping(!allDetected); // show mapping UI only if needed

        if (allDetected) {
          buildPreview(rows, suggestedMap as ColumnMap);
        }
      } catch {
        setError("Não foi possível ler o arquivo. Verifique se é um CSV válido.");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function updateRow(idx: number, updates: Partial<ImportRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  }

  /** Fingerprint: date + rounded amount (avoids float noise) + normalized title */
  function fingerprint(date: string, amount: number, title: string) {
    return `${date}|${Math.round(amount * 100)}|${title.toLowerCase().trim().replace(/\s+/g, " ")}`;
  }

  async function handleImport(force = false) {
    const toImportRows = rows.filter(r => !r.skip);
    if (!toImportRows.length) return;
    setImporting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    let newOnly = toImportRows;
    let skipped = 0;
    let examples: { date: string; title: string; amount: number }[] = [];

    if (!force) {
      // ── Duplicate detection ─────────────────────────────────────────────
      const dates = toImportRows.map(r => r.date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      const { data: existing } = await supabase
        .from("transactions")
        .select("date, amount, title")
        .eq("user_id", user.id)
        .gte("date", minDate)
        .lte("date", maxDate);

      const existingSet = new Set<string>(
        (existing ?? []).map((t: { date: string; amount: number; title: string }) =>
          fingerprint(t.date, t.amount, t.title)
        )
      );

      const blocked = toImportRows.filter(r => existingSet.has(fingerprint(r.date, r.amount, r.title)));
      newOnly = toImportRows.filter(r => !existingSet.has(fingerprint(r.date, r.amount, r.title)));
      skipped = blocked.length;
      examples = blocked.slice(0, 6).map(r => ({ date: r.date, title: r.title, amount: r.amount }));

      // All duplicates — show result screen with examples + force option
      if (!newOnly.length) {
        setImporting(false);
        setImportResult({ imported: 0, skipped, examples });
        setStep("result");
        return;
      }
      // ───────────────────────────────────────────────────────────────────
    }

    const payload = newOnly.map(r => ({
      user_id: user.id,
      title: r.title,
      amount: r.amount,
      type: r.type,
      date: r.date,
      category_id: (r.categoryId && r.categoryId !== "__none__") ? r.categoryId : null,
      notes: null,
      is_recurring: false,
      recurrence_interval: null,
    }));

    const { error } = await supabase.from("transactions").insert(payload);
    setImporting(false);
    if (error) { toast.error("Erro ao importar. Tente novamente."); return; }

    setImportResult({ imported: newOnly.length, skipped, examples });
    setStep("result");
    onSuccess();
  }

  const mapReady = colMap.dateCol !== undefined && colMap.titleCol !== undefined && colMap.amountCol !== undefined;
  const toImport  = rows.filter(r => !r.skip).length;
  const autoTagged = rows.filter(r => !r.skip && r.categoryId).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar CSV do banco</DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: UPLOAD ── */}
        {step === "upload" && (
          <div className="px-6 pb-4 space-y-5">

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className="border-2 border-dashed border-border/50 hover:border-primary/50 rounded-2xl py-12 px-6 text-center cursor-pointer transition-all group hover:bg-primary/[0.02]"
            >
              <div className="h-14 w-14 rounded-2xl bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center mx-auto mb-4 transition-colors">
                <Upload size={26} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1">Clique ou arraste o arquivo CSV</p>
              <p className="text-xs text-muted-foreground">Formatos aceitos: .csv, .txt</p>
              <input ref={fileRef} type="file" accept=".csv,.txt,.ofx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {/* Bank export instructions */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Como exportar do seu banco</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { bank: "Nubank",    steps: "App → Perfil → Exportar planilha" },
                  { bank: "Inter",     steps: "Extrato → Exportar → CSV" },
                  { bank: "Itaú",      steps: "Extrato → Baixar → Planilha" },
                  { bank: "Bradesco",  steps: "Extrato → Gerar CSV" },
                  { bank: "C6",        steps: "Extrato → Exportar → Excel/CSV" },
                  { bank: "Santander", steps: "Extrato → Baixar CSV" },
                ].map(({ bank, steps }) => (
                  <div key={bank} className="flex items-start gap-2 rounded-lg bg-muted/20 px-3 py-2">
                    <span className="text-xs font-semibold text-foreground shrink-0 w-16">{bank}</span>
                    <span className="text-xs text-muted-foreground leading-relaxed">{steps}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── STEP 2: PREVIEW ── */}
        {step === "preview" && (
          <div className="px-6 pb-2 space-y-4">

            {/* Auto-mapped success banner */}
            {autoMapped && !showMapping && rows.length > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Check size={13} />
                  <span>Colunas detectadas automaticamente</span>
                </div>
                <button
                  onClick={() => setShowMapping(true)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Settings2 size={11} /> Ajustar
                </button>
              </div>
            )}

            {/* Column mapping — only shown when needed or user requests */}
            {showMapping && (
              <div className="rounded-lg bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Mapeamento de colunas</p>
                  {autoMapped && (
                    <button onClick={() => setShowMapping(false)} className="text-xs text-muted-foreground hover:text-foreground">
                      Ocultar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["dateCol", "titleCol", "amountCol"] as const).map(field => (
                    <div key={field} className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {field === "dateCol" ? "📅 Data" : field === "titleCol" ? "📝 Descrição" : "💰 Valor"}
                      </p>
                      <Select
                        value={colMap[field] !== undefined ? String(colMap[field]) : ""}
                        onValueChange={v => applyMap({ ...colMap, [field]: parseInt(v) })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)} className="text-xs">
                              {h || `Coluna ${i + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                {!mapReady && (
                  <p className="text-xs text-amber-400">↑ Selecione as 3 colunas para ver a pré-visualização</p>
                )}
              </div>
            )}

            {/* No auto-detection + no rows yet */}
            {!autoMapped && !mapReady && rows.length === 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                Não foi possível detectar as colunas automaticamente. Selecione manualmente acima.
              </div>
            )}

            {/* Stats */}
            {rows.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{rows.length} transações detectadas</span>
                <span>·</span>
                <span className="text-indigo-400">{autoTagged} categorizadas</span>
                <span>·</span>
                <span>{toImport} para importar</span>
              </div>
            )}

            {/* Row list */}
            {rows.length > 0 && (
              <div className="space-y-1.5 max-h-[42vh] overflow-y-auto pr-1">
                {rows.map((row, i) => {
                  const typedCats = categories.filter(c => c.type === row.type);
                  return (
                    <div key={i} className={cn(
                      "rounded-lg border p-2.5 transition-opacity",
                      row.skip ? "opacity-35 border-border/20" : "border-border/50"
                    )}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <button
                          onClick={() => updateRow(i, { skip: !row.skip })}
                          className={cn(
                            "h-4 w-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors",
                            !row.skip ? "border-primary bg-primary" : "border-border bg-transparent"
                          )}
                        >
                          {!row.skip && <Check size={9} className="text-primary-foreground" />}
                        </button>
                        <span className="text-xs text-muted-foreground w-20 shrink-0 tabular-nums">{row.date}</span>
                        <span className="text-xs font-medium text-foreground flex-1 truncate">{row.title}</span>
                        {row.autoCat && (
                          <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-indigo-400 shrink-0" title="Categoria detectada automaticamente">
                            <Check size={9} /> auto
                          </span>
                        )}
                        <span className={cn("text-xs font-bold tabular-nums shrink-0",
                          row.type === "income" ? "text-emerald-400" : "text-red-400")}>
                          {row.type === "income" ? "+" : "-"}{formatCurrency(row.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <Select
                          value={row.type}
                          onValueChange={v => updateRow(i, { type: v as "income" | "expense", categoryId: "__none__", autoTyped: false, autoCat: false })}
                        >
                          <SelectTrigger className="h-6 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense" className="text-xs">Despesa</SelectItem>
                            <SelectItem value="income"  className="text-xs">Receita</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={row.categoryId}
                          onValueChange={v => updateRow(i, { categoryId: v, autoCat: false })}
                        >
                          <SelectTrigger className="h-6 text-xs flex-1">
                            <SelectValue placeholder="Sem categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" className="text-xs">Sem categoria</SelectItem>
                            {typedCats.map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: RESULT ── */}
        {step === "result" && importResult && (
          <div className="px-6 pb-2 space-y-3">
            {importResult.imported === 0 ? (
              /* All duplicates */
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                    <RefreshCw size={20} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Nenhuma transação nova</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-amber-400">{importResult.skipped} transações</span> deste CSV já existem no histórico.
                    </p>
                  </div>
                </div>

                {/* Examples of blocked transactions */}
                {importResult.examples.length > 0 && (
                  <div className="rounded-lg bg-muted/20 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      O que está sendo bloqueado (exemplos):
                    </p>
                    {importResult.examples.map((ex, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-20 shrink-0 tabular-nums">{ex.date}</span>
                        <span className="text-foreground flex-1 truncate">{ex.title}</span>
                        <span className="tabular-nums font-medium text-red-400 shrink-0">{formatCurrency(ex.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Se esses dados estão errados ou você quer reimportar mesmo assim, use o botão abaixo.
                </p>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => handleImport(true)}
                  disabled={importing}
                >
                  {importing
                    ? <><Loader2 size={13} className="animate-spin" /> Importando...</>
                    : `Importar mesmo assim (${importResult.skipped} transações)`}
                </Button>
              </div>
            ) : (
              /* Partial or full success */
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {importResult.imported} transações importadas!
                    </p>
                    {importResult.skipped > 0 && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-amber-400">{importResult.skipped} duplicadas</span> ignoradas — já existiam no histórico.
                      </p>
                    )}
                  </div>
                </div>

                {/* Examples of what was skipped */}
                {importResult.skipped > 0 && importResult.examples.length > 0 && (
                  <div className="rounded-lg bg-muted/20 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Duplicadas ignoradas (exemplos):
                    </p>
                    {importResult.examples.map((ex, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-20 shrink-0 tabular-nums">{ex.date}</span>
                        <span className="text-foreground flex-1 truncate">{ex.title}</span>
                        <span className="tabular-nums font-medium text-red-400 shrink-0">{formatCurrency(ex.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>← Voltar</Button>
              <Button onClick={() => handleImport()} disabled={importing || toImport === 0}>
                {importing
                  ? <><Loader2 size={14} className="animate-spin" /> Importando...</>
                  : `Importar ${toImport} transações`}
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>
                Importar outro arquivo
              </Button>
              <Button onClick={() => { onOpenChange(false); reset(); }}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
