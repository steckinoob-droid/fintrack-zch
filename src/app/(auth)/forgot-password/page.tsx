import type { Metadata } from "next";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <AuthPageClient mode="forgot" />;
}
