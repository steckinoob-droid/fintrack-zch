"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft, SearchX } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

export function NotFoundContent() {
  const { lang } = useLang();
  const tx = appT[lang].notFoundPage;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 text-center">
      <div className="space-y-6 animate-slide-up max-w-md">
        <Logo className="mx-auto" size="lg" />

        <div className="space-y-2">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center">
            <SearchX size={36} className="text-muted-foreground" />
          </div>
          <h1 className="font-display text-6xl font-extrabold text-foreground">404</h1>
          <h2 className="font-display text-xl font-semibold text-foreground">{tx.heading}</h2>
          <p className="text-muted-foreground text-sm">
            {tx.description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
          >
            {tx.goToDashboard}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft size={14} /> {tx.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
