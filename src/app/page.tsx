import type { Metadata } from "next";
import { LandingClient } from "@/components/landing/landing-client";

export const metadata: Metadata = {
  title: "FinTrack — Stop Guessing Where Your Money Goes",
  description:
    "FinTrack organizes your income, expenses, and savings goals in one visual dashboard. See everything in seconds — no spreadsheets, no confusion, no surprises.",
  openGraph: {
    title: "FinTrack — Stop Guessing Where Your Money Goes",
    description: "Organize your income, expenses, and savings goals in one visual dashboard.",
    type: "website",
    locale: "en_US",
    siteName: "FinTrack",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinTrack — Stop Guessing Where Your Money Goes",
    description: "Organize your income, expenses, and savings goals in one visual dashboard.",
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LandingClient />;
}
