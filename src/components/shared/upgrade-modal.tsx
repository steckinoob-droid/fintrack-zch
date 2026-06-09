"use client";

import { Check, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Override the modal title (falls back to the generic paywall title) */
  title?: string;
  /** Override the modal description (falls back to the generic paywall description) */
  description?: string;
  /** Override the CTA button label (falls back to the generic "View plans") */
  cta?: string;
}

export function UpgradeModal({ open, onOpenChange, title, description, cta }: Props) {
  const { lang } = useLang();
  const tx = appT[lang].paywall;
  const router = useRouter();

  const modalTitle = title ?? tx.title;
  const modalDesc  = description ?? tx.description;
  const modalCta   = cta ?? tx.cta;

  function handleCta() {
    onOpenChange(false);
    router.push("/pricing");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-primary/35">
        {/* Top gradient accent line */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          aria-hidden
        />

        {/* ── Header ── */}
        <DialogHeader className="pb-2">
          {/* Pro eyebrow badge */}
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

        {/* ── Benefits list ── */}
        <div className="px-6 pb-2 space-y-2">
          {(tx.benefits as readonly string[]).map((benefit) => (
            <div key={benefit} className="flex items-center gap-2.5 text-sm text-foreground/85">
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/20">
                <Check size={9} className="text-primary" />
              </span>
              {benefit}
            </div>
          ))}

          {/* Price hint */}
          <p className="pt-1 text-[11px] text-center text-muted-foreground/55 leading-relaxed">
            {lang === "en"
              ? "R$9.99/mo · Cancel anytime · Your data stays yours"
              : "R$9,99/mês · Cancele quando quiser · Seus dados são seus"}
          </p>
        </div>

        {/* ── CTAs ── */}
        <div className="px-6 pb-6 pt-1 flex flex-col gap-2">
          <Button
            onClick={handleCta}
            className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 transition-all"
          >
            <Star size={13} className="fill-current" />
            {modalCta}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {tx.notNow}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
