"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const { lang } = useLang();
  const tx = appT[lang].auth.login;
  const [showPass, setShowPass] = useState(false);
  const [notConfirmedEmail, setNotConfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setNotConfirmedEmail(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      const isNotConfirmed =
        error.message === "Email not confirmed" ||
        error.message.toLowerCase().includes("not confirmed") ||
        (error as { code?: string }).code === "email_not_confirmed";

      if (isNotConfirmed) {
        setNotConfirmedEmail(data.email);
        return;
      }
      toast.error(tx.errors.invalidCredentials);
      return;
    }
    toast.success(tx.success);
    router.push("/dashboard");
    router.refresh();
  }

  async function handleResendConfirmation() {
    if (!notConfirmedEmail || resending) return;
    setResending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: notConfirmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setResending(false);
    if (error) {
      const isRateLimit =
        error.message.toLowerCase().includes("rate") ||
        error.message.includes("60 seconds") ||
        (error as { status?: number }).status === 429;
      toast.error(
        isRateLimit
          ? appT[lang].auth.register.resendRateLimit
          : appT[lang].auth.register.resendError
      );
    } else {
      toast.success(tx.confirmationResent);
      setNotConfirmedEmail(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* ── Email not-confirmed banner ─────────────────────────────────────── */}
      {notConfirmedEmail && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 space-y-3 animate-slide-up">
          {/* Icon + message */}
          <div className="flex gap-3">
            <Mail size={16} className="text-amber-400 shrink-0 mt-px" aria-hidden />
            <p className="text-sm text-foreground/90 leading-relaxed">
              {tx.emailNotConfirmed}
            </p>
          </div>

          {/* Resend action */}
          <div className="pl-7">
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resending}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-md
                         border border-amber-500/25 bg-amber-500/[0.08]
                         text-xs font-medium text-amber-400
                         hover:bg-amber-500/[0.15] hover:border-amber-500/35 hover:text-amber-300
                         transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resending ? (
                <><Loader2 size={12} className="animate-spin" /> {appT[lang].auth.register.resending}</>
              ) : (
                <><RefreshCw size={12} /> {tx.resendConfirmation}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Login form ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">{tx.email}</Label>
          <Input
            id="email"
            type="email"
            placeholder={tx.emailPlaceholder}
            autoComplete="email"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{tx.password}</Label>
            <a
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              {tx.forgotPassword}
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPass ? "text" : "password"}
              placeholder={tx.passwordPlaceholder}
              autoComplete="current-password"
              className="pr-10"
              {...register("password")}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 size={15} className="animate-spin" /> {tx.submitting}</>
          ) : (
            tx.submit
          )}
        </Button>
      </form>
    </div>
  );
}
