"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, LogOut, Trash2, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "@/lib/hooks/use-toast";
import type { Profile } from "@/lib/types";

const profileSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
});
type ProfileData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirm: z.string().min(6),
}).refine((d) => d.password === d.confirm, { message: "As senhas não coincidem", path: ["confirm"] });
type PasswordData = z.infer<typeof passwordSchema>;

export function SettingsClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");

  const profileForm = useForm<ProfileData>({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      if (data?.name) profileForm.setValue("name", data.name);
    }
    load();
  }, [profileForm]);

  async function onUpdateProfile(data: ProfileData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ name: data.name }).eq("id", user.id);
    if (error) { toast.error("Erro ao atualizar perfil"); return; }
    toast.success("Perfil atualizado!");
  }

  async function onChangePassword(data: PasswordData) {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) { toast.error("Erro ao alterar senha"); return; }
    toast.success("Senha alterada!");
    passwordForm.reset();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Configurações" description="Gerencie seu perfil e preferências da conta" />

      {/* Profile */}
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">Perfil</h2>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={email} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
        </div>
        <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settings-name">Nome</Label>
            <Input id="settings-name" placeholder="Seu nome" {...profileForm.register("name")} aria-invalid={!!profileForm.formState.errors.name} />
            {profileForm.formState.errors.name && (
              <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>
            )}
          </div>
          <Button type="submit" disabled={profileForm.formState.isSubmitting}>
            {profileForm.formState.isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : "Salvar perfil"}
          </Button>
        </form>
      </section>

      {/* Password */}
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">Segurança</h2>
        </div>
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input id="new-password" type="password" placeholder="••••••••" {...passwordForm.register("password")} aria-invalid={!!passwordForm.formState.errors.password} />
            {passwordForm.formState.errors.password && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input id="confirm-password" type="password" placeholder="••••••••" {...passwordForm.register("confirm")} aria-invalid={!!passwordForm.formState.errors.confirm} />
            {passwordForm.formState.errors.confirm && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.confirm.message}</p>
            )}
          </div>
          <Button type="submit" variant="outline" disabled={passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Alterando...</> : "Alterar senha"}
          </Button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="glass-card p-6 border-red-500/20">
        <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Trash2 size={16} className="text-red-400" />
          Zona de perigo
        </h2>
        <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
          <div>
            <p className="text-sm font-medium text-foreground">Sair da conta</p>
            <p className="text-xs text-muted-foreground">Você será redirecionado para a tela de login</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut size={14} /> Sair
          </Button>
        </div>
      </section>
    </div>
  );
}
