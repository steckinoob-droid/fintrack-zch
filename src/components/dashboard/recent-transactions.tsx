"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props { transactions: Transaction[] }

export function RecentTransactions({ transactions }: Props) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm">Transações Recentes</h3>
          <p className="text-xs text-muted-foreground">Últimas movimentações</p>
        </div>
        <Link href="/transactions" className="text-xs text-primary hover:underline font-medium">
          Ver todas
        </Link>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhuma transação"
          description="Adicione sua primeira transação para começar."
        />
      ) : (
        <div className="space-y-1">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  tx.type === "income" ? "bg-emerald-500/10" : "bg-red-500/10"
                )}
                style={tx.category ? { backgroundColor: tx.category.color + "18" } : {}}
              >
                {tx.type === "income"
                  ? <ArrowUpRight size={16} className="text-emerald-400" />
                  : <ArrowDownRight size={16} className="text-red-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{tx.title}</p>
                <p className="text-xs text-muted-foreground">
                  {tx.category?.name ?? "Sem categoria"} · {formatDate(tx.date)}
                </p>
              </div>
              <span className={cn(
                "text-sm font-semibold tabular-nums shrink-0",
                tx.type === "income" ? "text-emerald-400" : "text-red-400"
              )}>
                {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
