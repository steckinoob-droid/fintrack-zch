"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, ArrowRight, RefreshCw } from "lucide-react";
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

/** Query the server-side check-email endpoint.
 *  Returns "free" | "confirmed" | "unconfirmed" | "skip"
 *  "skip" = endpoint not available (503/network); use identities fallback.
 */
async function checkEmailStatus(email: string): Promise<"free" | "confirmed" | "unconfirmed" | "skip"> {
  try {
    const res = await fetch("/api/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.status === 503) return "skip"; // service key not configured — degrade gracefully
    if (!res.ok) return "skip";            // unexpected error — degrade gracefully
    const json = await res.json() as { state?: string };
    if (json.state === "confirmed" || json.state === "unconfirmed" || json.state === "free") {
      return json.state;
    }
    return "skip";
  } catch {
    return "skip"; // network error — degrade gracefully
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

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Clear the email-already-exists error as soon as the user edits the field
  const watchedEmail = watch("email");
  useEffect(() => {
    if (emailBlock) setEmailBlock(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedEmail]);

  async function onSubmit(data: FormData) {
    setEmailBlock(null);
    const supabase = createClient();

    // ── 1. Server-side pre-check via service-role admin API ──────────────────
    // This catches the case where Supabase silently accepts a duplicate signUp
    // (returns no error but identities: []) and the confirmation email never arrives.
    const emailStatus = await checkEmailStatus(data.email);

    if (emailStatus === "confirmed") {
      // Email exists and is confirmed → block with clear message + action links
      setEmailBlock("inUse");
      return;
    }

    if (emailStatus === "unconfirmed") {
      // Email exists but was never confirmed → resend the link, show verify screen.
      // Do NOT call signUp again — it would be silently ignored anyway.
      await supabase.auth.resend({
        type: "signup",
        email: data.email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
      });
      setEmailBlock("unconfirmed"); // show hint inside verify screen
      setSentTo(data.email);
      return;
    }

    // emailStatus === "free" or "skip" (no service key, use identities fallback below)

    // ── 2. Create the account ────────────────────────────────────────────────
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) { toast.error(error.message); return; }

    // ── 3. Identities fallback ───────────────────────────────────────────────
    // When the pre-check was skipped (no service key), detect duplicate signup
    // via the `identities: []` signal that Supabase embeds in the response.
    // If identities is empty the email already exists — we can't tell whether
    // it's confirmed or not, so we show the generic "already in use" message.
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

  /* ── Email verification screen ── */
  if (sentTo) {
    return (
      <div className="glass-card p-8 space-y-6 text-center animate-slide-up">
        {/* Icon */}
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
          <Mail size={30} className="text-primary" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="font-display font-bold text-xl text-foreground">{tx.verifyTitle}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {tx.verifyDesc}{" "}
            <span className="font-semibold text-foreground break-all">{sentTo}</span>
          </p>
          <p className="text-xs text-muted-foreground">{tx.verifySpam}</p>
        </div>

        {/* Extra hint for unconfirmed-existing accounts */}
        {emailBlock === "unconfirmed" && (
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/8 px-4 py-3">
            <p className="text-xs leading-relaxed text-sky-300">{tx.emailUnconfirmedHint}</p>
          </div>
        )}

        {/* Warning */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-300">{tx.verifyNote}</p>
        </div>

        {/* Resend button */}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading || resendCooldown > 0}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-border/60 bg-muted/40 px-6 py-2.5 text-sm text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendLoading
            ? <><Loader2 size={14} className="animate-spin" /> {tx.resending}</>
            : resendCooldown > 0
              ? <><RefreshCw size={14} /> {tx.resendCooldown.replace("{n}", String(resendCooldown))}</>
              : <><RefreshCw size={14} /> {tx.resend}</>
          }
        </button>

        {/* CTA */}
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          {tx.verifyAction} <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  /* ── Registration form ── */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">{tx.name}</Label>
        <Input id="name" placeholder={tx.namePlaceholder} autoComplete="name"
          {...register("name")} aria-invalid={!!errors.name} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{tx.email}</Label>
        <Input id="email" type="email" placeholder={tx.emailPlaceholder} autoComplete="email"
          {...register("email")} aria-invalid={!!errors.email || emailBlock === "inUse"} />

        {/* Email-already-exists error block */}
        {emailBlock === "inUse" && (
          <div className="rounded-xl border border-destructive/25 bg-destructive/8 p-3 space-y-2 animate-slide-up">
            <p className="text-xs font-medium text-destructive">{tx.emailInUse}</p>
            <p className="text-xs text-muted-foreground">{tx.emailInUseHint}</p>
            <div className="flex items-center gap-4 pt-0.5">
              <Link href="/login"
                className="text-xs font-semibold text-primary hover:underline">
                {tx.signIn}
              </Link>
              <Link href="/forgot-password"
                className="text-xs font-semibold text-primary hover:underline">
                {tx.resetPassword}
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{tx.password}</Label>
        <div className="relative">
          <Input id="password" type={showPass ? "text" : "password"} placeholder={tx.passwordPlaceholder}
            autoComplete="new-password" className="pr-10" {...register("password")} aria-invalid={!!errors.password} />
          <button type="button" onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> {tx.submitting}</> : tx.submit}
      </Button>
    </form>
  );
}
