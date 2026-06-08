"use client";

import { useState, useEffect } from "react";
import { Search, Globe, LogOut } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { CommandPalette } from "@/components/shared/command-palette";
import { NotificationsPanel } from "@/components/shared/notifications-panel";
import { UpgradeCta } from "@/components/layout/upgrade-cta";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { formatMonthYear } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  user: User;
  profile: Profile | null;
}

export function Header({ user, profile }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { lang, setLang } = useLang();
  const tx = appT[lang];
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const displayName = profile?.name ?? user.email?.split("@")[0] ?? "User";
  const firstName   = displayName.split(" ")[0];
  const now         = new Date();
  const hour        = now.getHours();
  const greeting    = hour < 12
    ? tx.header.greeting.morning
    : hour < 18 ? tx.header.greeting.afternoon
    : tx.header.greeting.evening;

  // Cmd+K / Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="h-16 flex items-center justify-between gap-4 px-4 lg:px-6 border-b border-border/50 shrink-0 bg-background/60 backdrop-blur-sm">
        {/* Mobile logo */}
        <div className="lg:hidden">
          <Logo size="sm" />
        </div>

        {/* Desktop greeting */}
        <div className="hidden lg:flex flex-col">
          <p className="text-sm font-medium text-foreground">
            {greeting},{" "}
            <span className="text-primary font-semibold">{firstName}</span> 👋
          </p>
          <p className="text-xs text-muted-foreground">
            {formatMonthYear(now, lang)} · {tx.header.subtitle}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 h-9 rounded-lg border border-border/50 bg-muted/20 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label={tx.header.search}
          >
            <Search size={14} />
            <span className="hidden sm:inline text-xs">{tx.header.search}</span>
            <kbd className="hidden sm:inline-flex items-center rounded border border-border/50 px-1 py-0.5 text-xs opacity-50">
              ⌘K
            </kbd>
          </button>

          {/* Plan CTA — compact pill */}
          <UpgradeCta compact />

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "pt" : "en")}
            className={cn(
              "flex items-center gap-1.5 h-9 rounded-lg border px-3 text-xs font-semibold transition-all",
              "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:bg-primary/8 hover:text-primary"
            )}
            aria-label="Switch language"
            title={lang === "en" ? "Switch to Português" : "Switch to English"}
          >
            <Globe size={13} />
            {lang === "en" ? "PT" : "EN"}
          </button>

          {/* Notifications */}
          <NotificationsPanel />

          {/* Logout — mobile only */}
          <button
            onClick={handleLogout}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label={tx.nav.logout}
            title={tx.nav.logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
