"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, LogOut, Trash2, Shield, Globe, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";
import type { Profile } from "@/lib/types";

export function SettingsClient() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const tx = appT[lang].settings;

  const [email, setEmail] = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const profileSchema = z.object({ name: z.string().min(2) });
  const passwordSchema = z.object({
    password: z.string().min(6),
    confirm: z.string().min(6),
  }).refine(d => d.password === d.confirm, { message: tx.passwordMismatch, path: ["confirm"] });

  type ProfileData = z.infer<typeof profileSchema>;
  type PasswordData = z.infer<typeof passwordSchema>;

  const profileForm = useForm<ProfileData>({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data?.name) profileForm.setValue("name", data.name);
    }
    load();
  }, [profileForm]);

  async function onUpdateProfile(data: ProfileData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ name: data.name }).eq("id", user.id);
    if (error) { toast.error(lang === "en" ? "Error updating profile" : "Erro ao atualizar perfil"); return; }
    toast.success(tx.profileUpdated);
  }

  async function onChangePassword(data: PasswordData) {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) { toast.error(lang === "en" ? "Error changing password" : "Erro ao alterar senha"); return; }
    toast.success(tx.passwordChanged);
    passwordForm.reset();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={tx.title} description={tx.description} />

      {/* Profile */}
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">{tx.profile}</h2>
        </div>
        <div className="space-y-1.5">
          <Label>{tx.email}</Label>
          <Input value={email} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">{tx.emailHelper}</p>
        </div>
        <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settings-name">{tx.name}</Label>
            <Input id="settings-name" {...profileForm.register("name")} aria-invalid={!!profileForm.formState.errors.name} />
          </div>
          <Button type="submit" disabled={profileForm.formState.isSubmitting}>
            {profileForm.formState.isSubmitting ? <><Loader2 size={14} className="animate-spin" /> {tx.saving}</> : tx.saveProfile}
          </Button>
        </form>
      </section>

      {/* Language */}
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">{tx.language}</h2>
        </div>
        <div className="flex items-center gap-2">
          {(["en", "pt"] as const).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                lang === l
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              )}>
              <Globe size={14} />
              {l === "en" ? "English" : "Português"}
              {lang === l && <span className="ml-1 text-xs">✓</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">{tx.security}</h2>
        </div>
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{tx.newPassword}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                className="pr-10"
                {...passwordForm.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPwd ? (lang === "en" ? "Hide password" : "Ocultar senha") : (lang === "en" ? "Show password" : "Mostrar senha")}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {passwordForm.formState.errors.password && (
              <p className="text-xs text-destructive">{tx.minChars}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">{tx.confirmPassword}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                className="pr-10"
                {...passwordForm.register("confirm")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showConfirm ? (lang === "en" ? "Hide password" : "Ocultar senha") : (lang === "en" ? "Show password" : "Mostrar senha")}
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {passwordForm.formState.errors.confirm && (
              <p className="text-xs text-destructive">{tx.passwordMismatch}</p>
            )}
          </div>
          <Button type="submit" variant="outline" disabled={passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting ? <><Loader2 size={14} className="animate-spin" /> {tx.changingPassword}</> : tx.changePassword}
          </Button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="glass-card p-6 border-red-500/20">
        <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trash2 size={16} className="text-red-400" /> {tx.danger}
        </h2>
        <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
          <div>
            <p className="text-sm font-medium text-foreground">{tx.signOut}</p>
            <p className="text-xs text-muted-foreground">{tx.signOutDesc}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut size={14} /> {tx.signOut}
          </Button>
        </div>
      </section>
    </div>
  );
}
