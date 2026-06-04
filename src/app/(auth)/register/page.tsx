import type { Metadata } from "next";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return <AuthPageClient mode="register" />;
}
