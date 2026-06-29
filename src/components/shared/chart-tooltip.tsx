"use client";

import type { TooltipContentProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

type Payload = NonNullable<
  TooltipContentProps<ValueType, NameType>["payload"]
>[number];

/**
 * Recharts injects the full set of content props at render time when this is
 * passed as `content={<ChartTooltip … />}`, so every Recharts field is optional
 * here. `valueFormatter`/`balanceLabel` are our own additions (named to avoid
 * colliding with Recharts' built-in `formatter`).
 */
type ChartTooltipProps = Partial<TooltipContentProps<ValueType, NameType>> & {
  /** Formats a numeric value for display (currency, compact, etc.). */
  valueFormatter?: (n: number) => string;
  /**
   * When provided and exactly two series are present (income, expenses),
   * appends a balance row (series[0] − series[1]) labelled with this string.
   */
  balanceLabel?: string;
};

const num = (v: ValueType | undefined): number =>
  typeof v === "number" ? v : Number(v ?? 0);

/**
 * Shared, typed Recharts tooltip used across dashboard and reports charts.
 * Reads each entry's own color (set from CHART_COLORS tokens) so swatches and
 * values match the bars in both light and dark themes.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  balanceLabel,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter ?? ((n: number) => n.toFixed(2));
  const entries = payload as Payload[];

  return (
    <div className="glass-card p-3 border border-border/60 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-foreground capitalize">{String(label ?? "")}</p>
      {entries.map((p) => {
        const color = (p.color ?? p.fill) as string | undefined;
        return (
          <div
            key={String(p.dataKey ?? p.name)}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-medium tabular-nums" style={{ color }}>
              {typeof p.value === "number" ? fmt(p.value) : String(p.value ?? "")}
            </span>
          </div>
        );
      })}
      {balanceLabel && entries.length === 2 && (
        <div className="pt-1 border-t border-border/30 flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{balanceLabel}</span>
          <span
            className={`font-semibold tabular-nums ${
              num(entries[0].value) - num(entries[1].value) >= 0
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {fmt(num(entries[0].value) - num(entries[1].value))}
          </span>
        </div>
      )}
    </div>
  );
}
