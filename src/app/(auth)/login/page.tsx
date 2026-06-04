import type { Metadata } from "next";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <AuthPageClient mode="login" />;
}
