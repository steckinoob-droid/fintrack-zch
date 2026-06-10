import type { Metadata } from "next";
import dynamic from "next/dynamic";

const ReportsClient = dynamic(
  () => import("@/components/reports/reports-client").then((m) => m.ReportsClient),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-muted/40" />
        <div className="h-64 rounded-xl bg-muted/40" />
        <div className="h-64 rounded-xl bg-muted/40" />
      </div>
    ),
  }
);

export const metadata: Metadata = { title: "Relatórios" };

export default function ReportsPage() {
  return <ReportsClient />;
}
