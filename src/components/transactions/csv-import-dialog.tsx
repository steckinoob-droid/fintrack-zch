"use client";

import { useState, useRef } from "react";
import {
  Upload, Check, Loader2, AlertCircle, Settings2,
  RefreshCw, CheckCircle2, ChevronDown, ChevronUp, Info, FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/hooks/use-toast";
import { formatCurrency } from "@/lib/utils/currency";
import { parseCSV, buildParsedRows, type ParsedRow, type ColumnMap } from "@/lib/utils/csv-parser";
import { suggestCategory, suggestType } from "@/lib/utils/auto-categorize";
import { useLang } from "@/lib/i18n/context";
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
  autoTyped: boolean;
  autoCat: boolean;
}

type Step = "upload" | "preview" | "result";
type FileMode = "csv" | "pdf";

export function CsvImportDialog({ open, onOpenChange, categories, onSuccess }: Props) {
  const { lang } = useLang();

  const [step, setStep]             = useState<Step>("upload");
  const [fileMode, setFileMode]     = useState<FileMode>("csv");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [headers, setHeaders]       = useState<string[]>([]);
  const [rawRows, setRawRows]       = useState<string[][]>([]);
  const [colMap, setColMap]         = useState<Partial<ColumnMap>>({});
  const [autoMapped, setAutoMapped] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [rows, setRows]             = useState<ImportRow[]>([]);
  const [showInternal, setShowInternal] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    examples: { date: string; title: string; amount: number }[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload"); setRows([]); setHeaders([]); setRawRows([]);
    setColMap({}); setError(null); setAutoMapped(false); setShowMapping(false);
    setImportResult(null); setShowInternal(false); setFileMode("csv"); setPdfLoading(false);
  }

  function buildPreview(raw: string[][], map: ColumnMap) {
    const parsed = buildParsedRows(raw, map);
    const withCats: ImportRow[] = parsed.map(r => {
      const titleType = suggestType(r.title);
      const type: "income" | "expense" = titleType ?? r.type;
      const autoTyped = !!titleType && titleType !== r.type;

      // Internal rows (CDB aplicação/resgate, cofrinho) are pre-unchecked
      const isInternalRow = r.isInternal === true;
      const typedCats = categories.filter(c => c.type === type);
      const suggested  = isInternalRow ? null : suggestCategory(r.title, typedCats);

      return {
        ...r,
        type,
        categoryId: suggested?.id ?? "__none__",
        skip: isInternalRow,   // internal = pre-unchecked
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

  async function handlePDF(file: File) {
    setError(null);
    setPdfLoading(true);
    setFileMode("pdf");
    try {
      const { parseSantanderPDF } = await import("@/lib/utils/parse-santander-pdf");
      const parsed = await parseSantanderPDF(file);

      if (!parsed.length) {
        setError(lang === "en"
          ? "No transactions found in the PDF. Make sure the file is a valid bank statement exported directly from your bank's app."
          : "Nenhuma transação encontrada no PDF. Verifique se o arquivo é um extrato bancário válido e exportado diretamente pelo app do banco."
        );
        setPdfLoading(false);
        return;
      }

      const withCats: ImportRow[] = parsed.map(r => {
        const typedCats = categories.filter(c => c.type === r.type);
        const suggested = r.isInternal ? null : suggestCategory(r.title, typedCats);
        return {
          ...r,
          categoryId: suggested?.id ?? "__none__",
          skip: r.isInternal === true,
          autoTyped: false,
          autoCat: !!suggested,
        };
      });

      setRows(withCats);
      setAutoMapped(true);
      setShowMapping(false);
      setStep("preview");
    } catch (err) {
      console.error("PDF parse error:", err);
      setError(lang === "en"
        ? "Could not read the PDF. Make sure you're sending the statement file exported directly from your bank's app or website."
        : "Não foi possível ler o PDF. Certifique-se de enviar o arquivo de extrato exportado diretamente pelo app ou site do seu banco."
      );
    }
    setPdfLoading(false);
  }

  function handleFile(file: File) {
    // Route by file type
    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPDF) { handlePDF(file); return; }

    setError(null);
    setFileMode("csv");
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
        setShowMapping(!allDetected);

        if (allDetected) {
          buildPreview(rows, suggestedMap as ColumnMap);
        }
      } catch {
        setError(lang === "en"
          ? "Could not read the file. Please check it is a valid CSV."
          : "Não foi possível ler o arquivo. Verifique se é um CSV válido."
        );
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function updateRow(idx: number, updates: Partial<ImportRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  }

  function fingerprint(date: string, amount: number, title: string) {
    // Normalize aggressively: remove accents, lowercase, strip ALL spaces.
    // This makes "LIQUIDODEVENCIMENTO" match "LIQUIDO DE VENCIMENTO" so
    // previously-imported garbled text is correctly detected as a duplicate
    // of the same transaction parsed with spaces.
    const norm = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip combining accent marks
      .replace(/[^a-z0-9]/g, "");      // strip spaces & punctuation
    return `${date}|${Math.round(amount * 100)}|${norm}`;
  }

  async function handleImport(force = false) {
    // Only import rows the user has checked (skip=false)
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
      // ── Duplicate detection ───────────────────────────────────────────────
      const dates   = toImportRows.map(r => r.date).sort();
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
      newOnly  = toImportRows.filter(r => !existingSet.has(fingerprint(r.date, r.amount, r.title)));
      skipped  = blocked.length;
      examples = blocked.slice(0, 6).map(r => ({ date: r.date, title: r.title, amount: r.amount }));

      if (!newOnly.length) {
        setImporting(false);
        setImportResult({ imported: 0, skipped, examples });
        setStep("result");
        // Still call onSuccess so the transactions list reloads and resets
        // its period filter — this reveals existing transactions even when
        // all rows were detected as duplicates.
        onSuccess();
        return;
      }
      // ─────────────────────────────────────────────────────────────────────
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
    if (error) {
      toast.error(lang === "en" ? "Import error. Please try again." : "Erro ao importar. Tente novamente.");
      return;
    }

    setImportResult({ imported: newOnly.length, skipped, examples });
    setStep("result");
    onSuccess();
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const mapReady       = colMap.dateCol !== undefined && colMap.titleCol !== undefined && colMap.amountCol !== undefined;
  const normalRows     = rows.filter(r => !r.isInternal);
  const internalRows   = rows.filter(r => r.isInternal);
  const toImport       = rows.filter(r => !r.skip).length;
  const autoTagged     = normalRows.filter(r => !r.skip && r.autoCat).length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lang === "en" ? "Import Statement" : "Importar Extrato"}</DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: UPLOAD ── */}
        {step === "upload" && (
          <div className="px-6 pb-4 space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /> <span>{error}</span>
              </div>
            )}

            {/* Loading overlay while parsing PDF */}
            {pdfLoading ? (
              <div className="border-2 border-dashed border-primary/40 rounded-2xl py-14 px-6 text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Loader2 size={26} className="text-primary animate-spin" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">
                  {lang === "en" ? "Reading PDF statement…" : "Lendo extrato PDF…"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "en" ? "This may take a few seconds" : "Isso pode levar alguns segundos"}
                </p>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className="border-2 border-dashed border-border/50 hover:border-primary/50 rounded-2xl py-10 px-6 text-center cursor-pointer transition-all group hover:bg-primary/[0.02]"
              >
                <div className="flex justify-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <Upload size={22} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-red-500/10 group-hover:bg-red-500/15 flex items-center justify-center transition-colors">
                    <FileText size={22} className="text-red-400" />
                  </div>
                </div>
                <p className="text-base font-semibold text-foreground mb-1">
                  {lang === "en" ? "Click or drop your file" : "Clique ou arraste o arquivo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "en"
                    ? <>Accepts <span className="font-medium text-foreground">CSV</span> or{" "}<span className="font-medium text-foreground">PDF</span> — format auto-detected</>
                    : <>Aceita <span className="font-medium text-foreground">CSV</span> ou{" "}<span className="font-medium text-foreground">PDF</span> — formato detectado automaticamente</>}
                </p>
                <input ref={fileRef} type="file" accept=".csv,.txt,.ofx,.pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            )}

            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {lang === "en" ? "How to export by bank" : "Como exportar por banco"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { bank: "Santander", steps: "Extrato Consolidado Inteligente → PDF", tag: "PDF" },
                  { bank: "Nubank",    steps: "App → Perfil → Exportar planilha",      tag: "CSV" },
                  { bank: "Inter",     steps: "Extrato → Exportar → CSV",              tag: "CSV" },
                  { bank: "Itaú",      steps: "Extrato → Baixar → Planilha",           tag: "CSV" },
                  { bank: "Bradesco",  steps: "Extrato → Gerar CSV",                   tag: "CSV" },
                  { bank: "C6",        steps: "Extrato → Exportar → Excel/CSV",        tag: "CSV" },
                ].map(({ bank, steps, tag }) => (
                  <div key={bank} className="flex items-start gap-2 rounded-lg bg-muted/20 px-3 py-2">
                    <span className="text-xs font-semibold text-foreground shrink-0 w-16">{bank}</span>
                    <span className="text-xs text-muted-foreground leading-relaxed flex-1">{steps}</span>
                    <span className={cn(
                      "text-[10px] font-bold shrink-0 mt-0.5",
                      tag === "PDF" ? "text-red-400" : "text-muted-foreground/60"
                    )}>{tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: PREVIEW ── */}
        {step === "preview" && (
          <div className="px-6 pb-2 space-y-3">

            {/* Auto-mapped banner — PDF variant */}
            {fileMode === "pdf" && rows.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                <FileText size={13} className="text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-400 font-medium">
                  {lang === "en" ? "PDF Statement — transactions extracted automatically" : "Extrato PDF — transações extraídas automaticamente"}
                </span>
              </div>
            )}

            {/* Auto-mapped banner — CSV variant */}
            {fileMode === "csv" && autoMapped && !showMapping && rows.length > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Check size={13} />
                  <span>{lang === "en" ? "Columns detected automatically" : "Colunas detectadas automaticamente"}</span>
                </div>
                <button onClick={() => setShowMapping(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <Settings2 size={11} /> {lang === "en" ? "Adjust" : "Ajustar"}
                </button>
              </div>
            )}

            {/* Column mapping — only for CSV */}
            {fileMode === "csv" && showMapping && (
              <div className="rounded-lg bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {lang === "en" ? "Column mapping" : "Mapeamento de colunas"}
                  </p>
                  {autoMapped && (
                    <button onClick={() => setShowMapping(false)} className="text-xs text-muted-foreground hover:text-foreground">
                      {lang === "en" ? "Hide" : "Ocultar"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["dateCol", "titleCol", "amountCol"] as const).map(field => (
                    <div key={field} className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {field === "dateCol"
                          ? `📅 ${lang === "en" ? "Date" : "Data"}`
                          : field === "titleCol"
                          ? `📝 ${lang === "en" ? "Description" : "Descrição"}`
                          : `💰 ${lang === "en" ? "Amount" : "Valor"}`}
                      </p>
                      <Select
                        value={colMap[field] !== undefined ? String(colMap[field]) : ""}
                        onValueChange={v => applyMap({ ...colMap, [field]: parseInt(v) })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={lang === "en" ? "Select..." : "Selecionar..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)} className="text-xs">
                              {h || `${lang === "en" ? "Column" : "Coluna"} ${i + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                {!mapReady && (
                  <p className="text-xs text-amber-400">
                    ↑ {lang === "en" ? "Select all 3 columns to see the preview" : "Selecione as 3 colunas para ver a pré-visualização"}
                  </p>
                )}
              </div>
            )}

            {fileMode === "csv" && !autoMapped && !mapReady && rows.length === 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                {lang === "en"
                  ? "Could not automatically detect columns. Please select them manually above."
                  : "Não foi possível detectar as colunas automaticamente. Selecione manualmente acima."}
              </div>
            )}

            {/* Stats bar */}
            {rows.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground">
                  {normalRows.length} {lang === "en" ? "transactions" : "transações"}
                </span>
                {internalRows.length > 0 && (
                  <span className="text-amber-400">
                    + {internalRows.length} {lang === "en" ? "internal" : "internas"}
                  </span>
                )}
                {rawRows.length > rows.length && (
                  <span className="text-red-400">
                    · {rawRows.length - rows.length} {lang === "en" ? "rows without date/amount" : "linhas sem data/valor"}
                  </span>
                )}
                <span>·</span>
                <span className="text-indigo-400">{autoTagged} {lang === "en" ? "categorized" : "categorizadas"}</span>
                <span>·</span>
                <span className="font-medium text-primary">{toImport} {lang === "en" ? "to import" : "para importar"}</span>
              </div>
            )}

            {/* Normal rows */}
            {normalRows.length > 0 && (
              <div className="space-y-1.5 max-h-[36vh] overflow-y-auto pr-1">
                {normalRows.map((row) => {
                  const idx = rows.indexOf(row);
                  const typedCats = categories.filter(c => c.type === row.type);
                  return (
                    <div key={idx} className={cn(
                      "rounded-lg border p-2.5 transition-opacity",
                      row.skip ? "opacity-35 border-border/20" : "border-border/50"
                    )}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <button
                          onClick={() => updateRow(idx, { skip: !row.skip })}
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
                          <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-indigo-400 shrink-0">
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
                          onValueChange={v => updateRow(idx, { type: v as "income" | "expense", categoryId: "__none__", autoTyped: false, autoCat: false })}
                        >
                          <SelectTrigger className="h-6 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense" className="text-xs">{lang === "en" ? "Expense" : "Despesa"}</SelectItem>
                            <SelectItem value="income"  className="text-xs">{lang === "en" ? "Income" : "Receita"}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={row.categoryId}
                          onValueChange={v => updateRow(idx, { categoryId: v, autoCat: false })}
                        >
                          <SelectTrigger className="h-6 text-xs flex-1">
                            <SelectValue placeholder={lang === "en" ? "No category" : "Sem categoria"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" className="text-xs">
                              {lang === "en" ? "No category" : "Sem categoria"}
                            </SelectItem>
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

            {/* Internal / CDB rows — collapsed by default */}
            {internalRows.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 overflow-hidden">
                <button
                  onClick={() => setShowInternal(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-500/8 hover:bg-amber-500/12 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info size={13} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-medium text-amber-400">
                      {internalRows.length} {lang === "en" ? "internal transactions hidden" : "transações internas ocultadas"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {lang === "en"
                        ? "(CDB investments/redemptions — don't affect balance)"
                        : "(CDB aplicação/resgate, cofrinho — não afetam saldo)"}
                    </span>
                  </div>
                  {showInternal ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                </button>

                {showInternal && (
                  <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto border-t border-amber-500/15 bg-muted/10">
                    <p className="text-[10px] text-muted-foreground mb-2">
                      {lang === "en" ? "Check any you want to include manually." : "Marque as que quiser incluir manualmente."}
                    </p>
                    {internalRows.map((row) => {
                      const idx = rows.indexOf(row);
                      return (
                        <div key={idx} className={cn(
                          "rounded-lg border p-2 flex items-center gap-2 transition-opacity",
                          row.skip ? "opacity-40 border-border/20" : "border-amber-500/30"
                        )}>
                          <button
                            onClick={() => updateRow(idx, { skip: !row.skip })}
                            className={cn(
                              "h-4 w-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors",
                              !row.skip ? "border-amber-400 bg-amber-400" : "border-border bg-transparent"
                            )}
                          >
                            {!row.skip && <Check size={9} className="text-black" />}
                          </button>
                          <span className="text-xs text-muted-foreground w-20 shrink-0 tabular-nums">{row.date}</span>
                          <span className="text-xs text-foreground flex-1 truncate">{row.title}</span>
                          <span className={cn("text-xs tabular-nums font-medium shrink-0",
                            row.type === "income" ? "text-emerald-400" : "text-red-400")}>
                            {row.type === "income" ? "+" : "-"}{formatCurrency(row.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                    <p className="font-semibold text-foreground">
                      {lang === "en" ? "No new transactions" : "Nenhuma transação nova"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-amber-400">
                        {importResult.skipped} {lang === "en" ? "transactions" : "transações"}
                      </span>{" "}
                      {lang === "en"
                        ? `from this ${fileMode === "pdf" ? "PDF" : "CSV"} already exist in the history.`
                        : `deste ${fileMode === "pdf" ? "PDF" : "CSV"} já existem no histórico.`}
                    </p>
                  </div>
                </div>
                {importResult.examples.length > 0 && (
                  <div className="rounded-lg bg-muted/20 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {lang === "en" ? "What's being blocked:" : "O que está sendo bloqueado:"}
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
                  {lang === "en"
                    ? "If you want to re-import anyway (e.g. corrected data):"
                    : "Se quiser reimportar mesmo assim (ex: dados corrigidos):"}
                </p>
                <Button
                  variant="outline" size="sm"
                  className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => handleImport(true)}
                  disabled={importing}
                >
                  {importing
                    ? <><Loader2 size={13} className="animate-spin" /> {lang === "en" ? "Importing..." : "Importando..."}</>
                    : lang === "en"
                      ? `Import anyway (${importResult.skipped} transaction${importResult.skipped !== 1 ? "s" : ""})`
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
                      {importResult.imported} {lang === "en" ? "transactions imported!" : "transações importadas!"}
                    </p>
                    {importResult.skipped > 0 && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-amber-400">
                          {importResult.skipped} {lang === "en" ? "already existed" : "já existiam"}
                        </span>{" "}
                        {lang === "en" ? "in the history — skipped." : "no histórico — ignoradas."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Explain filter hiding older months */}
                {importResult.skipped > 0 && (
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5 flex items-start gap-2">
                    <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {lang === "en" ? (
                        <>
                          <span className="text-foreground font-medium">The {importResult.skipped} already imported</span>{" "}
                          may be in previous months. In{" "}
                          <span className="text-foreground font-medium">Transactions</span>, change the period filter to{" "}
                          <span className="text-primary font-medium">All time</span> to see the full history.
                        </>
                      ) : (
                        <>
                          As <span className="text-foreground font-medium">{importResult.skipped} já importadas</span> podem estar em meses anteriores.
                          Em <span className="text-foreground font-medium">Transações</span>, mude o filtro de período para{" "}
                          <span className="text-primary font-medium">Tudo</span> para ver o histórico completo.
                        </>
                      )}
                    </p>
                  </div>
                )}

                {importResult.skipped > 0 && importResult.examples.length > 0 && (
                  <div className="rounded-lg bg-muted/20 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {lang === "en" ? "Examples of existing ones:" : "Exemplos das já existentes:"}
                    </p>
                    {importResult.examples.map((ex, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-20 shrink-0 tabular-nums">{ex.date}</span>
                        <span className="text-foreground flex-1 truncate">{ex.title}</span>
                        <span className="tabular-nums font-medium text-red-400 shrink-0">{formatCurrency(ex.amount)}</span>
                      </div>
                    ))}
                    <Button
                      variant="outline" size="sm"
                      className="w-full mt-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                      onClick={() => handleImport(true)}
                      disabled={importing}
                    >
                      {importing
                        ? <><Loader2 size={13} className="animate-spin" /> {lang === "en" ? "Importing..." : "Importando..."}</>
                        : lang === "en"
                          ? "Force re-import (will create duplicates!)"
                          : "Forçar reimportação (vai criar duplicatas!)"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {lang === "en" ? "Cancel" : "Cancelar"}
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>← {lang === "en" ? "Back" : "Voltar"}</Button>
              <Button onClick={() => handleImport()} disabled={importing || toImport === 0}>
                {importing
                  ? <><Loader2 size={14} className="animate-spin" /> {lang === "en" ? "Importing..." : "Importando..."}</>
                  : lang === "en"
                    ? `Import ${toImport} transaction${toImport !== 1 ? "s" : ""}`
                    : `Importar ${toImport} transações`}
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>
                {lang === "en" ? "Import another file" : "Importar outro arquivo"}
              </Button>
              <Button onClick={() => { onOpenChange(false); reset(); }}>
                {lang === "en" ? "Close" : "Fechar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
