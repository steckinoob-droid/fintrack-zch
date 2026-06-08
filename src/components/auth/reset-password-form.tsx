"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

type FormData = { password: string; confirm: string };

export function ResetPasswordForm() {
  const router = useRouter();
  const { lang } = useLang();
  const tx = appT[lang].auth.resetPassword;
  const [showPass, setShowPass] = useState(false);

  // Schema built from i18n so validation messages are localised
  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(6, tx.minPassword),
          confirm: z.string().min(6),
        })
        .refine((d) => d.password === d.confirm, {
          message: tx.mismatch,
          path: ["confirm"],
        }),
    // tx reference is stable per lang — update schema when lang changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang]
  );

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) { toast.error(tx.error, error.message); return; }
    toast.success(tx.success, tx.successDesc);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-4">
      <p className="text-sm text-muted-foreground -mt-1 pb-1">{tx.subtitle}</p>

      <div className="space-y-1.5">
        <Label htmlFor="password">{tx.password}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPass ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            className="pr-10"
            {...register("password")}
            aria-invalid={!!errors.password}
          />
          <button type="button" onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">{tx.confirm}</Label>
        <Input
          id="confirm"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          {...register("confirm")}
          aria-invalid={!!errors.confirm}
        />
        {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> {tx.submitting}</> : tx.submit}
      </Button>
    </form>
  );
}
