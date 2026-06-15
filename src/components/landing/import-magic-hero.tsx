"use client";

import { useEffect, useState, useRef } from "react";
import { FileText, Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n/context";

/* ── Count-up hook ────────────────────────────────────────────── */
function useCountUp(target: number, duration = 900, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

/* ── Donut SVG ────────────────────────────────────────────────── */
function DonutChart({ animate }: { animate: boolean }) {
  // 3 slices: food 38%, transport 27%, leisure 35%
  const slices = [
    { pct: 38, color: "#10b981", offset: 0 },
    { pct: 27, color: "#6366f1", offset: 38 },
    { pct: 35, color: "#f59e0b", offset: 65 },
  ];
  const r = 36;
  const circ = 2 * Math.PI * r;

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
      {slices.map((s, i) => {
        const dashArray = (s.pct / 100) * circ;
        const dashOffset = circ - (animate ? 0 : dashArray);
        const rotation = (s.offset / 100) * 360 - 90;
        return (
          <circle
            key={i}
            cx="44" cy="44" r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={`${dashArray} ${circ - dashArray}`}
            strokeDashoffset={animate ? -(s.offset / 100) * circ : circ}
            strokeLinecap="butt"
            transform={`rotate(${rotation} 44 44)`}
            style={{
              transition: animate
                ? `stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.15}s`
                : "none",
            }}
          />
        );
      })}
    </svg>
  );
}

/* ── Main component ───────────────────────────────────────────── */

const PHASES = [0, 1, 2, 3, 4] as const;
type Phase = (typeof PHASES)[number];

const LOOP_MS = [0, 700, 1350, 1950, 2500];
const RESET_MS = 5800; // pause then restart

export function ImportMagicHero() {
  const { lang } = useLang();
  const [phase, setPhase] = useState<Phase | -1>(-1);
  const [looping, setLooping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isPt = lang === "pt";

  const balance = useCountUp(4230, 900, phase >= 4);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function runLoop() {
    clearTimers();
    setPhase(-1);
    // tiny delay so reset is visible
    const t0 = setTimeout(() => {
      LOOP_MS.forEach((ms, i) => {
        const t = setTimeout(() => setPhase(i as Phase), ms + 80);
        timers.current.push(t);
      });
      // schedule next loop
      const tReset = setTimeout(runLoop, RESET_MS);
      timers.current.push(tReset);
    }, 120);
    timers.current.push(t0);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setPhase(4);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !looping) {
          setLooping(true);
          runLoop();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = isPt
    ? [
        { label: "Supermercado Pão de Açúcar", amount: "−R$ 312", cat: "Alimentação",  catColor: "bg-emerald-500/20 text-emerald-300" },
        { label: "Posto Ipiranga",              amount: "−R$ 187", cat: "Transporte",   catColor: "bg-indigo-500/20 text-indigo-300"  },
        { label: "Netflix",                     amount: "−R$ 44",  cat: "Lazer",        catColor: "bg-amber-500/20 text-amber-300"    },
        { label: "Salário",                     amount: "+R$ 5.800", cat: "Receita",    catColor: "bg-cyan-500/20 text-cyan-300"      },
      ]
    : [
        { label: "Supermarket",  amount: "−R$ 312",   cat: "Food",       catColor: "bg-emerald-500/20 text-emerald-300" },
        { label: "Gas station",  amount: "−R$ 187",   cat: "Transport",  catColor: "bg-indigo-500/20 text-indigo-300"  },
        { label: "Netflix",      amount: "−R$ 44",    cat: "Leisure",    catColor: "bg-amber-500/20 text-amber-300"    },
        { label: "Salary",       amount: "+R$ 5,800", cat: "Income",     catColor: "bg-cyan-500/20 text-cyan-300"      },
      ];

  const donutLabels = isPt
    ? [{ label: "Alimentação", color: "bg-emerald-400" }, { label: "Transporte", color: "bg-indigo-400" }, { label: "Lazer", color: "bg-amber-400" }]
    : [{ label: "Food",        color: "bg-emerald-400" }, { label: "Transport",  color: "bg-indigo-400" }, { label: "Leisure", color: "bg-amber-400" }];

  return (
    <div ref={ref} className="mx-auto w-full max-w-sm select-none" aria-hidden>
      {/* Card container */}
      <div className="relative rounded-2xl border border-border/60 bg-card/50 p-5 shadow-2xl backdrop-blur-sm">

        {/* ── Phase 0: File icon drops in ── */}
        <div className={cn(
          "mb-4 flex items-center gap-3 transition-all duration-500",
          phase >= 0 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        )}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-500/30">
            <FileText size={20} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isPt ? "extrato_junho.csv" : "statement_june.csv"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPt ? "4 transações detectadas" : "4 transactions detected"}
            </p>
          </div>
          {phase >= 0 && (
            <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/25">
              ✓ {isPt ? "Importado" : "Imported"}
            </span>
          )}
        </div>

        {/* ── Phase 1–2: Transaction rows ── */}
        <div className="mb-4 space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-border/40 bg-muted/10 px-3 py-2 transition-all duration-400",
                phase >= 1 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
              )}
              style={{
                transitionDelay: phase >= 1 ? `${i * 80}ms` : "0ms",
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{row.label}</p>
              </div>

              {/* Phase 2: category tag pops in */}
              <span className={cn(
                "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-all duration-300",
                row.catColor,
                phase >= 2 ? "opacity-100 scale-100" : "opacity-0 scale-75"
              )}
              style={{ transitionDelay: phase >= 2 ? `${i * 70 + 60}ms` : "0ms" }}>
                <Tag size={8} />
                {row.cat}
              </span>

              <span className={cn(
                "tabular-nums text-xs font-bold transition-all duration-300",
                row.amount.startsWith("+") ? "text-emerald-400" : "text-foreground/70",
                phase >= 1 ? "opacity-100" : "opacity-0"
              )}
              style={{ transitionDelay: phase >= 1 ? `${i * 80 + 40}ms` : "0ms" }}>
                {row.amount}
              </span>
            </div>
          ))}
        </div>

        {/* ── Phase 3–4: Chart + balance ── */}
        <div className={cn(
          "flex items-center gap-4 rounded-xl border border-border/40 bg-muted/10 px-4 py-3 transition-all duration-500",
          phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        )}>
          <DonutChart animate={phase >= 3} />
          <div className="flex-1 space-y-1.5">
            {donutLabels.map((d, i) => (
              <div key={d.label} className={cn(
                "flex items-center gap-1.5 text-xs text-muted-foreground transition-all duration-300",
                phase >= 3 ? "opacity-100" : "opacity-0"
              )}
              style={{ transitionDelay: phase >= 3 ? `${300 + i * 80}ms` : "0ms" }}>
                <span className={`h-2 w-2 rounded-full ${d.color}`} />
                {d.label}
              </div>
            ))}
          </div>
          <div className={cn(
            "text-right transition-all duration-400",
            phase >= 4 ? "opacity-100" : "opacity-0"
          )}>
            <p className="text-[10px] text-muted-foreground">{isPt ? "Saldo" : "Balance"}</p>
            <p className="font-display text-lg font-bold text-emerald-400 tabular-nums">
              R$&nbsp;{balance.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
