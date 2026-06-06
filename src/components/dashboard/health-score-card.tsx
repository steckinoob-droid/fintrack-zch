"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { calculateHealthScore } from "@/lib/utils/health-score";
import { useLang } from "@/lib/i18n/context";
import { cn } from "@/lib/utils/cn";
import type { DashboardData } from "@/lib/types";

const STATUS_COLORS = {
  great: { bar: "bg-emerald-500", text: "text-emerald-400" },
  good:  { bar: "bg-green-500",   text: "text-green-400"   },
  warn:  { bar: "bg-amber-500",   text: "text-amber-400"   },
  bad:   { bar: "bg-red-500",     text: "text-red-400"     },
};

const GRADE_RING: Record<string, string> = {
  A: "stroke-emerald-400",
  B: "stroke-green-400",
  C: "stroke-amber-400",
  D: "stroke-orange-400",
  F: "stroke-red-400",
};

const GRADE_BG: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-green-400",
  C: "text-amber-400",
  D: "text-orange-400",
  F: "text-red-400",
};

// SVG ring — circumference = 2π × r
const R = 44;
const CIRC = 2 * Math.PI * R;

export function HealthScoreCard({ data }: { data: DashboardData }) {
  const { lang } = useLang();
  const score = useMemo(() => calculateHealthScore(data), [data]);

  if (!score.hasData) {
    return (
      <div className="glass-card p-5 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
          <span className="text-2xl font-display font-black text-muted-foreground">?</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Score de saúde financeira</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === "en" ? score.tipsEn[0]?.text : score.tips[0]?.text}
          </p>
        </div>
      </div>
    );
  }

  const dashOffset = CIRC - (score.total / 100) * CIRC;
  const tips = lang === "en" ? score.tipsEn : score.tips;
  const label = lang === "en" ? score.labelEn : score.label;

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Ring gauge */}
        <div className="relative shrink-0">
          <svg width="96" height="96" viewBox="0 0 100 100" className="-rotate-90">
            {/* Track */}
            <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor"
              strokeWidth="8" className="text-muted/30" />
            {/* Progress */}
            <circle
              cx="50" cy="50" r={R} fill="none"
              strokeWidth="8"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className={cn("transition-all duration-700", GRADE_RING[score.grade])}
            />
          </svg>
          {/* Score number centered */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-display font-black text-2xl leading-none", GRADE_BG[score.grade])}>
              {score.total}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mt-0.5">
              {score.grade}
            </span>
          </div>
        </div>

        {/* Label + summary */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-foreground">
              {lang === "en" ? "Financial Health" : "Saúde Financeira"}
            </p>
            <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-md",
              score.grade === "A" ? "bg-emerald-500/15 text-emerald-400" :
              score.grade === "B" ? "bg-green-500/15 text-green-400" :
              score.grade === "C" ? "bg-amber-500/15 text-amber-400" :
              score.grade === "D" ? "bg-orange-500/15 text-orange-400" :
                                    "bg-red-500/15 text-red-400"
            )}>
              {label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {lang === "en"
              ? "Based on savings rate, budget discipline, expense control and goals progress."
              : "Baseado em taxa de poupança, orçamentos, controle de gastos e metas."}
          </p>
        </div>
      </div>

      {/* Component bars */}
      <div className="space-y-2">
        {score.components.map(c => (
          <div key={c.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                {lang === "en" ? c.labelEn : c.labelPt}
              </span>
              <span className={cn("text-xs font-semibold tabular-nums", STATUS_COLORS[c.status].text)}>
                {c.score}/{c.max}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30">
              <div
                className={cn("h-full rounded-full transition-all duration-700", STATUS_COLORS[c.status].bar)}
                style={{ width: `${c.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      {tips.length > 0 && (
        <div className="rounded-lg bg-muted/20 p-3 space-y-1.5">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <Lightbulb size={12} className="text-amber-400 shrink-0 mt-0.5" />
              {tip.href ? (
                <Link
                  href={tip.href}
                  className="text-xs text-muted-foreground leading-relaxed underline underline-offset-2 decoration-muted-foreground/40 hover:text-foreground hover:decoration-foreground transition-colors"
                >
                  {tip.text}
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">{tip.text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
