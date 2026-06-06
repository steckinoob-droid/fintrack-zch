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
}

/** Remove accents for fuzzy matching: "Descrição" → "descricao" */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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

function parseDate(s: string): string | null {
  s = s.trim().replace(/"/g, "");
  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD-MM-YYYY
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return null;
}

function parseAmount(s: string): number | null {
  const clean = s.trim().replace(/"/g, "").replace(/R\$\s*/g, "").replace(/\s/g, "");
  // Brazilian: -1.234,56 or 1.234,56
  const br = clean.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(br);
  return isNaN(n) ? null : n;
}

const DATE_KW  = ["data", "date", "dt", "competencia", "vencimento"];
const TITLE_KW = ["descri", "histor", "memo", "titulo", "lancamento", "estabeleci", "loja", "comercio", "benefici"];
const AMT_KW   = ["valor", "amount", "value", "debito", "credito", "montante", "quantia", "preco", "total"];

export function detectColumns(headers: string[]): Partial<ColumnMap> {
  const map: Partial<ColumnMap> = {};

  // First pass: keyword matching (order-independent)
  for (let i = 0; i < headers.length; i++) {
    const l = norm(headers[i]);
    if (DATE_KW.some(k => l.includes(k)) && map.dateCol === undefined)   { map.dateCol  = i; continue; }
    if (TITLE_KW.some(k => l.includes(k)) && map.titleCol === undefined)  { map.titleCol = i; continue; }
    if (AMT_KW.some(k => l.includes(k)) && map.amountCol === undefined)   { map.amountCol = i; }
  }

  // Fallback: if date + amount detected but title missing, use the first unassigned column
  if (map.dateCol !== undefined && map.amountCol !== undefined && map.titleCol === undefined) {
    const used = new Set([map.dateCol, map.amountCol]);
    const remaining = headers.map((_, i) => i).filter(i => !used.has(i));
    // prefer the column with the longest string values (most descriptive)
    if (remaining.length >= 1) map.titleCol = remaining[0];
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
    const date   = parseDate(row[map.dateCol]    ?? "");
    const amount = parseAmount(row[map.amountCol] ?? "");
    const title  = (row[map.titleCol] ?? "").trim();
    if (!date || amount === null || !title) continue;
    result.push({
      date,
      title,
      amount: Math.abs(amount),
      type: amount <= 0 ? "expense" : "income",
    });
  }
  return result;
}
