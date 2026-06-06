"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, AlertTriangle, XCircle, Target, TrendingUp, CheckCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/currency";
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
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [bRes, gRes, tRes] = await Promise.all([
        supabase.from("budgets").select("*, category:categories(*)").eq("user_id", user.id).eq("month", monthStart),
        supabase.from("savings_goals").select("*").eq("user_id", user.id),
        supabase.from("transactions").select("amount, type, category_id").eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd),
      ]);

      const budgets: Budget[] = bRes.data ?? [];
      const goals: SavingsGoal[] = gRes.data ?? [];
      const txs = tRes.data ?? [];

      const notes: Notification[] = [];

      // Budget alerts
      for (const b of budgets) {
        // Filter by CATEGORY — previously was summing ALL expenses regardless of category
        const spent = txs
          .filter((t: any) => t.type === "expense" && t.category_id === b.category_id)
          .reduce((s: number, t: any) => s + t.amount, 0);
        const pct = (spent / b.amount) * 100;
        if (pct >= 100) {
          notes.push({
            id: `budget-over-${b.id}`,
            icon: <XCircle size={15} className="text-red-400" />,
            title: `Limite excedido — ${b.category?.name}`,
            description: `Você gastou ${formatCurrency(spent - b.amount)} acima do orçado.`,
            href: "/budgets",
            urgency: "danger",
            read: false,
          });
        } else if (pct >= 80) {
          notes.push({
            id: `budget-warn-${b.id}`,
            icon: <AlertTriangle size={15} className="text-amber-400" />,
            title: `Quase no limite — ${b.category?.name}`,
            description: `${Math.round(pct)}% do orçamento de ${formatCurrency(b.amount)} utilizado.`,
            href: "/budgets",
            urgency: "warning",
            read: false,
          });
        }
      }

      // Goals close to completion
      for (const g of goals) {
        const pct = (g.current_amount / g.target_amount) * 100;
        if (pct >= 100) {
          notes.push({
            id: `goal-done-${g.id}`,
            icon: <CheckCircle size={15} className="text-emerald-400" />,
            title: `Meta atingida! — ${g.name}`,
            description: `Parabéns! Você alcançou ${formatCurrency(g.target_amount)}.`,
            href: "/goals",
            urgency: "success",
            read: false,
          });
        } else if (pct >= 75) {
          notes.push({
            id: `goal-close-${g.id}`,
            icon: <Target size={15} className="text-indigo-400" />,
            title: `Quase lá! — ${g.name}`,
            description: `${Math.round(pct)}% da meta concluída. Faltam ${formatCurrency(g.target_amount - g.current_amount)}.`,
            href: "/goals",
            urgency: "info",
            read: false,
          });
        }
      }

      // Monthly savings tip
      const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
      const expenses = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
      const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
      if (savingsRate > 20 && income > 0) {
        notes.push({
          id: "savings-good",
          icon: <TrendingUp size={15} className="text-emerald-400" />,
          title: "Bom saldo mensal!",
          description: `${Math.round(savingsRate)}% da renda ainda não foi gasta. Considere mover o saldo para suas metas.`,
          href: "/goals",
          urgency: "success",
          read: false,
        });
      }

      if (notes.length === 0) {
        notes.push({
          id: "all-good",
          icon: <CheckCircle size={15} className="text-emerald-400" />,
          title: "Tudo em ordem!",
          description: "Nenhum alerta no momento. Continue assim!",
          href: "/dashboard",
          urgency: "success",
          read: false,
        });
      }

      setNotifications(notes);
    }
    load();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Lock body scroll while panel is open (prevents page scrolling behind the panel on mobile)
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notificações"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-1rem)] z-50 animate-slide-up">
          <div className="rounded-xl border border-border/60 shadow-2xl overflow-hidden bg-card">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-foreground" />
                <span className="text-sm font-semibold text-foreground">Notificações</span>
                {unread > 0 && (
                  <span className="h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center px-1">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Marcar tudo como lido
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-72 sm:max-h-96 overflow-y-auto overscroll-contain divide-y divide-border/30">
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
                    <div className={cn("mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border", urgencyStyles[n.urgency])}>
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

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border/50">
              <Link href="/reports" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">
                Ver relatórios completos →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
