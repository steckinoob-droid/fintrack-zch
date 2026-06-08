import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Nova senha" };

export default function ResetPasswordPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-slide-up">
        <div className="text-center">
          <Logo className="mx-auto" size="lg" />
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
