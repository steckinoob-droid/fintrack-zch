"use client";

import { Check, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Override the modal title (falls back to the generic paywall title) */
  title?: string;
  /** Override the modal description (falls back to the generic paywall description) */
  description?: string;
  /** Override the CTA button label (falls back to the generic CTA) */
  cta?: string;
  /**
   * 0–5: index into paywall.benefits of the contextually relevant feature.
   * That item gets a hero row; the rest appear in a compact 2-col grid.
   * When omitted all benefits render as a standard list.
   */
  highlightBenefit?: number;
}

export function UpgradeModal({ open, onOpenChange, title, description, cta, highlightBenefit }: Props) {
  const { lang } = useLang();
  const tx = appT[lang].paywall;
  const router = useRouter();

  const modalTitle = title ?? tx.title;
  const modalDesc  = description ?? tx.description;
  const modalCta   = cta ?? tx.cta;

  const benefits   = tx.benefits as readonly string[];
  const highlighted = typeof highlightBenefit === "number" ? benefits[highlightBenefit] : undefined;
  const rest        = typeof highlightBenefit === "number"
    ? (benefits as readonly string[]).filter((_, i) => i !== highlightBenefit)
    : (benefits as readonly string[]);

  function handleCta() {
    onOpenChange(false);
    router.push("/pricing");
  }

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes um-glow {
            0%, 100% { box-shadow: 0 4px 14px -2px rgba(16,185,129,0.28); }
            50%       { box-shadow: 0 0 0 3px rgba(16,185,129,0.10), 0 4px 20px -2px rgba(16,185,129,0.42); }
          }
          .um-cta-glow { animation: um-glow 2.8s ease-in-out 0.5s infinite; }
        }
      `}</style>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm border-primary/35 overflow-y-auto max-h-[90dvh]">
          {/* Top gradient accent line */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-primary/60 to-transparent"
            aria-hidden
          />

          {/* ── Header ── */}
          <DialogHeader className="pb-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
                <Star size={15} className="text-primary fill-current" />
              </span>
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.15em]">
                {tx.badge}
              </span>
            </div>
            <DialogTitle className="text-xl leading-snug">
              {modalTitle}
            </DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              {modalDesc}
            </p>
          </DialogHeader>

          {/* ── Benefits ── */}
          <div className="px-6 pb-2 space-y-2">
            {/* Contextual highlight — hero row */}
            {highlighted && (
              <div className="flex items-center gap-2.5 rounded-lg bg-primary/8 border border-primary/18 px-3 py-2.5">
                <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
                  <Check size={10} className="text-primary" strokeWidth={2.5} />
                </span>
                <span className="text-sm font-semibold text-foreground/95 leading-snug">{highlighted}</span>
              </div>
            )}

            {/* Remaining benefits — 2-col compact grid when highlighted, standard list otherwise */}
            <div className={cn(highlighted ? "grid grid-cols-2 gap-x-3 gap-y-1.5 pt-0.5" : "space-y-2")}>
              {rest.map((benefit) => (
                <div key={benefit} className={cn(
                  "flex items-start gap-1.5",
                  highlighted ? "text-[11.5px] text-foreground/75" : "text-sm text-foreground/85"
                )}>
                  <span className={cn(
                    "flex shrink-0 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary/16 mt-[2px]",
                    highlighted ? "h-[15px] w-[15px]" : "h-[18px] w-[18px]"
                  )}>
                    <Check size={highlighted ? 7.5 : 9} className="text-primary" />
                  </span>
                  <span className="leading-snug">{benefit}</span>
                </div>
              ))}
            </div>

            {/* Price hint — more legible, premium feel */}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 pt-2">
              <span className="text-[12px] font-semibold text-foreground/60">
                {lang === "en" ? "R$9.99/mo" : "R$9,99/mês"}
              </span>
              <span className="h-3 w-px bg-border/50 shrink-0" aria-hidden />
              <span className="text-[11px] text-muted-foreground/65">
                {lang === "en" ? "Cancel anytime" : "Cancele quando quiser"}
              </span>
              <span className="h-3 w-px bg-border/50 shrink-0" aria-hidden />
              <span className="text-[11px] text-muted-foreground/55">
                {lang === "en" ? "Your data stays yours" : "Seus dados são seus"}
              </span>
            </div>
          </div>

          {/* ── CTAs ── */}
          <div className="px-6 pb-6 pt-1 flex flex-col gap-2">
            <Button
              onClick={handleCta}
              className="um-cta-glow w-full h-11 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 transition-all active:scale-[0.98]"
            >
              <Star size={13} className="fill-current" />
              {modalCta}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full min-h-[44px] text-sm text-muted-foreground hover:text-foreground"
            >
              {tx.notNow}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
