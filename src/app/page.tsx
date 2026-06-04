import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp, BarChart3, Target, PieChart, Shield,
  ArrowRight, CheckCircle, RefreshCw, Zap, AlertTriangle,
  ChevronDown, Lock, Smartphone, Clock, XCircle,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = {
  title: "FinTrack — Pare de adivinhar para onde vai o seu dinheiro",
  description: "O FinTrack organiza suas receitas, despesas e metas em um painel visual. Você vê tudo em segundos — sem planilha, sem confusão, sem surpresas no fim do mês.",
};

/* ─── Dados ─────────────────────────────────────────────── */

const PAINS = [
  { icon: XCircle, text: "Você não sabe exatamente quanto gastou esse mês" },
  { icon: XCircle, text: "Sua planilha ficou tão complexa que você parou de usar" },
  { icon: XCircle, text: "Chega no dia 20 e o dinheiro já sumiu — sem saber para onde" },
  { icon: XCircle, text: "Você sabe que deveria poupar mais, mas não vê como" },
];

const STEPS = [
  {
    n: "01",
    title: "Crie sua conta em 1 minuto",
    description: "Sem cartão de crédito. Só email e senha. Em segundos você já está dentro do painel.",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
  },
  {
    n: "02",
    title: "Registre receitas e despesas",
    description: "Categorias criadas automaticamente. Marque contas fixas como recorrentes e nunca mais esqueça de lançar.",
    color: "text-indigo-400",
    border: "border-indigo-500/20",
    bg: "bg-indigo-500/5",
  },
  {
    n: "03",
    title: "Veja para onde vai cada real",
    description: "Dashboard com gráficos, alertas de orçamento e insights automáticos. Tudo em tempo real.",
    color: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
  },
];

