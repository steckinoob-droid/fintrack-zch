"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface RefreshCtx { version: number; refresh: () => void; }

const Ctx = createContext<RefreshCtx>({ version: 0, refresh: () => {} });

export function DashboardRefreshProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  return <Ctx.Provider value={{ version, refresh }}>{children}</Ctx.Provider>;
}

export function useDashboardRefresh() { return useContext(Ctx); }
