/**
 * OFX (Open Financial Exchange) parser.
 *
 * Supports both:
 *  - OFX v1 / SGML format (no closing tags on leaf elements — most Brazilian banks)
 *  - OFX v2 / XML format (well-formed XML with closing tags)
 *
 * The parser extracts <STMTTRN> blocks and converts them to the same
 * ParsedRow shape used by the CSV/PDF parsers.
 */

import type { ParsedRow } from "./csv-parser";

// ── Public types ─────────────────────────────────────────────────────────────

/** ParsedRow extended with an optional FITID for deduplication. */
export interface OFXParsedRow extends ParsedRow {
  fitId?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parse an OFX date field into YYYY-MM-DD.
 * OFX date formats:
 *   YYYYMMDD
 *   YYYYMMDDHHMMSS
 *   YYYYMMDDHHMMSS[+hh:TZ]   e.g. 20240115120000[-3:BRT]
 * We only need the first 8 characters.
 */
function parseOFXDate(raw: string): string | null {
  const clean = raw.trim().replace(/["']/g, "");
  if (clean.length < 8) return null;

  const year  = clean.slice(0, 4);
  const month = clean.slice(4, 6);
  const day   = clean.slice(6, 8);

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;

  return `${year}-${month}-${day}`;
}

/**
 * Map an OFX TRNTYPE code to the app's transaction type.
 * Falls back to the sign of the amount when the type is ambiguous.
 *
 * OFX spec codes:
 *   CREDIT, INT, DIV, DEP, DIRECTDEP, DIRECTDEBIT, REPEATPMT,
 *   DEBIT, CHECK, PAYMENT, ATM, POS, XFER, SRVCHG, FEE, OTHER
 */
function mapTrnType(trnType: string, amount: number): "income" | "expense" {
  const t = trnType.trim().toUpperCase();
  const EXPENSE_CODES = new Set(["DEBIT", "CHECK", "PAYMENT", "ATM", "POS", "FEE", "SRVCHG", "REPEATPMT"]);
  const INCOME_CODES  = new Set(["CREDIT", "INT", "DIV", "DEP", "DIRECTDEP"]);

  if (EXPENSE_CODES.has(t)) return "expense";
  if (INCOME_CODES.has(t))  return "income";

  // XFER, DIRECTDEBIT, OTHER — fall back on amount sign
  return amount < 0 ? "expense" : "income";
}

/**
 * Extract the value of a single leaf field from an OFX block.
 * Works for both SGML (<TAG>value) and XML (<TAG>value</TAG>).
 *
 * The character class [^<\n\r] stops at the next tag or newline,
 * which is correct for SGML leaves where each field occupies one line.
 */
function extractField(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\\n\\r]*)`, "i");
  const match = block.match(re);
  return match ? match[1].trim() : "";
}

/**
 * Decode basic HTML/XML character entities that sometimes appear in OFX files.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi,  "&")
    .replace(/&lt;/gi,   "<")
    .replace(/&gt;/gi,   ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * Extract all raw STMTTRN block contents from OFX text.
 * Tries XML format first; falls back to SGML (tag-soup) format.
 */
function extractBlocks(content: string): string[] {
  const blocks: string[] = [];

  // ── Try XML (OFX v2): <STMTTRN>...</STMTTRN> ────────────────────────────
  const xmlRe = /<STMTTRN[^>]*>([\s\S]*?)<\/STMTTRN>/gi;
  let m: RegExpExecArray | null;
  while ((m = xmlRe.exec(content)) !== null) {
    blocks.push(m[1]);
  }
  if (blocks.length) return blocks;

  // ── Fall back to SGML (OFX v1): <STMTTRN> until next block delimiter ────
  // The block ends at the next <STMTTRN>, </STMTTRNLIST>, <LEDGERBAL>,
  // </BANKTRANLIST>, or end-of-string.
  const sgmlRe = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTRNLIST>|<\/BANKTRANLIST>|<LEDGERBAL>|<\/OFX>|$)/gi;
  while ((m = sgmlRe.exec(content)) !== null) {
    const block = m[1].trim();
    if (block) blocks.push(block);
  }

  return blocks;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Parse an OFX file content string and return one OFXParsedRow per
 * valid <STMTTRN> block.
 *
 * Rules applied:
 * - TRNAMT sign determines income vs expense (confirmed by TRNTYPE when available)
 * - DTPOSTED → YYYY-MM-DD (timezone stripped, only date part kept)
 * - MEMO or NAME → title (falls back to FITID-based label if both are empty)
 * - Zero-amount transactions are skipped
 * - FITID stored in fitId for downstream deduplication
 */
export function parseOFX(content: string): OFXParsedRow[] {
  const blocks = extractBlocks(content);
  if (!blocks.length) return [];

  const rows: OFXParsedRow[] = [];

  for (const block of blocks) {
    const trnType = extractField(block, "TRNTYPE");
    const dtRaw   = extractField(block, "DTPOSTED") || extractField(block, "DTUSER");
    const amtRaw  = extractField(block, "TRNAMT");
    const fitId   = extractField(block, "FITID").replace(/\s+/g, "");
    const memo    = decodeEntities(
      extractField(block, "MEMO") || extractField(block, "NAME") || ""
    );

    // Skip rows missing critical fields
    if (!dtRaw || !amtRaw) continue;

    const date = parseOFXDate(dtRaw);
    if (!date) continue;

    // OFX spec mandates US number format (period as decimal separator).
    // Some Brazilian exporters use comma — normalise either.
    const amtClean = amtRaw.replace(/\s/g, "").replace(",", ".");
    const amount   = parseFloat(amtClean);
    if (isNaN(amount)) continue;

    // Skip zero-amount entries (interest notifications, balance lines, etc.)
    if (amount === 0) continue;

    // Build a human-readable title
    const title = memo.trim()
      || (fitId ? `TX ${fitId}` : "Transação sem descrição");

    const type = mapTrnType(trnType, amount);

    const row: OFXParsedRow = {
      date,
      title,
      amount: Math.abs(amount),
      type,
    };

    if (fitId) row.fitId = fitId;

    rows.push(row);
  }

  return rows;
}
