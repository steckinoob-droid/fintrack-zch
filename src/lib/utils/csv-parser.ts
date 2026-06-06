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
  typeCol?: number;       // optional "Tipo / Histórico / D|C" column
}

// ── Normalization ────────────────────────────────────────────────────────────

/** Lowercase + remove accents + replace non-alphanumeric with space */
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

// ── Parsing helpers ──────────────────────────────────────────────────────────

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
  // DD/MM/YYYY  (most common in Brazil)
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD-MM-YYYY
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  // DD/MM/YY (2-digit year)
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m3) return `20${m3[3]}-${m3[2].padStart(2, "0")}-${m3[1].padStart(2, "0")}`;
  return null;
}

export function parseAmount(s: string): number | null {
  let clean = s.trim()
    .replace(/"/g, "")
    .replace(/−/g, "-")          // Unicode MINUS SIGN → hyphen-minus (PicPay)
    .replace(/ /g, "")      // non-breaking space
    .replace(/R\$\s*/g, "")
    .replace(/\s/g, "");
  if (!clean) return null;
  // Brazilian format: 1.234,56 or -1.234,56
  const hasBrComma = /\d,\d{1,2}$/.test(clean);
  const hasBrDot   = /\d\.\d{3}/.test(clean);
  if (hasBrComma || hasBrDot) {
    const br = clean.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(br);
    return isNaN(n) ? null : n;
  }
  // US format or plain number
  const n = parseFloat(clean.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// ── Type cell parsing ────────────────────────────────────────────────────────

/**
 * Parse a "tipo / histórico / natureza" column value from any Brazilian bank.
 * Returns "income", "expense", or null when ambiguous (caller decides).
 */
function parseTypeCell(s: string): "income" | "expense" | null {
  const v = norm(s);
  if (!v) return null;

  const INCOME = [
    "c", "cred", "credito",
    // PIX / TED received
    "pix recebido", "ted recebida", "tef credito", "doc recebido",
    // Reversals that come back to you
    "pix enviado devolvido", "pix devolvido",
    // Deposits / income
    "deposito", "deposito em conta", "credito em conta",
    "transferencia recebida", "transf recebida", "transf credito",
    "recebimento", "receita", "entrada", "credit",
    // PicPay
    "dinheiro resgatado", "compra estornada",
    // Estorno (refund to you) — but NOT Estorno of investment
    "estorno",
  ];

  const EXPENSE = [
    "d", "deb", "debito",
    // PIX / TED sent
    "pix enviado", "ted enviada", "tef debito", "doc enviado",
    // Purchases / payments
    "compra realizada", "compra credito", "compra debito", "compra",
    "pagamento realizado", "pagamento efetuado",
    "transferencia enviada", "transf enviada", "transf debito",
    "saque", "anuidade", "tarifa", "taxa",
    // PicPay
    "dinheiro guardado",
    // Generic
    "saida", "debit", "despesa",
  ];

  // Income check first (more specific patterns take priority)
  for (const t of INCOME)   { if (v.includes(norm(t))) return "income"; }
  for (const t of EXPENSE)  { if (v.includes(norm(t))) return "expense"; }
  return null;
}

// ── Column keyword lists ─────────────────────────────────────────────────────

const DATE_KW = [
  "data", "date", "dt", "data lancamento", "lancamento",
  "competencia", "vencimento", "data movim", "data transacao",
];

// Columns that are time-only (HH:MM) — never used as the date column
const TIME_KW = ["hora", "horario", "time", "hour", "hh", "hhmm"];

const TYPE_KW = [
  // Generic
  "tipo", "natureza", "operacao", "dc ", "d c",
  // Bank-specific
  "historico",          // Banco Inter: "Histórico" = Pix recebido / Pix enviado / Aplicação
  "tipo lancamento", "tipo operacao", "tipo transacao",
  "entrada saida", "categoria transacao",
  "movimentacao",       // some Itaú exports
];

const TITLE_KW = [
  // Common description field names
  "descri", "memo", "titulo", "estabeleci",
  "loja", "comercio", "benefici", "detalhe", "observa",
  // PIX / TED / transfer participants
  "origem", "destino", "beneficiario", "pagador", "remetente",
  "destinatario", "nome", "titular", "razao social", "favorecido",
  "contrapart", "portador", "particip",
];

const AMT_KW = [
  "valor", "amount", "value", "montante",
  "quantia", "total", "moviment",
  // Some banks separate debit/credit amounts — both are "amount" columns
  "valor debito", "valor credito", "debito", "credito",
];

// Columns to IGNORE (balance, account, etc.)
const IGNORE_KW = ["saldo", "balance", "conta", "agencia", "banco"];

// ── Header detection ─────────────────────────────────────────────────────────

/**
 * Scan the first N lines to find the real data header row.
 * Handles CSVs that have metadata lines before the actual column headers
 * (e.g. Banco Inter exports 4 metadata lines before "Data Lançamento;Histórico;...")
 */
function findHeaderRow(lines: string[]): { idx: number; delim: string } {
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Try to detect a delimiter from this line
    const delim = detectDelimiter(line);
    const cols  = splitLine(line, delim);
    if (cols.length < 2) continue; // metadata lines typically have 1-2 fields

    const colNorms = cols.map(norm);

    const hasDate   = colNorms.some(c => DATE_KW.some(k  => c.includes(norm(k))));
    const hasAmount = colNorms.some(c => AMT_KW.some(k   => c.includes(norm(k))));
    const hasTitle  = colNorms.some(c => TITLE_KW.some(k => c.includes(norm(k))));
    const hasType   = colNorms.some(c => TYPE_KW.some(k  => c.includes(norm(k))));

    // Valid header: has at least date OR amount, PLUS one other recognizable column
    const score = [hasDate, hasAmount, hasTitle, hasType].filter(Boolean).length;
    if (score >= 2 && (hasDate || hasAmount)) {
      return { idx: i, delim };
    }
  }

  // Fallback: assume first non-empty line
  const firstIdx = lines.findIndex(l => l.trim());
  return { idx: firstIdx >= 0 ? firstIdx : 0, delim: detectDelimiter(lines[0] ?? "") };
}

// ── Column detection ─────────────────────────────────────────────────────────

export function detectColumns(headers: string[]): Partial<ColumnMap> {
  const map: Partial<ColumnMap> = {};

  for (let i = 0; i < headers.length; i++) {
    const l = norm(headers[i]);
    if (!l) continue;

    // Skip balance / ignore columns
    if (IGNORE_KW.some(k => l === norm(k) || l.startsWith(norm(k)))) continue;
    // Skip time-only columns
    if (TIME_KW.some(k => l === norm(k))) continue;

    // Priority: TYPE → DATE → TITLE → AMOUNT
    if (map.typeCol   === undefined && TYPE_KW.some(k  => l.includes(norm(k)))) { map.typeCol   = i; continue; }
    if (map.dateCol   === undefined && DATE_KW.some(k  => l.includes(norm(k)))) { map.dateCol   = i; continue; }
    if (map.titleCol  === undefined && TITLE_KW.some(k => l.includes(norm(k)))) { map.titleCol  = i; continue; }
    if (map.amountCol === undefined && AMT_KW.some(k   => l.includes(norm(k)))) { map.amountCol = i; }
  }

  // Fallback: date + amount found but no title → pick first unassigned non-system column
  if (map.dateCol !== undefined && map.amountCol !== undefined && map.titleCol === undefined) {
    const used = new Set<number>(
      [map.dateCol, map.amountCol, map.typeCol].filter((v): v is number => v !== undefined)
    );
    const candidates = headers
      .map((h, i) => ({ i, l: norm(h) }))
      .filter(({ i, l }) =>
        !used.has(i) &&
        !TIME_KW.some(k => l === norm(k)) &&
        !DATE_KW.some(k => l.includes(norm(k))) &&
        !IGNORE_KW.some(k => l === norm(k) || l.startsWith(norm(k)))
      );
    if (candidates.length >= 1) map.titleCol = candidates[0].i;
  }

  return map;
}

// ── Internal-transfer skip rules ─────────────────────────────────────────────

/**
 * Returns true for rows that represent internal fund movements with no net
 * financial impact: savings-jar deposits (PicPay cofrinho), CDB investment
 * applications/redemptions (Inter), transaction reversals against investments.
 */
function isInternalTransfer(rawType: string, title: string): boolean {
  const t = norm(rawType);
  const d = norm(title);

  return (
    // PicPay: cofrinho
    d.includes("cofrinho") ||
    t === norm("Dinheiro guardado") ||
    t === norm("Dinheiro resgatado") ||

    // Banco Inter: CDB investment movements
    t === norm("Aplicação") ||
    t === norm("Aplicacao")  ||
    t === norm("Resgate")    ||

    // Estorno of an investment application (reversed investment, not a real refund)
    (t === norm("Estorno") && (d === norm("Aplicação") || d === norm("Aplicacao") || d.includes("cdb"))) ||

    // Any row where the description is literally "Aplicação" (Inter estorno pattern)
    d === norm("Aplicacao") ||

    // CDB porquinho (Inter savings account) — description contains "cdb porq"
    (d.includes("cdb porq") || d.includes("porquinho"))
  );
}

// ── Main exports ─────────────────────────────────────────────────────────────

export function parseCSV(content: string): {
  headers: string[];
  rows: string[][];
  suggestedMap: Partial<ColumnMap>;
} {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error("Arquivo CSV inválido ou vazio");

  // Find the actual header row (may not be line 0 for Inter and similar)
  const { idx: headerIdx, delim } = findHeaderRow(lines);

  const headers = splitLine(lines[headerIdx], delim);
  const rows = lines
    .slice(headerIdx + 1)
    .map(l => splitLine(l, delim))
    .filter(r => r.some(c => c.trim()));

  return { headers, rows, suggestedMap: detectColumns(headers) };
}

export function buildParsedRows(rows: string[][], map: ColumnMap): ParsedRow[] {
  const result: ParsedRow[] = [];

  for (const row of rows) {
    const rawDate   = row[map.dateCol]   ?? "";
    const rawAmount = row[map.amountCol] ?? "";
    const rawTitle  = row[map.titleCol]  ?? "";
    const rawType   = map.typeCol !== undefined ? (row[map.typeCol] ?? "") : "";

    const date  = parseDate(rawDate);
    const amount = parseAmount(rawAmount);
    const title  = rawTitle.trim();

    if (!date || amount === null || !title) continue;

    // Skip internal investment / savings-jar transfers
    if (isInternalTransfer(rawType, title)) continue;

    // ── Type resolution ───────────────────────────────────────────────────
    let type: "income" | "expense" | null = null;

    // 1. Negative amount → always expense (money left the account)
    if (amount < 0) {
      type = "expense";
    }

    // 2. Explicit type column (most reliable for banks with always-positive amounts)
    if (!type && rawType) {
      type = parseTypeCell(rawType);
    }

    // 3. Positive amount with no type info → income
    //    (works for Inter where positives = received money)
    if (!type && amount > 0) {
      type = "income";
    }

    // 4. Ultimate fallback
    if (!type) type = "expense";

    result.push({ date, title, amount: Math.abs(amount), type });
  }

  return result;
}
