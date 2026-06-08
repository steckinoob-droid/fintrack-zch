import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { AdminClient } from "@/components/admin/admin-client";
import { ShieldOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!isAdminEmail(user.email)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
          <ShieldOff size={28} className="text-red-400" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">403 — Acesso negado</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Você não tem permissão para acessar esta área.
          </p>
        </div>
      </div>
    );
  }

  return <AdminClient adminEmail={user.email!} />;
}
