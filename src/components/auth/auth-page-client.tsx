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
      <div className="w-full max-w-sm space-y-6 animate-slide-up">
        {/* Header: logo + lang toggle */}
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo className="hover:opacity-80 transition-opacity" size="md" />
          </Link>
          {/* Language toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/20 p-0.5">
            {(["en", "pt"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold uppercase transition-all",
                  lang === l
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe size={10} />
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1.5">
          <h1 className="font-display text-2xl font-bold text-foreground">{page.title}</h1>
          <p className="text-muted-foreground text-sm">{page.subtitle}</p>
        </div>

        {page.form}
        {page.footer}
      </div>
    </div>
  );
}
