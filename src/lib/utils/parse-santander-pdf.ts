/**
 * Parser for Santander "Extrato Consolidado Inteligente" PDF statements.
 *
 * Strategy:
 *  1. Extract text items with (x, y) positions via pdfjs-dist
 *  2. Group items into rows by Y coordinate (tolerance 3pt)
 *  3. Within each row sort left→right by X and join with a space
 *  4. Locate the "Conta Corrente → Movimentação" section
 *  5. Parse each reconstructed line with pattern matching
 *
 * Amount format: "3.880,11" (positive) | "100,00-" (trailing dash = expense)
 * Doc numbers:   always 6 digits (e.g. "010504") or "-" for PIX
 * Date format:   "DD/MM" in the Data column, year from statement header
 */

import type { ParsedRow } from "./csv-parser";

// ── PT month abbreviations ───────────────────────────────────────────────────
const PT_MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

// ── Pattern helpers ──────────────────────────────────────────────────────────

/** Normalize: lowercase, remove diacritics, collapse whitespace */
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the trailing amount(s) from a reconstructed table row.
 *
 * Santander row endings:
 *  - "[doc6] [movimento]"             e.g. "010504 3.880,11"
 *  - "[doc6] [movimento]-"            e.g. "075567 45,00-"
 *  - "[doc6] [movimento]- [saldo]"    e.g. "434698 815,00- 8.880,83"
 *  - "[doc6][movimento]-[saldo]"      concatenated variant
 *  - "- [movimento]-"                 PIX with dash doc
 *
 * Returns null if no amount is found.
 */
const TRAILING_RE =
  /(?:(\d{6}|-)\s*)?((\d{1,3}(?:\.\d{3})*,\d{2})(-?))\s*(\d{1,3}(?:\.\d{3})*,\d{2})?$/;

interface AmountResult {
  amount: number;
  negative: boolean;
  descPart: string; // everything BEFORE doc+amount
}

function extractTrailingAmount(line: string): AmountResult | null {
  const m = line.match(TRAILING_RE);
  if (!m) return null;

  const [fullMatch, , , amtStr, sign] = m;
  const amount = parseFloat(amtStr.replace(/\./g, "").replace(",", "."));
  if (isNaN(amount)) return null;

  const descPart = line.slice(0, line.length - fullMatch.length).trim();
  return { amount, negative: sign === "-", descPart };
}

// ── Pattern helpers (handle both spaced and concatenated PDF text) ────────────
//
// Some pages (e.g. page 3 of the Santander PDF) have all text concatenated
// without spaces: "COMPRACARTAODEBMC" instead of "COMPRA CARTAO DEB MC".
// We match patterns against both the raw-normalized string AND a space-stripped
// version so we never miss a discard/type match.

/** Match needle against haystack, tolerating absent spaces in either string. */
function matchesNorm(haystack: string, needle: string): boolean {
  const h  = norm(haystack);
  const hs = h.replace(/\s/g, "");
  const ns = needle.replace(/\s/g, "");
  return h.startsWith(needle) || h.includes(needle) || hs.startsWith(ns) || hs.includes(ns);
}

// ── Skip / discard rules ─────────────────────────────────────────────────────

const DISCARD_NORM = [
  "saldo em", "saldo anterior", "saldo atual", "saldo de conta",
  "saldo bloqueado", "saldo disponivel",
  "remuneracao aplicacao", "remuneracao basica",
  "juros taxa",
  "para: 1432",           // TRANSFERENCIA PROGRAMADA destination line
  "extrato_pf",
  "balp_uy",
  "pagina:",
  "data descri",          // column header row (spaced pages)
  "extrato consolidado",  // page header (spaced) / "extratoconsolidado" (concatenated)
  "venha conhecer",       // advertising block
  "fale conosco",
  "central de atendimento",
  "prezada",
  "nome\n", "agencia",    // summary table labels
];

function shouldDiscard(line: string): boolean {
  // Also discard pure month/year lines like "maio/2026"
  if (/^[a-záàãâéêíóôõúç]+\/\d{4}$/i.test(norm(line))) return true;
  return DISCARD_NORM.some(d => matchesNorm(line, d));
}

const SECTION_END_NORM = [
  "saldos por periodo",
  "poupanca",
  "creditos contratados",
  "investimentos",
  "limite da conta",
  "comparando o seu perfil",
];

