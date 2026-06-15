"use client";

import { useState, useEffect } from "react";
import { Tag, ArrowLeftRight, PieChart, PiggyBank, ArrowRight, X, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils/cn";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n/context";

const STORAGE_KEY = "fintrack_onboarding_done";

function getSteps(lang: "en" | "pt") {
  return [
    {
      icon: Tag,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      title: lang === "en" ? "Create categories" : "Crie suas categorias",
      description: lang === "en"
        ? "Organize income and expenses with custom categories. Salary, Food, Transport — you decide."
        : "Organize receitas e despesas com categorias personalizadas. Salário, Alimentação, Transporte… você decide.",
      action: "/categories",
      actionLabel: lang === "en" ? "Go to Categories" : "Ir para Categorias",
    },
    {
      icon: ArrowLeftRight,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      title: lang === "en" ? "Add your transactions" : "Adicione suas transações",
      description: lang === "en"
        ? "Add transactions manually, or import a CSV/OFX/PDF from your bank (Pro). Mark fixed bills as recurring and FinTrack generates them every month."
        : "Lance na mão ou importe um CSV/OFX/PDF do seu banco (Pro). Marque contas fixas como recorrentes e o FinTrack gera todo mês.",
      action: "/transactions",
      actionLabel: lang === "en" ? "Go to Transactions" : "Ir para Transações",
    },
    {
      icon: PieChart,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      title: lang === "en" ? "Set your budgets" : "Defina seus orçamentos",
      description: lang === "en"
        ? "Set monthly limits per category. You'll be notified when you reach 80% of the limit."
        : "Estabeleça limites mensais por categoria. Você será avisado quando chegar em 80% do limite.",
      action: "/budgets",
      actionLabel: lang === "en" ? "Go to Budgets" : "Ir para Orçamentos",
    },
    {
      icon: PiggyBank,
      color: "text-primary",
      bg: "bg-primary/10",
      title: lang === "en" ? "Create savings goals" : "Crie metas de poupança",
      description: lang === "en"
        ? "Set a goal (trip, car, emergency fund) and make deposits to reach it. Track your progress over time."
        : "Defina uma meta (viagem, moto, reserva de emergência) e faça aportes para chegar lá.",
      action: "/goals",
      actionLabel: lang === "en" ? "Go to Goals" : "Ir para Metas",
    },
  ];
}

export function OnboardingModal() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [step, setStep]  = useState(0);
  const router           = useRouter();

  const STEPS = getSteps(lang);

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
  const isLast  = step === STEPS.length - 1;
  const pt      = lang === "pt";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finish(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="sr-only">
            {pt ? "Onboarding — Primeiros passos" : "Onboarding — Getting started"}
          </DialogTitle>
          <Logo size="sm" />
          <button
            onClick={finish}
            className="absolute right-4 top-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={pt ? "Fechar" : "Close"}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">
              {pt
                ? `Começando — passo ${step + 1} de ${STEPS.length}`
                : `Getting started — step ${step + 1} of ${STEPS.length}`}
            </p>
            <h2 className="font-display text-xl font-bold text-foreground">
              {pt ? "Bem-vindo ao FinTrack! 🎉" : "Welcome to FinTrack! 🎉"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {pt
                ? `Siga esses ${STEPS.length} passos para configurar tudo rapidinho.`
                : `Follow these ${STEPS.length} steps to get everything set up quickly.`}
            </p>
          </div>

          {/* Steps list */}
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const SIcon  = s.icon;
              const done   = i < step;
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
                      : <SIcon size={18} className={s.color} />}
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
            {pt ? "Pular tudo" : "Skip all"}
          </Button>
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="outline" size="sm" onClick={() => goToStep(current.action)}>
                {current.actionLabel}
              </Button>
            )}
            <Button size="sm" onClick={() => isLast ? goToStep(current.action) : setStep((s) => s + 1)}>
              {isLast ? current.actionLabel : <>{pt ? "Próximo" : "Next"} <ArrowRight size={14} /></>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
