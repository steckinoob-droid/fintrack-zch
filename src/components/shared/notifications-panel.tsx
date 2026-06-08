"use client";

import { useEffect, useState, useRef } from "react";
import {
  Bell, AlertTriangle, XCircle, Target, TrendingUp,
  CheckCircle, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/context";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import type { Budget, SavingsGoal } from "@/lib/types";

interface Notification {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  urgency: "info" | "warning" | "danger" | "success";
  read: boolean;
}

export function NotificationsPanel() {
  const { lang, fc } = useLang();
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [read, setRead]                   = useState<Set<string>>(new Set());
  const ref                               = useRef<HTMLDivElement>(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [bRes, gRes, tRes] = await Promise.all([
        supabase.from("budgets").select("*, category:categories(*)").eq("user_id", user.id).eq("month", monthStart),
        supabase.from("savings_goals").select("*").eq("user_id", user.id),
        supabase.from("transactions").select("amount, type, category_id").eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd),
      ]);

      const budgets: Budget[]      = bRes.data ?? [];
      const goals: SavingsGoal[]   = gRes.data ?? [];
      const txs                    = tRes.data ?? [];
      const notes: Notification[]  = [];
      const pt                     = lang === "pt";

      for (const b of budgets) {
        const spent = txs
          .filter((t: any) => t.type === "expense" && t.category_id === b.category_id)
          .reduce((s: number, t: any) => s + t.amount, 0);
        const pct = (spent / b.amount) * 100;
        if (pct >= 100) {
          notes.push({
            id: `budget-over-${b.id}`,
            icon: <XCircle size={15} className="text-red-400" />,
            title: pt ? `Limite excedido — ${b.category?.name}` : `Over budget — ${b.category?.name}`,
            description: pt
              ? `Você gastou ${fc(spent - b.amount)} acima do orçado de ${fc(b.amount)}.`
              : `Spent ${fc(spent - b.amount)} over the ${fc(b.amount)} budget.`,
            href: "/budgets", urgency: "danger", read: false,
          });
        } else if (pct >= 80) {
          notes.push({
            id: `budget-warn-${b.id}`,
            icon: <AlertTriangle size={15} className="text-amber-400" />,
            title: pt ? `Quase no limite — ${b.category?.name}` : `Approaching limit — ${b.category?.name}`,
            description: pt
              ? `${Math.round(pct)}% do orçamento de ${fc(b.amount)} utilizado.`
              : `${Math.round(pct)}% of the ${fc(b.amount)} budget used.`,
            href: "/budgets", urgency: "warning", read: false,
          });
        }
      }

      for (const g of goals) {
        const pct = (g.current_amount / g.target_amount) * 100;
        if (pct >= 100) {
          notes.push({
            id: `goal-done-${g.id}`,
            icon: <CheckCircle size={15} className="text-emerald-400" />,
            title: pt ? `Meta atingida! — ${g.name}` : `Goal reached! — ${g.name}`,
            description: pt
              ? `Parabéns! Você alcançou ${fc(g.target_amount)}.`
              : `Congratulations! You reached ${fc(g.target_amount)}.`,
            href: "/goals", urgency: "success", read: false,
          });
        } else if (pct >= 75) {
          notes.push({
            id: `goal-close-${g.id}`,
            icon: <Target size={15} className="text-indigo-400" />,
            title: pt ? `Quase lá! — ${g.name}` : `Almost there! — ${g.name}`,
            description: pt
              ? `${Math.round(pct)}% da meta concluída. Faltam ${fc(g.target_amount - g.current_amount)}.`
              : `${Math.round(pct)}% of goal reached. ${fc(g.target_amount - g.current_amount)} to go.`,
            href: "/goals", urgency: "info", read: false,
          });
        }
      }

      const income      = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
      const expenses    = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
      const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
      if (savingsRate > 20 && income > 0) {
        notes.push({
          id: "savings-good",
          icon: <TrendingUp size={15} className="text-emerald-400" />,
          title: pt ? "Bom saldo mensal!" : "Great monthly balance!",
          description: pt
            ? `${Math.round(savingsRate)}% da renda ainda não foi gasta. Considere mover para suas metas.`
            : `${Math.round(savingsRate)}% of income is unspent. Consider moving it to your goals.`,
          href: "/goals", urgency: "success", read: false,
        });
      }

      if (notes.length === 0) {
        notes.push({
          id: "all-good",
          icon: <CheckCircle size={15} className="text-emerald-400" />,
          title: pt ? "Tudo em ordem!" : "All clear!",
          description: pt ? "Nenhum alerta no momento. Continue assim!" : "No alerts right now. Keep it up!",
          href: "/dashboard", urgency: "success", read: false,
        });
      }

      setNotifications(notes);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, fc]);

  // ── Close on outside click (desktop only) ────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Close on Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // ── Body scroll lock while open ──────────────────────────────────────────
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const unread = notifications.filter((n) => !read.has(n.id)).length;

  function markAllRead() {
    setRead(new Set(notifications.map((n) => n.id)));
  }

  const urgencyStyles = {
    danger:  "border-red-500/20 bg-red-500/5",
    warning: "border-amber-500/20 bg-amber-500/5",
    success: "border-emerald-500/20 bg-emerald-500/5",
    info:    "border-indigo-500/20 bg-indigo-500/5",
  };

  const pt = lang === "pt";

  // ── Shared sub-elements ──────────────────────────────────────────────────
  const panelHeader = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
      <div className="flex items-center gap-2">
        <Bell size={15} className="text-foreground" />
        <span className="text-sm font-semibold text-foreground">
          {pt ? "Notificações" : "Notifications"}
        </span>
        {unread > 0 && (
          <span className="h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center px-1">
            {unread}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            {pt ? "Marcar tudo como lido" : "Mark all read"}
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={pt ? "Fechar" : "Close"}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );

  const panelList = (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-border/30 scrollbar-thin">
      {notifications.map((n) => {
        const isRead = read.has(n.id);
        return (
          <Link
            key={n.id}
            href={n.href}
            onClick={() => { setRead((p) => new Set([...p, n.id])); setOpen(false); }}
            className={cn(
              "flex items-start gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors",
              isRead && "opacity-60"
            )}
          >
            <div className={cn(
              "mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border",
              urgencyStyles[n.urgency]
            )}>
              {n.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                isRead ? "text-muted-foreground" : "text-foreground"
              )}>
                {n.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.description}</p>
            </div>
            {!isRead && <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
          </Link>
        );
      })}
    </div>
  );

  const panelFooter = (
    <div className="px-4 py-3 border-t border-border/50 shrink-0">
      <Link
        href="/reports"
        onClick={() => setOpen(false)}
        className="text-xs text-primary hover:underline"
      >
        {pt ? "Ver relatórios completos →" : "View full reports →"}
      </Link>
    </div>
  );

  return (
    <div ref={ref} className="relative">
      {/* ── Bell button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={pt ? "Notificações" : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
        )}
      </button>

      {open && (
        <>
          {/* ════════════════════════════════════════════════════════════════
              MOBILE  (<lg) — full-screen overlay + bottom sheet

              Fix: the old "absolute right-0 w-80" caused the 320px panel to
              overflow the left edge of the viewport (e.g. on 375px screens
              the bell is ~58px from the right, so left edge = 375-58-320 = -3px).
              Desktop dropdown patterns simply do not work on narrow screens.

              New pattern: fixed full-screen backdrop + slide-up bottom sheet
              with internal scroll.  z-[80/81] sits above FAB (z-40), bottom nav,
              and dashboard cards but below toasts (z-[90]).
          ════════════════════════════════════════════════════════════════ */}
          <div className="lg:hidden" role="dialog" aria-modal="true" aria-label={pt ? "Notificações" : "Notifications"}>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
              aria-hidden
            />

            {/* Sheet */}
            <div
              className="fixed inset-x-0 bottom-0 z-[81] flex flex-col bg-card border-t border-border/50 rounded-t-2xl shadow-2xl animate-slide-up"
              style={{ maxHeight: "min(85svh, 560px)" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0" aria-hidden>
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>

              {panelHeader}
              {panelList}
              {panelFooter}

              {/* Safe area spacer for home indicator */}
              <div className="safe-bottom shrink-0" />
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              DESKTOP (lg+) — absolute dropdown anchored to the bell button.
              Position is fine on wide screens; the panel is right-aligned and
              max-w constraint prevents it from clipping the left edge.
          ════════════════════════════════════════════════════════════════ */}
          <div
            className="hidden lg:block absolute right-0 top-11 w-80 z-50 animate-slide-up"
            role="dialog"
            aria-modal="true"
            aria-label={pt ? "Notificações" : "Notifications"}
          >
            <div className="rounded-xl border border-border/60 shadow-2xl bg-card flex flex-col overflow-hidden">
              {panelHeader}
              <div className="max-h-96 overflow-y-auto overscroll-contain divide-y divide-border/30 scrollbar-thin">
                {notifications.map((n) => {
                  const isRead = read.has(n.id);
                  return (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => { setRead((p) => new Set([...p, n.id])); setOpen(false); }}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors",
                        isRead && "opacity-60"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border",
                        urgencyStyles[n.urgency]
                      )}>
                        {n.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", isRead ? "text-muted-foreground" : "text-foreground")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.description}</p>
                      </div>
                      {!isRead && <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </Link>
                  );
                })}
              </div>
              {panelFooter}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
