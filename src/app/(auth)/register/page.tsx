import type { Metadata } from "next";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export const metadata: Metadata = {
  title: "Criar conta — FinTrack",
  description: "Crie sua conta grátis e comece a controlar seus gastos hoje. No Pro, importe extratos CSV, OFX ou PDF do seu banco.",
  openGraph: { locale: "pt_BR" },
};

export default function RegisterPage() {
  return <AuthPageClient mode="register" />;
}
