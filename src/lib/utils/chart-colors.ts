/**
 * Centralized chart color tokens.
 *
 * Every chart in the app derives its colors from CSS custom properties defined
 * in `globals.css` (dark) and overridden in `.light`, so charts follow the
 * active theme automatically. Recharts accepts `fill`/`stroke` as raw CSS
 * color strings, so `hsl(var(--token))` resolves at paint time.
 *
 * Do NOT hardcode hex values in chart components — add or reuse a token here.
 */

/** Semantic income/expense pair. Income reuses the primary green slot. */
export const CHART_INCOME = "hsl(var(--chart-1))";
export const CHART_EXPENSE = "hsl(var(--chart-negative))";

/** Categorical palette for pie slices / per-category bars (8 hues). */
export const CHART_PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-negative))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
] as const;

/** Token-driven structural colors (theme-aware grid, cursor, zero line). */
export const CHART_GRID = "hsl(var(--border))";
export const CHART_CURSOR = "hsl(var(--border) / 0.5)";
export const CHART_REFERENCE_LINE = "hsl(var(--muted-foreground) / 0.5)";
