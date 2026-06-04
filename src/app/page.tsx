import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp, BarChart3, Target, PieChart, Shield,
  ArrowRight, CheckCircle, Smartphone, Zap, RefreshCw,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = {
  title: "FinTrack — Controle Financeiro Inteligente",
  description: "Gerencie suas finanças com clareza. Receitas, despesas, orçamentos e metas em um só lugar. Grátis para começar.",
};

const FEATURES = [
  {
    icon: BarChart3,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Dashboard completo",
    description: "Visão geral do seu patrimônio, receitas, despesas e taxa de poupança em tempo real.",
  },
  {
    icon: PieChart,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    title: "Orçamentos inteligentes",
    description: "Defina limites por categoria e receba alertas antes de estourar o orçamento.",
  },
  {
    icon: Target,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Metas de poupança",
    description: "Crie objetivos financeiros e acompanhe o progresso com previsão de conclusão.",
  },
  {
    icon: RefreshCw,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Transações recorrentes",
    description: "Marque contas fixas como recorrentes e o FinTrack gera automaticamente todo mês.",
  },
  {
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    title: "Insights automáticos",
    description: "Análise inteligente dos seus hábitos financeiros com dicas personalizadas.",
  },
  {
    icon: Shield,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    title: "100% seguro",
    description: "Seus dados protegidos com Row Level Security e criptografia de ponta a ponta.",
  },
];

const BENEFITS = [
  "Sem planilhas complicadas",
  "Relatórios visuais em segundos",
  "Categorias personalizáveis",
  "Funciona no celular e no computador",
  "Gratuito para começar",
  "Dados sempre seus",
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 lg:px-6 h-16 flex items-center justify-between">
          <Logo size="md" />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#benefits" className="hover:text-foreground transition-colors">Benefícios</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-[0.98]"
            >
              Começar grátis <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pt-20 pb-24 lg:pt-32 lg:pb-36">
          {/* Background glows */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute right-0 top-1/2 h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              <Zap size={12} className="fill-current" />
              Grátis para sempre no plano básico
            </div>

            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Suas finanças,{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                finalmente organizadas
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              O FinTrack reúne receitas, despesas, orçamentos e metas em um painel intuitivo.
              Tome decisões financeiras com clareza, não com chutes.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 hover:brightness-110 transition-all active:scale-[0.98]"
              >
                Criar conta grátis <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-8 py-3.5 text-base font-medium text-foreground hover:bg-card transition-colors"
              >
                Já tenho conta
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Sem cartão de crédito · Configuração em 2 minutos
            </p>
          </div>

          {/* Mock dashboard preview */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur p-4 shadow-2xl">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Saldo Total", value: "R$ 45.200", color: "text-foreground" },
                  { label: "Receitas", value: "R$ 10.500", color: "text-emerald-400" },
                  { label: "Despesas", value: "R$ 6.830", color: "text-red-400" },
                  { label: "Poupança", value: "35%", color: "text-indigo-400" },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl border border-border/40 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className={`font-display font-bold text-lg mt-1 ${card.color}`}>{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/30 h-32 flex items-center justify-center">
                <div className="flex items-end gap-2 h-20">
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-6 rounded-t-sm bg-primary/60" style={{ height: `${h}%` }} />
                      <div className="w-6 rounded-t-sm bg-red-400/40" style={{ height: `${h * 0.6}%` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <h2 className="font-display text-3xl font-bold text-foreground">
                Tudo que você precisa para controlar o dinheiro
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                Ferramentas simples e poderosas para qualquer perfil financeiro.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div key={f.title} className="glass-card p-6 space-y-3 hover:border-white/10 transition-colors">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${f.bg}`}>
                    <f.icon size={20} className={f.color} />
                  </div>
                  <h3 className="font-display font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="px-4 py-20 lg:py-28 bg-gradient-to-b from-transparent to-card/20">
          <div className="mx-auto max-w-4xl">
            <div className="glass-card p-8 lg:p-12">
              <div className="grid lg:grid-cols-2 gap-10 items-center">
                <div>
                  <h2 className="font-display text-3xl font-bold text-foreground mb-4">
                    Por que o FinTrack?
                  </h2>
                  <p className="text-muted-foreground mb-8 leading-relaxed">
                    Chega de planilhas confusas e apps complicados. O FinTrack foi feito para
                    quem quer ter controle financeiro real, sem precisar ser especialista.
                  </p>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
                  >
                    Começar agora <ArrowRight size={14} />
                  </Link>
                </div>
                <ul className="space-y-3">
                  {BENEFITS.map((b) => (
                    <li key={b} className="flex items-center gap-3">
                      <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                      <span className="text-sm text-foreground">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="px-4 py-20 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">
              Pronto para assumir o controle?
            </h2>
            <p className="text-muted-foreground mb-8">
              Crie sua conta em menos de 1 minuto e comece a organizar suas finanças hoje.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 hover:brightness-110 transition-all active:scale-[0.98]"
            >
              Criar conta grátis <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 px-4 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Termos de uso</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Entrar</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} FinTrack</p>
        </div>
      </footer>
    </div>
  );
}
