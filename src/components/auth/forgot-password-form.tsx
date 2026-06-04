"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const { lang } = useLang();
  const tx = appT[lang].auth.forgotPassword;
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle size={24} className="text-emerald-400" />
          </div>
        </div>
        <h3 className="font-display font-semibold text-foreground">{tx.sentTitle}</h3>
        <p className="text-sm text-muted-foreground">{tx.sentDesc}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{tx.email}</Label>
        <Input id="email" type="email" placeholder={tx.emailPlaceholder} autoComplete="email" {...register("email")} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> {tx.submitting}</> : tx.submit}
      </Button>
    </form>
  );
}
