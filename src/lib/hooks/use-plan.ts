"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Minimum interval between refetches — prevents spam on rapid tab switches.
const REFETCH_DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes

export function usePlan(): string | null {
  const [plan, setPlan]     = useState<string | null>(null);
  const lastFetchRef        = useRef<number>(0);

  useEffect(() => {
    let active = true;

    async function fetchPlan(force = false) {
      const now = Date.now();
      if (!force && now - lastFetchRef.current < REFETCH_DEBOUNCE_MS) return;
      lastFetchRef.current = now;

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Authenticated users reach the dashboard via the server-side guard.
          // If the browser client sees no session (stale cookie, timing), default
          // to "free" so the component never gets stuck in skeleton-forever.
          if (active) setPlan("free");
          return;
        }
        const { data } = await supabase.rpc("get_my_plan");
        if (active) setPlan((data as string | null) ?? "free");
      } catch {
        if (active) setPlan("free");
      }
    }

    // Initial load — skip debounce so plan resolves immediately.
    fetchPlan(true);

    // Revalidate when the tab comes back into focus (e.g., user granted Pro while
    // the app was backgrounded). Debounce prevents back-to-back fetches.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") fetchPlan();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return plan;
}
