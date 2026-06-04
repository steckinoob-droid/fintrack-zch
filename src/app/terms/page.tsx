import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/50 px-4 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <Logo size="sm" />
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="prose prose-invert max-w-none space-y-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">Termos de Uso</h1>
            <p className="text-sm text-muted-foreground">Última atualização: junho de 2026</p>
          </div>

          {[
            {
              title: "1. Aceitação dos Termos",
              text: "Ao acessar ou usar o FinTrack, você concorda com estes Termos de Uso. Se não concordar com qualquer parte, não utilize o serviço.",
            },
            {
              title: "2. Descrição do Serviço",
              text: "O FinTrack é uma plataforma de controle financeiro pessoal que permite registrar receitas, despesas, orçamentos e metas de poupança. O serviço é fornecido 'como está', sem garantias de disponibilidade ininterrupta.",
            },
            {
              title: "3. Conta do Usuário",
              text: "Você é responsável por manter a confidencialidade de suas credenciais de acesso. Notifique-nos imediatamente em caso de uso não autorizado da sua conta. Cada pessoa pode ter apenas uma conta.",
            },
            {
              title: "4. Uso Aceitável",
              text: "Você concorda em não usar o FinTrack para atividades ilegais, fraudulentas ou que violem direitos de terceiros. Não é permitido tentar acessar dados de outros usuários ou comprometer a segurança da plataforma.",
            },
            {
              title: "5. Dados Financeiros",
              text: "Todos os dados financeiros inseridos são de sua propriedade. O FinTrack não acessa, analisa ou compartilha seus dados financeiros com terceiros para fins comerciais. Os dados são usados exclusivamente para fornecer o serviço.",
            },
            {
              title: "6. Limitação de Responsabilidade",
              text: "O FinTrack não se responsabiliza por decisões financeiras tomadas com base nas informações exibidas na plataforma. As informações são fornecidas para controle pessoal e não constituem aconselhamento financeiro.",
            },
            {
              title: "7. Modificações",
              text: "Reservamos o direito de modificar estes termos a qualquer momento. Notificaremos usuários sobre mudanças significativas. O uso continuado após as modificações constitui aceitação dos novos termos.",
            },
            {
              title: "8. Encerramento",
              text: "Você pode encerrar sua conta a qualquer momento nas configurações. Reservamos o direito de suspender ou encerrar contas que violem estes termos.",
            },
          ].map((section) => (
            <div key={section.title} className="glass-card p-6 space-y-2">
              <h2 className="font-display font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
