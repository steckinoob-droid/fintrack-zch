"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});
type FormData = z.infer<typeof schema>;

type EmailBlock = "inUse" | "unconfirmed" | null;

async function checkEmailStatus(
  email: string
): Promise<"free" | "confirmed" | "unconfirmed" | "skip"> {
  try {
    const res = await fetch("/api/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.status === 503) return "skip";
    if (!res.ok) return "skip";
    const json = await res.json() as { state?: string };
    if (
      json.state === "confirmed" ||
      json.state === "unconfirmed" ||
      json.state === "free"
    ) {
      return json.state;
    }
    return "skip";
  } catch {
    return "skip";
  }
}

export function RegisterForm() {
  const { lang } = useLang();
  const tx = appT[lang].auth.register;
  const [showPass, setShowPass] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailBlock, setEmailBlock] = useState<EmailBlock>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Clear email-block error the moment the user edits the email field
  const watchedEmail = watch("email");
  useEffect(() => {
    if (emailBlock) setEmailBlock(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedEmail]);

  async function onSubmit(data: FormData) {
    setEmailBlock(null);
    const supabase = createClient();

    const emailStatus = await checkEmailStatus(data.email);

    if (emailStatus === "confirmed") {
      setEmailBlock("inUse");
      return;
    }

    if (emailStatus === "unconfirmed") {
      await supabase.auth.resend({
        type: "signup",
        email: data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      setEmailBlock("unconfirmed");
      setSentTo(data.email);
      return;
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) { toast.error(error.message); return; }

    if (emailStatus === "skip" && !signUpData.user?.identities?.length) {
      setEmailBlock("inUse");
      return;
    }

    setSentTo(data.email);
  }

  async function handleResend() {
    if (!sentTo || resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setResendLoading(false);
    if (error) {
      const isRateLimit =
        error.message.toLowerCase().includes("rate") ||
        error.message.includes("60 seconds") ||
        (error as { status?: number }).status === 429;
      toast.error(isRateLimit ? tx.resendRateLimit : tx.resendError);
      if (isRateLimit) setResendCooldown(60);
    } else {
      toast.success(tx.resendSuccess);
      setResendCooldown(60);
    }
  }

  /* ── Email verification screen ─────────────────────────────────────────── */
  if (sentTo) {
    return (
      <div className="glass-card p-8 space-y-5 text-center animate-slide-up">
        {/* Icon */}
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
          <Mail size={26} className="text-primary" />
        </div>

        {/* Heading */}
        <div className="space-y-1.5">
          <h2 className="font-display font-bold text-xl text-foreground">
            {tx.verifyTitle}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {tx.verifyDesc}{" "}
            <span className="font-semibold text-foreground break-all">{sentTo}</span>
          </p>
          <p className="text-xs text-muted-foreground">{tx.verifySpam}</p>
        </div>

        {/* Hint for existing-unconfirmed accounts */}
        {emailBlock === "unconfirmed" && (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-left">
            <p className="text-xs leading-relaxed text-sky-300/90">
              {tx.emailUnconfirmedHint}
            </p>
          </div>
        )}

        {/* Warning */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-300/90">{tx.verifyNote}</p>
        </div>

        {/* Resend */}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading || resendCooldown > 0}
          className="flex items-center justify-center gap-2 w-full rounded-xl
                     border border-border/50 bg-muted/30 px-6 py-2.5
                     text-sm text-muted-foreground
                     hover:bg-muted/50 hover:text-foreground
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendLoading ? (
            <><Loader2 size={14} className="animate-spin" /> {tx.resending}</>
          ) : resendCooldown > 0 ? (
            <><RefreshCw size={14} /> {tx.resendCooldown.replace("{n}", String(resendCooldown))}</>
          ) : (
            <><RefreshCw size={14} /> {tx.resend}</>
          )}
        </button>

        {/* Go to login */}
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl
                     bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground
                     shadow-lg shadow-primary/20 transition-all
                     hover:brightness-110 active:scale-[0.98]"
        >
          {tx.verifyAction} <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  /* ── Registration form ──────────────────────────────────────────────────── */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-4">

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">{tx.name}</Label>
        <Input
          id="name"
          placeholder={tx.namePlaceholder}
          autoComplete="name"
          {...register("name")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "register-name-error" : undefined}
        />
        {errors.name && (
          <p id="register-name-error" role="alert" className="text-xs text-destructive">
            {tx.errors.nameMin}
          </p>
        )}
      </div>

      {/* Email + duplicate-email alert */}
      <div className="space-y-1.5">
        <Label htmlFor="email">{tx.email}</Label>
        <Input
          id="email"
          type="email"
          placeholder={tx.emailPlaceholder}
          autoComplete="email"
          {...register("email")}
          aria-invalid={emailBlock === "inUse" || !!errors.email}
          aria-describedby={errors.email && emailBlock !== "inUse" ? "register-email-error" : undefined}
          className={
            emailBlock === "inUse"
              ? "border-red-500/40 focus-visible:ring-red-500/25"
              : undefined
          }
        />
        {errors.email && emailBlock !== "inUse" && (
          <p id="register-email-error" role="alert" className="text-xs text-destructive">
            {tx.errors.emailInvalid}
          </p>
        )}

        {emailBlock === "inUse" && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 space-y-3 animate-slide-up">
            {/* Title + description */}
            <div className="flex gap-3">
              <AlertCircle
                size={16}
                className="text-red-400 shrink-0 mt-px"
                aria-hidden
              />
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {tx.emailInUse}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tx.emailInUseHint}
                </p>
              </div>
            </div>

            {/* Action buttons — wrap on narrow screens */}
            <div className="flex flex-wrap gap-2 pl-7">
              <Button
                variant="secondary"
                size="sm"
                asChild
                className="h-8 shadow-none font-medium"
              >
                <Link href="/login">{tx.signIn}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 font-medium text-muted-foreground hover:text-foreground"
              >
                <Link href="/forgot-password">{tx.resetPassword}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="password">{tx.password}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPass ? "text" : "password"}
            placeholder={tx.passwordPlaceholder}
            autoComplete="new-password"
            className="pr-10"
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "register-password-error" : undefined}
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
        {errors.password && (
          <p id="register-password-error" role="alert" className="text-xs text-destructive">
            {tx.errors.passwordMin}
          </p>
        )}
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
  );
}
