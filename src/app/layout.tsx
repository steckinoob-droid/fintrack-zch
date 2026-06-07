import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/shared/toaster";
import { LangProvider } from "@/lib/i18n/context";
import { PwaRegister } from "@/components/shared/pwa-register";

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinTrack",
  },
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
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0A0E1A" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Anti-flash theme script — runs before paint, reads localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fintrack_theme')||'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable}`}>
        <LangProvider>
          <PwaRegister />
          {children}
          <Toaster />
        </LangProvider>
      </body>
    </html>
  );
}