const FEATURES = [
  {
    icon: BarChart3,
    problem: "Não sabe quanto gastou no mês",
    solution: "Dashboard com saldo, receitas, despesas e taxa de poupança em tempo real",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: PieChart,
    problem: "Estoura o orçamento sem perceber",
    solution: "Orçamentos por categoria com alertas quando você chega em 80% do limite",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Target,
    problem: "Poupança que nunca sai do papel",
    solution: "Metas com progresso visual e previsão de quando você vai atingir o objetivo",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: RefreshCw,
    problem: "Esquecer de lançar contas fixas",
    solution: "Transações recorrentes que se geram automaticamente todo mês",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Zap,
    problem: "Não sabe se está indo bem ou mal",
    solution: "Insights automáticos: comparativos mensais, previsão de gastos e dicas personalizadas",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    icon: Shield,
    problem: "Medo de colocar dados financeiros online",
    solution: "Cada usuário só acessa os próprios dados. Proteção a nível bancário com RLS e criptografia",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
];

const FAQS = [
  {
    q: "É realmente gratuito?",
    a: "Sim. O plano gratuito é para sempre, sem necessidade de cartão de crédito. Você pode usar as funcionalidades principais sem pagar nada.",
  },
  {
    q: "Meus dados financeiros estão seguros?",
    a: "Sim. Utilizamos Row Level Security — cada usuário só consegue ver os próprios dados. Nenhum dado é vendido ou compartilhado com terceiros.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. O FinTrack é totalmente responsivo e funciona bem em qualquer tela — celular, tablet ou computador.",
  },
  {
    q: "Preciso conectar minha conta bancária?",
    a: "Não. Você lança as transações manualmente, o que te dá mais consciência financeira. Não há integração com bancos.",
  },
  {
    q: "E se eu quiser parar de usar?",
    a: "Você pode excluir sua conta a qualquer momento nas configurações. Todos os seus dados são apagados permanentemente.",
  },
];

const TRUST = [
  { icon: Lock, text: "Seus dados nunca são vendidos" },
  { icon: Smartphone, text: "Funciona em qualquer dispositivo" },
  { icon: Clock, text: "Configuração em menos de 2 minutos" },
  { icon: CheckCircle, text: "Sem cartão de crédito" },
];

/* ─── Componentes internos ───────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group glass-card overflow-hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 text-sm font-medium text-foreground list-none">
        {q}
        <ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4">
        {a}
      </p>
    </details>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <Logo size="md" />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
              Entrar
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-[0.98]">
              Começar grátis <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-4 pt-20 pb-24 lg:pt-32 lg:pb-36">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/6 blur-3xl" />
            <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary">
              <Zap size={11} className="fill-current" /> Grátis para começar — sem cartão
            </div>

            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-tight">
              Pare de adivinhar para onde{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                vai o seu dinheiro
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              O FinTrack organiza suas receitas, despesas e metas em um painel visual.
              Você vê tudo em segundos —{" "}
              <span className="text-foreground font-medium">sem planilha, sem confusão, sem surpresas no fim do mês.</span>
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/25 hover:brightness-110 transition-all active:scale-[0.98]">
                Criar minha conta grátis <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-8 py-4 text-base font-medium text-foreground hover:bg-card transition-colors">
                Já tenho conta
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {["Sem cartão de crédito", "Configuração em 2 minutos", "Cancele quando quiser"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-400" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Mock dashboard */}
          <div className="relative mx-auto mt-16 max-w-5xl px-4">
            <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm shadow-2xl overflow-hidden">
              {/* Topbar do mock */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/20">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/50" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/50" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/50" />
                </div>
                <div className="flex-1 mx-4 h-5 rounded-md bg-muted/50 max-w-xs" />
              </div>
              {/* Conteúdo do mock */}
              <div className="p-4 space-y-4">
                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Saldo Total", value: "R$ 45.200", sub: "+R$ 3.670 este mês", color: "text-foreground", dot: "bg-primary" },
                    { label: "Receitas", value: "R$ 10.500", sub: "↑ 12% vs mês passado", color: "text-emerald-400", dot: "bg-emerald-500" },
                    { label: "Despesas", value: "R$ 6.830", sub: "↓ 5% vs mês passado", color: "text-red-400", dot: "bg-red-500" },
                    { label: "Poupança", value: "35%", sub: "Meta: 20% ✓", color: "text-indigo-400", dot: "bg-indigo-500" },
                  ].map((card) => (
                    <div key={card.label} className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${card.dot}`} />
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                      </div>
                      <p className={`font-display font-bold text-lg ${card.color}`}>{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.sub}</p>
                    </div>
                  ))}
                </div>
                {/* Gráfico mock */}
                <div className="rounded-xl border border-border/40 bg-muted/10 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-foreground">Receitas vs Despesas — 6 meses</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Receitas</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />Despesas</span>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2 h-24 px-2">
                    {[
                      { i: 60, e: 42, m: "Jan" }, { i: 75, e: 55, m: "Fev" },
                      { i: 65, e: 70, m: "Mar" }, { i: 85, e: 58, m: "Abr" },
                      { i: 90, e: 65, m: "Mai" }, { i: 100, e: 70, m: "Jun" },
                    ].map((d) => (
                      <div key={d.m} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end justify-center gap-0.5 h-20">
                          <div className="w-2/5 rounded-t-sm bg-emerald-400/60" style={{ height: `${d.i}%` }} />
                          <div className="w-2/5 rounded-t-sm bg-red-400/50" style={{ height: `${d.e}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{d.m}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Transações recentes mock */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Transações recentes</p>
                    {[
                      { t: "Salário", v: "+R$ 8.500", c: "text-emerald-400" },
                      { t: "Aluguel", v: "-R$ 2.200", c: "text-red-400" },
                      { t: "Supermercado", v: "-R$ 487", c: "text-red-400" },
                    ].map((r) => (
                      <div key={r.t} className="flex items-center justify-between">
                        <div className="h-2 w-24 rounded bg-muted/60" />
                        <span className={`text-xs font-semibold ${r.c}`}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">Orçamentos do mês</p>
                    {[
                      { cat: "Alimentação", pct: 68, color: "bg-primary" },
                      { cat: "Transporte", pct: 82, color: "bg-amber-500" },
                      { cat: "Lazer", pct: 45, color: "bg-indigo-500" },
                    ].map((b) => (
                      <div key={b.cat} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{b.cat}</span><span>{b.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/50">
                          <div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" style={{ top: "60%" }} />
          </div>
        </section>

        {/* ── Para quem é ── */}
        <section className="px-4 py-16 border-y border-border/30 bg-muted/5">
          <div className="mx-auto max-w-3xl text-center space-y-8">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Você se identifica?</p>
              <h2 className="font-display text-2xl font-bold text-foreground">
                O FinTrack foi feito para você se…
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {PAINS.map((p) => (
                <div key={p.text} className="flex items-start gap-3 rounded-xl border border-red-500/15 bg-red-500/5 p-4">
                  <p.icon size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{p.text}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Se marcou pelo menos um, o FinTrack resolve.{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                Crie sua conta grátis →
              </Link>
            </p>
          </div>
        </section>

        {/* ── Como funciona ── */}
        <section id="como-funciona" className="px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Simples assim</p>
              <h2 className="font-display text-3xl font-bold text-foreground">Do zero ao controle financeiro em 3 passos</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {STEPS.map((s) => (
                <div key={s.n} className={`rounded-2xl border ${s.border} ${s.bg} p-6 space-y-3`}>
                  <span className={`font-display text-4xl font-extrabold ${s.color} opacity-40`}>{s.n}</span>
                  <h3 className="font-display font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 transition-all">
                Começar agora — é grátis <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="px-4 py-20 lg:py-28 bg-gradient-to-b from-transparent to-card/10">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Funcionalidades</p>
              <h2 className="font-display text-3xl font-bold text-foreground">
                Cada feature resolve um problema real
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                Nada de botões que ninguém usa. Cada funcionalidade existe porque um problema financeiro real precisa ser resolvido.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div key={f.problem} className="glass-card p-6 space-y-4 hover:border-white/10 transition-colors group">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${f.bg} transition-transform group-hover:scale-110`}>
                    <f.icon size={20} className={f.color} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle size={10} className="text-amber-400" />
                      Problema: {f.problem}
                    </p>
                    <p className="text-sm font-medium text-foreground leading-snug">✓ {f.solution}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust bar ── */}
        <section className="px-4 py-12 border-y border-border/30">
          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {TRUST.map((t) => (
                <div key={t.text} className="flex flex-col items-center gap-2 text-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <t.icon size={18} className="text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="px-4 py-20 lg:py-28">
          <div className="mx-auto max-w-2xl">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Dúvidas</p>
              <h2 className="font-display text-3xl font-bold text-foreground">Perguntas frequentes</h2>
            </div>
            <div className="space-y-3">
              {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-2xl">
            <div className="glass-card p-10 lg:p-14 text-center space-y-6 border-primary/10">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
                <TrendingUp size={28} className="text-primary" />
              </div>
              <h2 className="font-display text-3xl font-bold text-foreground">
                Você já adiou tempo demais
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Cada mês sem controle é dinheiro que you never going to recover. Leva menos de 2 minutos para criar sua conta.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/25 hover:brightness-110 transition-all active:scale-[0.98] w-full sm:w-auto justify-center">
                  Criar minha conta grátis <ArrowRight size={16} />
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                {["Sem cartão de crédito", "Grátis para sempre", "Dados sempre seus"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle size={11} className="text-emerald-400" /> {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 px-4 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Termos de uso</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Entrar</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} FinTrack · Feito no Brasil 🇧🇷</p>
        </div>
      </footer>
    </div>
  );
}
