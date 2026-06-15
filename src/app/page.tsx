import type { Metadata } from "next";
import { LandingClient } from "@/components/landing/landing-client";

export const metadata: Metadata = {
  title: "FinTrack — Suba o Extrato e Veja Para Onde Foi Seu Dinheiro",
  description:
    "Importe o extrato do banco (CSV, OFX ou PDF) e veja tudo categorizado automaticamente em segundos. Controle financeiro sem planilha, sem complicação.",
  openGraph: {
    title: "FinTrack — Suba o Extrato e Veja Para Onde Foi Seu Dinheiro",
    description: "Importe o extrato do banco e veja tudo categorizado automaticamente. Dashboard com gráficos, orçamentos e metas — grátis para começar.",
    type: "website",
    locale: "pt_BR",
    siteName: "FinTrack",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinTrack — Suba o Extrato e Veja Para Onde Foi Seu Dinheiro",
    description: "Importe o extrato do banco e veja tudo categorizado automaticamente. Grátis para começar.",
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LandingClient />;
}
