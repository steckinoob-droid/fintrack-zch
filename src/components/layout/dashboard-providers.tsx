"use client";
import { DashboardRefreshProvider } from "@/lib/context/dashboard-refresh";

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return <DashboardRefreshProvider>{children}</DashboardRefreshProvider>;
}
