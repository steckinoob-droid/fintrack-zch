"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, PieChart, Target, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";

export function MobileNav() {
  const pathname = usePathname();
  const { lang } = useLang();
  const tx       = appT[lang].nav;

  const ITEMS = [
    { href: "/dashboard",    label: tx.dashboard,    icon: LayoutDashboard },
    { href: "/transactions", label: tx.transactions, icon: ArrowLeftRight  },
    { href: "/budgets",      label: tx.budgets,      icon: PieChart        },
    { href: "/goals",        label: tx.goals,        icon: Target          },
    { href: "/reports",      label: tx.reports,      icon: BarChart3       },
    { href: "/settings",     label: tx.settings,     icon: Settings        },
  ];

  return (
    <nav className="lg:hidden flex items-center border-t border-border/50 bg-card/80 backdrop-blur-sm safe-bottom">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors relative",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={19} strokeWidth={active ? 2.5 : 1.75} />
            <span className="text-[9px] leading-tight">{label}</span>
            {active && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