function isSectionEnd(line: string): boolean {
  return SECTION_END_NORM.some(d => matchesNorm(line, d));
}

// ── Type detection ───────────────────────────────────────────────────────────

const INCOME_NORM = [
  "pix recebido",
  "pix devolvido",
  "liquido de vencimento",
  "ted recebid",
  "deposito em conta",
  "credito em conta",
  "transferencia recebida",
  "walker corretora",
];

const EXPENSE_NORM = [
  "pix enviado",
  "compra cartao",
  "pagamento de boleto",
  "saque",
  "transferencia programada",
];

function detectType(desc: string, negative: boolean): "income" | "expense" {
  if (INCOME_NORM.some(k => matchesNorm(desc, k))) return "income";
  if (EXPENSE_NORM.some(k => matchesNorm(desc, k))) return "expense";
  // Trailing dash is the most reliable signal
  return negative ? "expense" : "income";
}

// ── Internal/skip transactions ───────────────────────────────────────────────

const INTERNAL_NORM = [
  "remuneracao aplicacao automatica",
  "remuneracao basica",
  "juros taxa",
];

function isInternal(desc: string): boolean {
  return INTERNAL_NORM.some(k => matchesNorm(desc, k));
}

// ── Title cleanup ─────────────────────────────────────────────────────────────
//
// Santander/Bradesco PDFs concatenate a payment-method suffix directly onto the
// merchant name: "JulianadeSouzaSaturnin COMPRACARTAODEBMC".
// We strip those noise tokens and add spaces at CamelCase boundaries so the
// title is human-readable both in the import preview and after it's saved.

/**
 * Clean up a raw PDF transaction title for display / storage.
 * Safe to call on already-clean titles — returns them unchanged.
 */
