export interface ParsedRow {
  date: string;           // YYYY-MM-DD
  title: string;
  amount: number;         // always positive
  type: "income" | "expense";
}

export interface ColumnMap {
  dateCol: number;
  titleCol: number;
  amountCol: number;
  typeCol?: number;       // optional "Tipo / Natureza / D|C" column
}

/** Normalize: lowercase + remove accents + replace non-alphanumeric with space */
function norm(s: string): string {
  if (!s) return "";
  try {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  } catch {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
}

function detectDelimiter(line: string): string {
  const s = (line.match(/;/g) ?? []).length;
  const c = (line.match(/,/g) ?? []).length;
  const t = (line.match(/\t/g) ?? []).length;
  if (s > c && s > t) return ";";
  if (t > c) return "\t";
  return ",";
}

function splitLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === delim && !inQ) { result.push(cur.trim().replace(/^"|"$/g, "")); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur.trim().replace(/^"|"$/g, ""));
  return result;
}

export function parseDate(s: string): string | null {
  s = s.trim().replace(/"/g, "");
  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD-MM-YYYY
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  // MM/DD/YYYY (US format — less common)
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[1].padStart(2, "0")}-${m3[2].padStart(2, "0")}`;
  return null;
}

export function parseAmount(s: string): number | null {
  const clean = s.trim().replace(/"/g, "").replace(/R\$\s*/g, "").replace(/\s/g, "");
  if (!clean) return null;
  // Detect if Brazilian format (1.234,56) or US format (1,234.56)
  const hasBrComma = /\d,\d{1,2}$/.test(clean);
  const hasBrDot   = /\d\.\d{3}/.test(clean);
  if (hasBrComma || hasBrDot) {
    // Brazilian: remove thousand dots, replace comma with period
    const br = clean.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(br);
    return isNaN(n) ? null : n;
  }
  // US format or simple
  const simple = clean.replace(/,/g, "");
  const n = parseFloat(simple);
  return isNaN(n) ? null : n;
}

/**
 * Parse the "type" column value exported by Brazilian banks.
 * Returns "income", "expense", or null if ambiguous.
 */
function parseTypeCell(s: string): "income" | "expense" | null {
  const v = norm(s);
  if (!v) return null;

  // Debit / expense patterns
  const isExpense =
    v === "d" || v === "deb" || v === "debito" ||
    v.includes("saida") || v.includes("saída") ||
    v.includes("debito") || v.includes("debit") ||
    v.includes("pagamento") || v.includes("despesa") ||
    v.includes("compra");

  // Credit / income patterns
  const isIncome =
    v === "c" || v === "cred" || v === "credito" ||
    v.includes("entrada") || v.includes("credito") ||
    v.includes("credit") || v.includes("deposito") ||
    v.includes("recebimento") || v.includes("receita");

  if (isExpense && !isIncome) return "expense";
  if (isIncome && !isExpense) return "income";
  return null;
}

const DATE_KW  = ["data", "date", "dt", "competencia", "vencimento", "lancamento data"];
// Columns that look like date/time but are NOT the main date — skip for title fallback
const TIME_KW  = ["hora", "horario", "time", "hour", "hh", "hhmm"];
const TITLE_KW = [
  "descri", "histor", "memo", "titulo", "lancamento", "estabeleci",
  "loja", "comercio", "benefici", "detalhe", "observa", "particip",
  // PIX / TED / bank transfer fields
  "origem", "destino", "beneficiario", "pagador", "remetente",
  "destinatario", "nome", "titular", "razao social", "favorecido",
  "contrapart", "portador",
];
const AMT_KW   = ["valor", "amount", "value", "debito", "credito", "montante",
                  "quantia", "preco", "total", "moviment"];
// "Tipo", "Natureza", "D/C", "Operação" — separate from amount
const TYPE_KW  = ["tipo", "natureza", "operacao", "dc ", "d c", "entrada saida",
                  "categoria transacao", "tipo lancamento", "tipo operacao"];

export function detectColumns(headers: string[]): Partial<ColumnMap> {
  const map: Partial<ColumnMap> = {};

  // First pass: keyword matching (order-independent)
  for (let i = 0; i < headers.length; i++) {
    const l = norm(headers[i]);
    // Skip time-only columns — they look like dates but aren't the main date column
    if (TIME_KW.some(k => l === norm(k))) continue;
    if (map.typeCol   === undefined && TYPE_KW.some(k  => l.includes(norm(k))))   { map.typeCol   = i; continue; }
    if (map.dateCol   === undefined && DATE_KW.some(k  => l.includes(norm(k))))   { map.dateCol   = i; continue; }
    if (map.titleCol  === undefined && TITLE_KW.some(k => l.includes(norm(k))))   { map.titleCol  = i; continue; }
    if (map.amountCol === undefined && AMT_KW.some(k   => l.includes(norm(k))))   { map.amountCol = i; }
  }

  // Fallback: if date + amount detected but title missing,
  // pick the first unassigned column that is NOT a time/date/type column
  if (map.dateCol !== undefined && map.amountCol !== undefined && map.titleCol === undefined) {
    const used = new Set<number>(
      [map.dateCol, map.amountCol, map.typeCol].filter((v): v is number => v !== undefined)
    );
    const candidates = headers
      .map((h, i) => ({ i, l: norm(h) }))
      .filter(({ i, l }) =>
        !used.has(i) &&
        !TIME_KW.some(k => l === norm(k)) &&    // skip "hora"
        !DATE_KW.some(k => l.includes(norm(k))) // skip secondary date cols
      );
    if (candidates.length >= 1) map.titleCol = candidates[0].i;
  }

  return map;
}

export function parseCSV(content: string): {
  headers: string[];
  rows: string[][];
  suggestedMap: Partial<ColumnMap>;
} {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("Arquivo CSV inválido ou vazio");
  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim);
  const rows = lines.slice(1)
    .map(l => splitLine(l, delim))
    .filter(r => r.some(c => c.trim()));
  return { headers, rows, suggestedMap: detectColumns(headers) };
}

export function buildParsedRows(rows: string[][], map: ColumnMap): ParsedRow[] {
  const result: ParsedRow[] = [];
  for (const row of rows) {
    const rawDate   = row[map.dateCol]    ?? "";
    const rawAmount = row[map.amountCol]  ?? "";
    const rawTitle  = row[map.titleCol]   ?? "";
    const rawType   = map.typeCol !== undefined ? (row[map.typeCol] ?? "") : "";

    const date   = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    const title  = rawTitle.trim();

    if (!date || amount === null || !title) continue;

    // ── Type resolution (priority order) ───────────────────────────────────
    // 1. Explicit type column (most reliable when present)
    let type: "income" | "expense" | null = rawType ? parseTypeCell(rawType) : null;

    // 2. Amount sign (negative = expense)
    if (!type) {
      if (amount < 0) type = "expense";
      else if (amount > 0) type = null; // positive alone isn't conclusive for all banks
    }

    // 3. Default to expense when ambiguous (most bank rows are purchases)
    if (!type) type = "expense";

    result.push({ date, title, amount: Math.abs(amount), type });
  }
  return result;
}
