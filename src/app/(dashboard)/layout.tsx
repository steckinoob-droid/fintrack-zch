import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { DashboardProviders } from "@/components/layout/dashboard-providers";
import { QuickAddFab } from "@/components/shared/quick-add-fab";
import { isAdminEmail } from "@/lib/admin/is-admin";

// Force dynamic rendering so router.refresh() always re-fetches from DB.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Use service role so the profile is always readable regardless of
  // the user's JWT state — avoids the silent null when the access token
  // is stale and PostgREST evaluates auth.uid() as NULL.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const adminAccess = isAdminEmail(user.email);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar user={user} profile={profile} isAdmin={adminAccess} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} profile={profile} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <div className="p-4 pb-24 lg:p-6 lg:pb-6 max-w-[1400px] mx-auto animate-fade-in">
            <DashboardProviders>{children}</DashboardProviders>
          </div>
        </main>
        <QuickAddFab />
        <MobileNav isAdmin={adminAccess} />
      </div>
    </div>
  );
}
