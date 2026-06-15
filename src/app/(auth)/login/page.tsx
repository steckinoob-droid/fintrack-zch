import type { Metadata } from "next";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export const metadata: Metadata = {
  title: "Entrar — FinTrack",
  description: "Entre na sua conta FinTrack e veja para onde vai cada real.",
  openGraph: { locale: "pt_BR" },
};

export default function LoginPage() {
  return <AuthPageClient mode="login" />;
}
