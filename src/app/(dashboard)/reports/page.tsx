import type { Metadata } from "next";
import { ReportsClientLazy } from "@/components/reports/reports-client-lazy";

export const metadata: Metadata = { title: "Relatórios" };

export default function ReportsPage() {
  return <ReportsClientLazy />;
}
