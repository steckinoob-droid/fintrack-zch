/**
 * Extracts 1–2 meaningful tokens from a transaction title to identify
 * the merchant, for use in "apply to similar" category suggestions.
 *
 * Algorithm:
 *  1. Lowercase + strip combining accent characters
 *  2. Non-alphanumeric characters → single space
 *  3. Remove standalone runs of 4+ digits (CNPJ fragments, payment codes)
 *  4. Drop common financial/corporate stop words
 *  5. Keep up to 2 words with ≥ 3 characters
 *
 * Returns [] when the title is too generic to match safely (all stop words,
 * or the only remaining token is shorter than 4 characters).
 *
 * Examples:
 *   "99 FOOD LTDA."           → ["99", "food"]
 *   "99FOOD *123456"          → ["99food"]
 *   "UBER TRIP HELP.UBER.COM" → ["uber", "trip"]
 *   "IFOOD.COM AGENCIA"       → ["ifood"]
 *   "NETFLIX.COM"             → ["netflix"]
 *   "PIX ENVIADO"             → []
 *   "TED DEBIT 123456789"     → []
 *   "AMAZON PRIME"            → ["amazon", "prime"]
 */

const STOP_WORDS = new Set([
  // Corporate suffixes
  "ltda", "eireli", "epp", "mei", "sa",
  // Banking operation labels (common in Brazilian bank statements)
  "pix", "ted", "doc", "tef",
  "pgto", "pag", "pagto", "comp",
  "debito", "credito", "debit", "cred",
  "enviado", "recebido", "envi", "receb",
  "parc", "fatura", "boleto", "compra",
  // Domain fragments
  "com", "br", "net", "org", "app",
  // Generic nouns that appear across many merchants
  "loja", "agencia", "digital", "online", "servico",
]);

/**
 * Returns an array of 0–2 merchant tokens suitable for building an AND-ilike query.
 * An empty array means the title is too generic to use for similarity matching.
 */
export function merchantTokens(title: string): string[] {
  if (!title) return [];
  try {
    const normalized = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")  // strip combining accent chars
      .replace(/[^a-z0-9]+/g, " ")       // non-alphanumeric → space
      .trim();

    // Remove standalone runs of 4+ digits (payment codes, CNPJ fragments, etc.)
    const cleaned = normalized
      .replace(/\b\d{4,}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = cleaned
      .split(" ")
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

    if (words.length === 0) return [];
    // A single very short token is too ambiguous for safe matching
    if (words.length === 1 && words[0].length < 4) return [];

    return words.slice(0, 2);
  } catch {
    return [];
  }
}
