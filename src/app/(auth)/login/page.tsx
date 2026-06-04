import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-slide-up">
        <div className="text-center space-y-2">
          <Logo className="mx-auto" size="lg" />
          <p className="text-muted-foreground text-sm">
            Bem-vindo de volta! Faça login para continuar.
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Não tem uma conta?{" "}
          <a href="/register" className="text-primary hover:underline font-medium">
            Criar conta
          </a>
        </p>
      </div>
    </div>
  );
}
