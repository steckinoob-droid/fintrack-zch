"use client";

import { useState, useEffect } from "react";
import { Tag, ArrowLeftRight, PieChart, ArrowRight, X, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils/cn";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "fintrack_onboarding_done";

const STEPS = [
  {
    icon: Tag,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    title: "Crie suas categorias",
    description: "Organize receitas e despesas com categorias personalizadas. Salário, Alimentação, Transporte… você decide.",
    action: "/categories",
    actionLabel: "Ir para Categorias",
  },
  {
    icon: ArrowLeftRight,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Registre suas transações",
    description: "Adicione suas receitas e despesas. Marque como recorrente e o FinTrack gera automaticamente todo mês.",
    action: "/transactions",
    actionLabel: "Ir para Transações",
  },
  {
    icon: PieChart,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Defina seus orçamentos",
    description: "Estabeleça limites mensais por categoria. Você será avisado quando chegar em 80% do limite.",
    action: "/budgets",
    actionLabel: "Ir para Orçamentos",
  },
];

export function OnboardingModal() {
  const [open, setOpen]   = useState(false);
  const [step, setStep]   = useState(0);
  const router            = useRouter();

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setTimeout(() => setOpen(true), 800);
  }, []);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }

  function goToStep(href: string) {
    finish();
    router.push(href);
  }

  const current = STEPS[step];
  const Icon    = current.icon;
  const isLast  = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="sr-only">Onboarding — Primeiros passos</DialogTitle>
          <Logo size="sm" />
          <button
            onClick={finish}
            className="absolute right-4 top-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">
              Começando — passo {step + 1} de {STEPS.length}
            </p>
            <h2 className="font-display text-xl font-bold text-foreground">
              Bem-vindo ao FinTrack! 🎉
            </h2>
            <p className="text-sm text-muted-foreground">
              Siga esses 3 passos para configurar tudo rapidinho.
            </p>
          </div>

          {/* Steps list */}
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const SIcon = s.icon;
              const done  = i < step;
              const active = i === step;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3 transition-all",
                    active ? "glass-card border-primary/20" : "opacity-50"
                  )}
                >
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", done ? "bg-emerald-500/15" : s.bg)}>
                    {done
                      ? <CheckCircle2 size={18} className="text-emerald-400" />
                      : <SIcon size={18} className={s.color} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                      {s.title}
                    </p>
                    {active && (
                      <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 pb-6">
          <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground">
            Pular tudo
          </Button>
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="outline" size="sm" onClick={() => goToStep(current.action)}>
                {current.actionLabel}
              </Button>
            )}
            <Button size="sm" onClick={() => isLast ? goToStep(current.action) : setStep((s) => s + 1)}>
              {isLast ? current.actionLabel : <>Próximo <ArrowRight size={14} /></>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
