"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ArrowLeftRight, Tag, PieChart,
  Target, BarChart3, Settings, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/shared/logo";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { UpgradeCta } from "@/components/layout/upgrade-cta";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import Image from "next/image";

interface SidebarProps {
  user: User;
  profile: Profile | null;
}

export function Sidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { lang } = useLang();
  const tx       = appT[lang].nav;

  const NAV_ITEMS = [
    { href: "/dashboard",    label: tx.dashboard,    icon: LayoutDashboard },
    { href: "/transactions", label: tx.transactions, icon: ArrowLeftRight  },
    { href: "/categories",   label: tx.categories,   icon: Tag             },
    { href: "/budgets",      label: tx.budgets,      icon: PieChart        },
    { href: "/goals",        label: tx.goals,        icon: Target          },
    { href: "/reports",      label: tx.reports,      icon: BarChart3       },
  ];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const displayName = profile?.name ?? user.email?.split("@")[0] ?? "User";
  const avatarUrl   = profile?.avatar_url ??
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=10b981&textColor=ffffff`;

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border/50 bg-card/20">
      {/* Logo */}
      <div className="flex h-16 items-center px-5 border-b border-border/50">
        <Logo size="md" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
          Menu
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn("sidebar-item", active && "active")}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 2} />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
            {tx.account}
          </p>
          <Link
            href="/settings"
            className={cn("sidebar-item", pathname === "/settings" && "active")}
          >
            <Settings size={17} />
            {tx.settings}
          </Link>
        </div>
      </nav>

      {/* Upgrade CTA */}
      <UpgradeCta />

      {/* User */}
      <div className="px-3 py-4 border-t border-border/50">
        <div className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/30 transition-colors group">
          <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 ring-2 ring-primary/20">
            <Image src={avatarUrl} alt={displayName} fill className="object-cover" unoptimized />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
            aria-label={tx.logout}
            title={tx.logout}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
