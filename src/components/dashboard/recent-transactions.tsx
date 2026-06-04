"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import { cn } from "@/lib/utils/cn";

interface Props { transactions: Transaction[] }

export function RecentTransactions({ transactions }: Props) {
  const { lang } = useLang();
  const tx = appT[lang].dashboard;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">{tx.recentTx}</h3>
          <p className="text-xs text-muted-foreground">{tx.latestMovements}</p>
        </div>
        <Link href="/transactions" className="text-xs text-primary hover:underline font-medium">
          {tx.viewAll}
        </Link>
      </div>

      {transactions.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title={tx.noTransactions} description={tx.noTransactionsDesc} />
      ) : (
        <div className="space-y-1">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors group">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                t.type === "income" ? "bg-emerald-500/10" : "bg-red-500/10"
              )}>
                {t.type === "income"
                  ? <ArrowUpRight size={16} className="text-emerald-400" />
                  : <ArrowDownRight size={16} className="text-red-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t.category?.name ?? appT[lang].common.noCategory} · {formatDate(t.date)}
                </p>
              </div>
              <span className={cn("text-sm font-semibold tabular-nums shrink-0",
                t.type === "income" ? "text-emerald-400" : "text-red-400"
              )}>
                {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
