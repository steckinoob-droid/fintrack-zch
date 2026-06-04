import type { Metadata } from "next";
import { GoalsClient } from "@/components/goals/goals-client";

export const metadata: Metadata = { title: "Metas de Poupança" };

export default function GoalsPage() {
  return <GoalsClient />;
}
