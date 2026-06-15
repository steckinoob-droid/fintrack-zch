import type { Metadata } from "next";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export const metadata: Metadata = {
  title: "Redefinir senha — FinTrack",
  openGraph: { locale: "pt_BR" },
};

export default function ForgotPasswordPage() {
  return <AuthPageClient mode="forgot" />;
}
