import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
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
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
            <p className="text-sm text-muted-foreground">Última atualização: junho de 2026</p>
          </div>

          {[
            {
              title: "1. Dados que coletamos",
              text: "Coletamos apenas os dados necessários para fornecer o serviço: email e nome para autenticação; e os dados financeiros que você insere voluntariamente (transações, orçamentos, metas).",
            },
            {
              title: "2. Como usamos seus dados",
              text: "Seus dados são usados exclusivamente para fornecer as funcionalidades do FinTrack. Não vendemos, alugamos ou compartilhamos seus dados pessoais ou financeiros com terceiros para fins comerciais.",
            },
            {
              title: "3. Armazenamento e segurança",
              text: "Seus dados são armazenados com segurança no Supabase, com criptografia em trânsito e em repouso. Utilizamos Row Level Security para garantir que você acesse somente seus próprios dados.",
            },
            {
              title: "4. Cookies e rastreamento",
              text: "Utilizamos cookies de sessão estritamente necessários para autenticação. Não utilizamos cookies de rastreamento ou publicidade.",
            },
            {
              title: "5. Seus direitos",
              text: "Você tem direito a acessar, corrigir ou excluir seus dados a qualquer momento. Para excluir sua conta e todos os dados associados, acesse Configurações > Zona de perigo.",
            },
            {
              title: "6. Retenção de dados",
              text: "Seus dados são mantidos enquanto sua conta estiver ativa. Após o encerramento da conta, os dados são excluídos permanentemente em até 30 dias.",
            },
            {
              title: "7. Contato",
              text: "Para questões sobre privacidade ou para exercer seus direitos, entre em contato conosco através das configurações da conta.",
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
