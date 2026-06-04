"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      toast.error(tx.errors.invalidCredentials);
      return;
    }
    toast.success(tx.success);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-4">
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
        {errors.email && <p className="text-xs text-destructive" role="alert">{tx.email}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{tx.password}</Label>
          <a href="/forgot-password" className="text-xs text-primary hover:underline">
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> {tx.submitting}</> : tx.submit}
      </Button>
    </form>
  );
}
