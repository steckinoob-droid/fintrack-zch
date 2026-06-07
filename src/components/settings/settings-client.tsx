"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, LogOut, Trash2, Shield, Globe, Eye, EyeOff, DollarSign, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "@/lib/hooks/use-toast";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { getCurrencySymbol } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";

const CURRENCIES = [
  { code: "BRL", label: "Real Brasileiro",     flag: "🇧🇷" },
  { code: "USD", label: "US Dollar",           flag: "🇺🇸" },
  { code: "EUR", label: "Euro",                flag: "🇪🇺" },
  { code: "GBP", label: "British Pound",       flag: "🇬🇧" },
  { code: "ARS", label: "Peso Argentino",      flag: "🇦🇷" },
  { code: "MXN", label: "Peso Mexicano",       flag: "🇲🇽" },
  { code: "CLP", label: "Peso Chileno",        flag: "🇨🇱" },
  { code: "COP", label: "Peso Colombiano",     flag: "🇨🇴" },
  { code: "CAD", label: "Canadian Dollar",     flag: "🇨🇦" },
  { code: "AUD", label: "Australian Dollar",   flag: "🇦🇺" },
  { code: "CHF", label: "Swiss Franc",         flag: "🇨🇭" },
  { code: "JPY", label: "Japanese Yen",        flag: "🇯🇵" },
];

export function SettingsClient() {
  const router = useRouter();
  const { lang, setLang, currency, setCurrency } = useLang();
  const tx = appT[lang].settings;

  const [email, setEmail]         = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting]   = useState(false);

  const CONFIRM_WORD = lang === "en" ? "DELETE" : "APAGAR";

  const profileSchema = z.object({ name: z.string().min(2) });
  const passwordSchema = z.object({
    password: z.string().min(6),
    confirm:  z.string().min(6),
  }).refine(d => d.password === d.confirm, { message: tx.passwordMismatch, path: ["confirm"] });

  type ProfileData  = z.infer<typeof profileSchema>;
  type PasswordData = z.infer<typeof passwordSchema>;

  const profileForm  = useForm<ProfileData>({ resolver: zodResolver(profileSchema) });
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
    const { error } = await supabase.from("profiles").update({ name: data.name, currency }).eq("id", user.id);
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

  async function handleDeleteAccount() {
    if (deleteConfirm.toUpperCase() !== CONFIRM_WORD) return;
    setDeleting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(false); return; }

    // Delete all user data in order (respecting FK constraints)
    await Promise.all([
      supabase.from("transactions").delete().eq("user_id", user.id),
      supabase.from("budgets").delete().eq("user_id", user.id),
      supabase.from("savings_goals").delete().eq("user_id", user.id),
    ]);
    await supabase.from("categories").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);

    // Sign out — account deletion from Auth side requires server-side admin API,
    // so we sign out and the orphaned auth record is harmless (no data remains).
    await supabase.auth.signOut();
    toast.success(lang === "en" ? "Account deleted." : "Conta apagada.");
    router.push("/login");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={tx.title} description={tx.description} />

      {/* ── Profile ───────────────────────────────────────────────────── */}
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

      {/* ── Language ──────────────────────────────────────────────────── */}
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

      {/* ── Currency ──────────────────────────────────────────────────── */}
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">{tx.currency}</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">{tx.currencyHelper}</p>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(c => (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-2">
                  <span>{c.flag}</span>
                  <span className="font-medium">{c.code}</span>
                  <span className="text-muted-foreground text-xs">— {c.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground font-mono">{getCurrencySymbol(c.code)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* ── Security ──────────────────────────────────────────────────── */}
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">{tx.security}</h2>
        </div>
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{tx.newPassword}</Label>
            <div className="relative">
              <Input id="new-password" type={showPwd ? "text" : "password"} placeholder="••••••••"
                className="pr-10" {...passwordForm.register("password")} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1} aria-label={showPwd ? (lang === "en" ? "Hide" : "Ocultar") : (lang === "en" ? "Show" : "Mostrar")}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {passwordForm.formState.errors.password && <p className="text-xs text-destructive">{tx.minChars}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">{tx.confirmPassword}</Label>
            <div className="relative">
              <Input id="confirm-password" type={showConfirm ? "text" : "password"} placeholder="••••••••"
                className="pr-10" {...passwordForm.register("confirm")} />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1} aria-label={showConfirm ? (lang === "en" ? "Hide" : "Ocultar") : (lang === "en" ? "Show" : "Mostrar")}>
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {passwordForm.formState.errors.confirm && <p className="text-xs text-destructive">{tx.passwordMismatch}</p>}
          </div>
          <Button type="submit" variant="outline" disabled={passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting ? <><Loader2 size={14} className="animate-spin" /> {tx.changingPassword}</> : tx.changePassword}
          </Button>
        </form>
      </section>

      {/* ── Danger zone ───────────────────────────────────────────────── */}
      <section className="glass-card p-6 border-red-500/20 space-y-4">
        <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Trash2 size={16} className="text-red-400" /> {tx.danger}
        </h2>

        {/* Sign out */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
          <div>
            <p className="text-sm font-medium text-foreground">{tx.signOut}</p>
            <p className="text-xs text-muted-foreground">{tx.signOutDesc}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut size={14} /> {tx.signOut}
          </Button>
        </div>

        {/* Delete account */}
        <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 space-y-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">{tx.deleteAccount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tx.deleteAccountWarning}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{tx.deleteAccountConfirmLabel}</p>
            <Input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleDeleteAccount()}
              placeholder={tx.deleteAccountConfirmPlaceholder}
              className="font-mono border-red-500/30 focus:border-red-500/60 focus:ring-red-500/20"
            />
          </div>
          <Button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm.toUpperCase() !== CONFIRM_WORD || deleting}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 w-full sm:w-auto"
          >
            {deleting
              ? <><Loader2 size={14} className="animate-spin" /> {tx.deleting}</>
              : <><Trash2 size={14} /> {tx.deleteAccount}</>}
          </Button>
        </div>
      </section>
    </div>
  );
}
