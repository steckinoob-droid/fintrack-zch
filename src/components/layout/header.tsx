"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { CommandPalette } from "@/components/shared/command-palette";
import { NotificationsPanel } from "@/components/shared/notifications-panel";
import { formatMonthYear } from "@/lib/utils/date";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  user: User;
  profile: Profile | null;
}

export function Header({ user, profile }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const displayName = profile?.name ?? user.email?.split("@")[0] ?? "Usuário";
  const firstName = displayName.split(" ")[0];
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Cmd+K / Ctrl+K atalho global
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="h-16 flex items-center justify-between gap-4 px-4 lg:px-6 border-b border-border/50 shrink-0">
        {/* Mobile: logo */}
        <div className="lg:hidden">
          <Logo size="sm" />
        </div>

        {/* Desktop: saudação */}
        <div className="hidden lg:flex flex-col">
          <p className="text-sm font-medium text-foreground">
            {greeting}, <span className="text-primary">{firstName}</span> 👋
          </p>
          <p className="text-xs text-muted-foreground">
            {formatMonthYear(now)} · Controle financeiro
          </p>
        </div>

        {/* Ações do header */}
        <div className="flex items-center gap-1.5">
          {/* Busca */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 h-9 rounded-lg border border-border/50 bg-muted/30 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Buscar"
          >
            <Search size={15} />
            <span className="hidden sm:inline text-xs">Buscar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border px-1 py-0.5 text-xs opacity-60">
              ⌘K
            </kbd>
          </button>

          {/* Notificações */}
          <NotificationsPanel />
        </div>
      </header>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
