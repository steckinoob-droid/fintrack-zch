"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Star, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

interface Props {
  currentPlan: string;
  isLoggedIn:  boolean;
}

export function PricingClient({ currentPlan, isLoggedIn }: Props) {
  const { lang }    = useLang();
  const tx          = appT[lang].pricing;
  const [upgrading, setUpgrading] = useState(false);

  async function handleUpgrade() {
    if (!isLoggedIn) {
      window.location.href = `/login?next=/pricing`;
      return;
    }
    setUpgrading(true);
    try {
      const res  = await fetch("/api/billing/subscribe", { method: "POST" });
      const json = await res.json() as { init_point?: string; error?: string };

      if (res.status === 409) {
        toast({ title: appT[lang].billing.alreadyPro });
        return;
      }
      if (!res.ok || !json.init_point) {
        toast.error(appT[lang].billing.upgradeError);
        return;
      }
      window.location.href = json.init_point;
    } catch {
      toast.error(appT[lang].billing.upgradeError);
    } finally {
      setUpgrading(false);
    }
  }

  const isPro = currentPlan === "pro";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border/40 px-6 py-4 flex items-center gap-3">
        <Link
          href={isLoggedIn ? "/dashboard" : "/"}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          {tx.backToApp}
        </Link>
        <span className="text-border/60">|</span>
        <span className="font-display font-bold text-primary text-sm">FinTrack</span>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 gap-8">
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold text-foreground">{tx.title}</h1>
          <p className="text-muted-foreground">{tx.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">

          {/* Free card */}
          <div className="glass-card p-6 space-y-5 flex flex-col">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{tx.freeName}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-foreground">{tx.freePrice}</span>
                <span className="text-sm text-muted-foreground">{tx.perMonth}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{tx.freeDesc}</p>
            </div>

            <ul className="space-y-2 flex-1">
              {tx.features.freeList.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check size={14} className="text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              disabled
              className="w-full opacity-60"
            >
              {!isPro ? tx.currentPlan : tx.freeName}
            </Button>
          </div>

          {/* Pro card */}
          <div className={cn(
            "glass-card p-6 space-y-5 flex flex-col relative overflow-hidden",
            "border-primary/40 shadow-[0_0_32px_-4px_rgba(16,185,129,0.18)]",
          )}>
            {/* Highlight strip */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

            <div>
              <div className="flex items-center gap-1.5">
                <Star size={13} className="text-primary fill-primary" />
                <p className="text-xs font-medium text-primary uppercase tracking-wide">{tx.proName}</p>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-foreground">{tx.proPrice}</span>
                <span className="text-sm text-muted-foreground">{tx.perMonth}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{tx.proDesc}</p>
            </div>

            <ul className="space-y-2 flex-1">
              {tx.features.proList.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <Check size={14} className="text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {isPro ? (
              <Button disabled className="w-full bg-primary/20 text-primary border border-primary/30">
                <Star size={14} className="fill-current" />
                {tx.currentPlan}
              </Button>
            ) : (
              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {upgrading
                  ? <><Loader2 size={14} className="animate-spin" />{tx.upgrading}</>
                  : <><Star size={14} />{isLoggedIn ? tx.upgrade : tx.loginToUpgrade}</>}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
