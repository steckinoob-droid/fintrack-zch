import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PricingClient } from "@/components/pricing/pricing-client";

export const metadata: Metadata = { title: "Planos — FinTrack" };

export default async function PricingPage() {
  let currentPlan = "free";
  let isLoggedIn  = false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      isLoggedIn = true;
      const { data } = await supabase.rpc("get_my_plan");
      currentPlan = (data as string | null) ?? "free";
    }
  } catch {
    // unauthenticated or session error — show default pricing
  }

  return <PricingClient currentPlan={currentPlan} isLoggedIn={isLoggedIn} />;
}
