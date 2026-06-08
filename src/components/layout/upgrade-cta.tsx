"use client";

import Link from "next/link";
import { Star, Zap } from "lucide-react";
import { usePlan } from "@/lib/hooks/use-plan";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

interface Props {
  compact?: boolean;
}

export function UpgradeCta({ compact }: Props) {
  const plan = usePlan();
  const { lang } = useLang();
  const tx = appT[lang].billing;

  // Don't render until plan is known — avoids layout shift
  if (plan === null) return null;

  if (compact) {
    if (plan === "pro") {
      return (
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25 transition-colors"
        >
          <Star size={10} className="fill-current" />
          Pro
        </Link>
      );
    }
    return (
      <Link
        href="/pricing"
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-1",
          "text-[11px] font-semibold text-primary",
          "hover:bg-primary/20 hover:border-primary/55 transition-colors",
        )}
      >
        <Zap size={10} className="fill-current" />
        Pro
      </Link>
    );
  }

  // Sidebar variant
  if (plan === "pro") {
    return (
      <Link
        href="/settings"
        className="mx-3 mb-2 flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5 hover:bg-primary/15 transition-colors group"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Star size={13} className="text-primary fill-current" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-primary">Pro</p>
          <p className="text-[10px] text-muted-foreground">{tx.statusActive}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/pricing"
      className={cn(
        "mx-3 mb-2 flex items-center gap-2.5 rounded-xl border border-primary/25 px-3 py-3",
        "bg-gradient-to-r from-primary/8 to-transparent",
        "hover:border-primary/45 hover:from-primary/14 transition-all group",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 group-hover:bg-primary/25 transition-colors">
        <Star size={13} className="text-primary fill-current" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">
          {lang === "en" ? "Upgrade to Pro" : "Upgrade para Pro"}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{tx.price}</p>
      </div>
      <Zap size={12} className="text-primary/50 shrink-0 group-hover:text-primary transition-colors" />
    </Link>
  );
}
