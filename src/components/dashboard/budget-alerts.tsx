"use client";

import { AlertTriangle, XCircle, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import type { Budget } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

interface Props { budgets: Budget[] }

export function BudgetAlerts({ budgets }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { lang } = useLang();
  const tx = appT[lang].dashboard.alerts;

  const alerts = budgets
    .filter((b) => {
      const pct = ((b.spent ?? 0) / b.amount) * 100;
      return pct >= 80 && !dismissed.has(b.id);
    })
    .map((b) => {
      const spent = b.spent ?? 0;
      const pct   = Math.round((spent / b.amount) * 100);
      return { ...b, spent, pct, over: pct >= 100 };
    });

  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div key={alert.id} className={cn(
          "flex items-start gap-3 rounded-xl border p-3.5 text-sm",
          alert.over ? "border-red-500/30 bg-red-500/8" : "border-amber-500/30 bg-amber-500/8"
        )}>
          {alert.over
            ? <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            : <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className={cn("font-medium", alert.over ? "text-red-300" : "text-amber-300")}>
              {alert.over ? tx.overTitle : tx.warnTitle} — {alert.category?.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {alert.over
                ? `${tx.over} ${formatCurrency(alert.spent - alert.amount)} ${tx.overSuffix} ${formatCurrency(alert.amount)}`
                : `${formatCurrency(alert.spent)} ${tx.used} ${formatCurrency(alert.amount)} ${tx.used2} (${alert.pct}%)`
              }
              {" · "}
              <Link href="/budgets" className="text-primary hover:underline">{tx.viewBudgets}</Link>
            </p>
          </div>
          <button onClick={() => setDismissed(p => new Set([...p, alert.id]))}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={tx.dismiss}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
