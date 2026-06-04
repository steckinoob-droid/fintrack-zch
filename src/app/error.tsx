"use client";

import { useEffect } from "react";
import { Logo } from "@/components/shared/logo";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 text-center">
      <div className="space-y-6 animate-slide-up max-w-md">
        <Logo className="mx-auto" size="lg" />

        <div className="space-y-2">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle size={36} className="text-red-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Algo deu errado</h1>
          <p className="text-muted-foreground text-sm">
            Ocorreu um erro inesperado. Tente novamente ou volte para a página inicial.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Código: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