export function cleanTitle(raw: string): string {
  let t = raw
    // Strip Santander/Bradesco debit-card suffix codes (all variants)
    .replace(/COMPRACARTAODEBMC/gi, "")
    .replace(/COMPRA\s*CART[AÃ]O\s*DEB?\s*(?:MC|BMC)?/gi, "")
    // Strip leading embedded "DD/MM" date (belt-and-suspenders)
    .replace(/^\d{2}\/\d{2}\s*/, "")
    // Strip trailing 6-digit document numbers
    .replace(/\s+\d{6}$/, "")
    // Strip stray leading/trailing dashes and spaces
    .replace(/^\s*-\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  // Nothing left after cleanup → generic fallback
  if (!t) return "Compra Débito";

  // CamelCase → spaces: "JulianadeSouzaSaturnin" → "Julianade Souza Saturnin"
  // Handles PIX recipient names stored in PascalCase.
  t = t.replace(/([a-záàãâéêíóôõúç])([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ])/g, "$1 $2");

  return t.trim();
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function toISO(dd: string, mm: string, year: number) {
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// ── pdfjs extraction ─────────────────────────────────────────────────────────

/** Only the fields we actually use from a pdfjs TextItem */
interface TextItem {
  str: string;
  transform: number[]; // [a,b,c,d,x,y]
  width?: number;
}

/**
 * pdfjs content.items is Array<TextItem | TextMarkedContent>.
 * TextMarkedContent has { type, id } but NO str/transform/width.
 * We guard with this type predicate so we never call .str on the wrong shape.
 */
function isTextItem(item: unknown): item is TextItem {
  return typeof (item as TextItem).str === "string";
}

async function extractAllLines(
  buffer: ArrayBuffer
): Promise<{ lines: string[]; year: number }> {
  // Dynamically import pdfjs only in the browser
  const pdfjsLib = await import("pdfjs-dist");

  // Use the worker we copy to /public during build (see package.json prebuild).
  // Falls back to unpkg if the local copy is somehow missing.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  let year = new Date().getFullYear();
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Filter out TextMarkedContent items (no .str) — only keep real text items
    const items = (content.items as unknown[]).filter(isTextItem);

    // Detect statement year from any page header (e.g. "maio/2026")
    if (p <= 2) {
      const raw = items.map(i => i.str).join(" ");
      const m = raw.match(/\/(\d{4})/);
      if (m) year = parseInt(m[1], 10);
    }

    // Group items by Y coordinate (tolerance 3 pt)
    const rows: { y: number; items: TextItem[] }[] = [];
    const YTOL = 3;
    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = item.transform[5];
      const row = rows.find(r => Math.abs(r.y - y) <= YTOL);
      if (row) row.items.push(item);
      else rows.push({ y, items: [item] });
    }

    // Sort rows top→bottom (larger Y = higher on page in PDF coords)
    rows.sort((a, b) => b.y - a.y);

    for (const row of rows) {
      // Sort items left→right by X
      row.items.sort((a, b) => a.transform[4] - b.transform[4]);

      // Build line, adding spaces when there's a horizontal gap > 4pt
      let line = "";
      let prevX = -999;
      let prevW = 0;
      for (const item of row.items) {
        const x = item.transform[4];
        const gap = x - (prevX + prevW);
        if (line && gap > 4) line += " ";
        line += item.str;
        prevX = x;
        // Estimate item width from reported width or char count fallback
        prevW = (item.width !== undefined && item.width > 0) ? item.width : item.str.length * 5;
      }
      line = line.trim();
      if (line) allLines.push(line);
    }
  }

  return { lines: allLines, year };
}

// ── Main parser ──────────────────────────────────────────────────────────────

export async function parseSantanderPDF(file: File): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const { lines, year } = await extractAllLines(buffer);

  const transactions: ParsedRow[] = [];

  let inSection = false;  // inside "Conta Corrente" > "Movimentação"

  let currentDate: string | null = null;
  let descAccum: string[] = [];

  function flush(amount: number, negative: boolean, extraDesc: string) {
    const parts = [...descAccum, extraDesc].filter(Boolean);
    descAccum = [];
    const raw = parts.join(" ").trim();
    const desc = cleanTitle(raw);   // strips noise suffixes + CamelCase spacing

    if (!desc || !currentDate) return;
    if (shouldDiscard(desc)) return;

    const internal = isInternal(desc);
    const type = detectType(desc, negative);

    transactions.push({
      date: currentDate,
      title: desc,
      amount,
      type,
      isInternal: internal || undefined,
    });
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // ── Section detection ─────────────────────────────────────────────────
    // The "Movimentação" sub-heading inside "Conta Corrente" marks the start.
    // NOTE: pdfjs does NOT extract the visual column-header row ("Data /
    // Descrição / Nº Documento / Movimento / Saldo") — those are styled table
    // cells rendered as vector graphics. We therefore start processing
    // immediately after finding "Movimentação", with no header-row gate.
    if (!inSection) {
      if (matchesNorm(line, "movimentacao")) {
        inSection = true;
        continue;
      }
      continue;
    }

    // ── Section end ───────────────────────────────────────────────────────
    if (isSectionEnd(line)) break;

    // ── Discard rows ──────────────────────────────────────────────────────
    if (shouldDiscard(line)) continue;

    // ── Try to extract trailing amount ────────────────────────────────────
    const parsed = extractTrailingAmount(line);

    if (parsed) {
      // Date at start of descPart?
      // Use (?!\d) instead of \b: on page 3 text is concatenated with no
      // spaces, e.g. "01/05MARCIAESTÉTICA" — \b fails between "5" and "M"
      // because both are word characters, so the date was silently skipped.
      let { descPart } = parsed;
      const dateM = descPart.match(/^(\d{2})\/(\d{2})(?!\d)/);
      if (dateM) {
        currentDate = toISO(dateM[1], dateM[2], year);
        descPart = descPart.slice(dateM[0].length).trim();
      }

      flush(parsed.amount, parsed.negative, descPart);
      continue;
    }

    // ── No amount → date line or description continuation ─────────────────
    // Same fix: (?!\d) instead of \b for concatenated page-3 text.
    const dateM = line.match(/^(\d{2})\/(\d{2})(?!\d)/);
    if (dateM) {
      currentDate = toISO(dateM[1], dateM[2], year);
      const rest = line.slice(dateM[0].length).trim();
      // If the rest is just a doc number, ignore it
      if (rest && !/^\d{6}$/.test(rest) && rest !== "-") {
        descAccum.push(rest);
      }
    } else {
      // Skip pure doc-number lines and stray single dashes
      if (!/^\d{6}$/.test(line) && line !== "-") {
        descAccum.push(line);
      }
    }
  }

  return transactions;
}

/** Quick check: does the file look like a Santander statement? */
export async function isSantanderPDF(file: File): Promise<boolean> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = (content.items as unknown[])
      .filter(isTextItem)
      .map(i => i.str)
      .join(" ")
      .toLowerCase();
    return text.includes("santander") && text.includes("extrato");
  } catch {
    return false;
  }
}
