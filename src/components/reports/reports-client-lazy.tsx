"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/skeleton";

export const ReportsClientLazy = dynamic(
  () => import("./reports-client").then((m) => m.ReportsClient),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 rounded-lg bg-muted/40 animate-pulse" />
        <ChartSkeleton height={260} />
        <ChartSkeleton height={260} />
      </div>
    ),
  }
);
