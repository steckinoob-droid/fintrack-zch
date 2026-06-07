import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Offline | FinTrack",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 h-20 w-20 rounded-2xl bg-muted/30 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <line x1="2" y1="2" x2="22" y2="22" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
          <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
          <path d="M5 13a10 10 0 0 1 5.24-2.76" />
          <circle cx="12" cy="20" r="1" />
        </svg>
      </div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-2">Sem conexão</h1>
      <p className="text-muted-foreground text-sm max-w-xs mb-2">
        Você está offline. Verifique sua conexão com a internet e tente novamente.
      </p>
      <p className="text-muted-foreground text-xs max-w-xs mb-6">
        No connection. Check your internet and try again.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 text-primary px-5 py-2.5 text-sm font-medium hover:bg-primary/20 transition-colors"
      >
        Tentar novamente · Try again
      </Link>
    </div>
  );
}
