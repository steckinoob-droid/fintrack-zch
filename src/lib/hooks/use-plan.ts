"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function usePlan(): string | null {
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc("get_my_plan");
      setPlan((data as string | null) ?? "free");
    })();
  }, []);

  return plan;
}
