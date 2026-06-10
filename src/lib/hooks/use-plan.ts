"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function usePlan(): string | null {
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
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
    })();
    return () => { active = false; };
  }, []);

  return plan;
}
