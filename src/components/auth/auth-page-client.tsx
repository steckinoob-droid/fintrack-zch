"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { ForgotPasswordForm } from "./forgot-password-form";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

type Mode = "login" | "register" | "forgot";

export function AuthPageClient({ mode }: { mode: Mode }) {
  const { lang, setLang } = useLang();
  const tx = appT[lang].auth;

  const config = {
    login: {
      title:    tx.login.title,
      subtitle: tx.login.subtitle,
      footer: (
        <p className="text-center text-sm text-muted-foreground">
          {tx.login.noAccount}{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            {tx.login.createAccount}
          </Link>
        </p>
      ),
      form: <LoginForm />,
    },
    register: {
      title:    tx.register.title,
      subtitle: tx.register.subtitle,
      footer: (
        <p className="text-center text-sm text-muted-foreground">
          {tx.register.hasAccount}{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            {tx.register.signIn}
          </Link>
        </p>
      ),
      form: <RegisterForm />,
    },
    forgot: {
      title:    tx.forgotPassword.title,
      subtitle: tx.forgotPassword.subtitle,
      footer: (
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline font-medium">
            ← {tx.forgotPassword.backToLogin}
          </Link>
        </p>
      ),
      form: <ForgotPasswordForm />,
    },
  };

  const page = config[mode];

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4">
      {/* Lang toggle top-right */}
      <div className="fixed top-4 right-4">
        <button
          onClick={() => setLang(lang === "en" ? "pt" : "en")}
          className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/40 hover:text-primary shadow-sm"
        >
          <Globe size={12} />
          {lang === "en" ? "PT" : "EN"}
        </button>
      </div>

      <div className="w-full max-w-sm space-y-8 animate-slide-up">
        <div className="text-center space-y-2">
          <Link href="/">
            <Logo className="mx-auto hover:opacity-80 transition-opacity" size="lg" />
          </Link>
          <h1 className="font-display text-xl font-bold text-foreground">{page.title}</h1>
          <p className="text-muted-foreground text-sm">{page.subtitle}</p>
        </div>
        {page.form}
        {page.footer}
      </div>
    </div>
  );
}
