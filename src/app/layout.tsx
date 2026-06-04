import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/shared/toaster";
import { LangProvider } from "@/lib/i18n/context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { template: "%s | FinTrack", default: "FinTrack — Controle Financeiro Inteligente" },
  description: "Gerencie suas finanças com clareza. Receitas, despesas, orçamentos e metas de poupança em um só lugar. Grátis para começar.",
  keywords: ["finanças pessoais", "controle financeiro", "orçamento", "poupança", "investimentos", "fintech"],
  authors: [{ name: "FinTrack" }],
  openGraph: {
    title: "FinTrack — Controle Financeiro Inteligente",
    description: "Gerencie suas finanças com clareza. Receitas, despesas, orçamentos e metas em um só lugar.",
    type: "website",
    locale: "pt_BR",
    siteName: "FinTrack",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinTrack — Controle Financeiro Inteligente",
    description: "Gerencie suas finanças com clareza.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0E1A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${plusJakarta.variable}`}>
        <LangProvider>
          {children}
          <Toaster />
        </LangProvider>
      </body>
    </html>
  );
}
