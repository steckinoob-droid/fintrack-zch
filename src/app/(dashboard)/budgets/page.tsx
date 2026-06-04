import type { Metadata } from "next";
import { BudgetsClient } from "@/components/budgets/budgets-client";

export const metadata: Metadata = { title: "Orçamentos" };

export default function BudgetsPage() {
  return <BudgetsClient />;
}
