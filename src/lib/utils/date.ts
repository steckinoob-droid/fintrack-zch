import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths,
         differenceInCalendarDays, isSameYear, startOfDay } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: ptBR });
}

export function formatMonthYear(date: string | Date, lang?: string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMMM yyyy", { locale: lang === "en" ? enUS : ptBR });
}

export function formatShortMonth(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM", { locale: ptBR });
}

export function getCurrentMonth(): string {
  return format(new Date(), "yyyy-MM-01");
}

export function getMonthRange(monthStr: string): { start: string; end: string } {
  const date = parseISO(monthStr);
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function getLast6Months(): string[] {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(format(subMonths(new Date(), i), "yyyy-MM-01"));
  }
  return months;
}

export function getPrevMonth(monthStr: string): string {
  return format(subMonths(parseISO(monthStr), 1), "yyyy-MM-01");
}

export function getNextMonth(monthStr: string): string {
  return format(addMonths(parseISO(monthStr), 1), "yyyy-MM-01");
}

/**
 * "hoje · 14:30", "ontem", "seg", "05 jun", "05/06/25"
 * createdAt is the ISO timestamp — shown as time only when date is today.
 */
export function formatRelativeDate(dateStr: string, createdAt?: string, lang?: string): string {
  const date   = parseISO(dateStr);
  const today  = startOfDay(new Date());
  const diff   = differenceInCalendarDays(today, startOfDay(date));
  const locale = lang === "en" ? enUS : ptBR;

  if (diff === 0) {
    const time = createdAt ? " · " + format(parseISO(createdAt), "HH:mm") : "";
    return lang === "en" ? `today${time}` : `hoje${time}`;
  }
  if (diff === 1) return lang === "en" ? "yesterday" : "ontem";
  if (diff < 7)  return format(date, "EEEE", { locale });
  if (isSameYear(date, new Date())) return format(date, "dd MMM", { locale });
  return format(date, "dd/MM/yy");
}

/**
 * Returns a human-readable date group label.
 * "Hoje", "Ontem", "Segunda-feira", "5 jun", "05/06/24"
 */
export function formatGroupDate(dateStr: string, lang?: string): string {
  const date   = parseISO(dateStr);
  const today  = startOfDay(new Date());
  const diff   = differenceInCalendarDays(today, startOfDay(date));
  const locale = lang === "en" ? enUS : ptBR;
  if (diff === 0) return lang === "en" ? "Today" : "Hoje";
  if (diff === 1) return lang === "en" ? "Yesterday" : "Ontem";
  if (diff < 7)  return format(date, "EEEE", { locale });
  if (isSameYear(date, new Date())) return format(date, "d MMM", { locale });
  return format(date, "dd/MM/yy");
}

export type Period = "this_month" | "last_month" | "3months" | "year" | "all";

export function getDateRange(period: Period): { start: string; end: string } | null {
  const now = new Date();
  switch (period) {
    case "this_month":
      return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { start: format(startOfMonth(lm), "yyyy-MM-dd"), end: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "3months":
      return { start: format(subMonths(now, 3), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
    case "year":
      return { start: `${now.getFullYear()}-01-01`, end: format(endOfMonth(now), "yyyy-MM-dd") };
    default:
      return null;
  }
}
