import type { Metadata } from "next";
import { TransactionsClient } from "@/components/transactions/transactions-client";

export const metadata: Metadata = { title: "Transações" };

export default function TransactionsPage() {
  return <TransactionsClient />;
}
