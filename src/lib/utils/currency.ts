/** Maps currency codes to their natural locale for number formatting. */
const CURRENCY_LOCALES: Record<string, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  ARS: "es-AR",
  MXN: "es-MX",
  CLP: "es-CL",
  COP: "es-CO",
  PEN: "es-PE",
  UYU: "es-UY",
  CAD: "en-CA",
  AUD: "en-AU",
  CHF: "de-CH",
  JPY: "ja-JP",
};

export function formatCurrency(value: number, currency = "BRL", locale?: string): string {
  const loc = locale ?? CURRENCY_LOCALES[currency] ?? "pt-BR";
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

/** Extract the narrow currency symbol (e.g. "$" for USD, "R$" for BRL). */
export function getCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(1);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Compact representation: "R$ 1,2k", "$ 3.4M", etc. No hard-coded symbols. */
export function formatCompact(value: number, currency = "BRL"): string {
  const abs  = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const sym  = getCurrencySymbol(currency);
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}${sym}${(abs / 1_000).toFixed(1)}k`;
  return formatCurrency(value, currency);
}

export function parseCurrency(value: string): number {
  // Handles both "1.234,56" (pt-BR) and "1,234.56" (en-US)
  const cleaned = value.replace(/[^\d.,\-]/g, "");
  // If comma appears after dot, it's a decimal comma (pt-BR style)
  const lastDot   = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastComma > lastDot) {
    // pt-BR: dots are thousand separators, comma is decimal
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // en-US: commas are thousand separators, dot is decimal
  return parseFloat(cleaned.replace(/,/g, "")) || 0;
}
