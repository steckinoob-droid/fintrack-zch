"use client";

import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallButton({ variant = "sidebar" }: { variant?: "sidebar" | "banner" }) {
  const [prompt, setPrompt]           = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS]             = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installed, setInstalled]     = useState(false);
  const [dismissed, setDismissed]     = useState(false);

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    // Dismissed before
    if (sessionStorage.getItem("pwa-dismissed")) {
      setDismissed(true);
      return;
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Hide if installed or no install path available
  if (installed || dismissed) return null;
  if (!prompt && !isIOS) return null;

  async function handleInstall() {
    if (isIOS) { setShowIOSModal(true); return; }
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") { setInstalled(true); setPrompt(null); }
  }

  function handleDismiss() {
    sessionStorage.setItem("pwa-dismissed", "1");
    setDismissed(true);
  }

  // ── SIDEBAR variant (desktop left nav) ──────────────────────────────────────
  if (variant === "sidebar") {
    return (
      <>
        <button
          onClick={handleInstall}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
        >
          <Download size={16} />
          Instalar como app
        </button>

        {showIOSModal && <IOSModal onClose={() => setShowIOSModal(false)} />}
      </>
    );
  }

  // ── BANNER variant (mobile, above bottom nav) ────────────────────────────────
  return (
    <>
      <div className="lg:hidden fixed bottom-[57px] left-0 right-0 z-40 px-3 pb-2">
        <div className="flex items-center gap-3 rounded-2xl bg-card border border-primary/30 shadow-xl px-4 py-3">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Download size={17} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Instalar o FinTrack</p>
            <p className="text-xs text-muted-foreground">Acesse sem abrir o navegador</p>
          </div>
          <button
            onClick={handleInstall}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
          >
            Instalar
          </button>
          <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
      </div>

      {showIOSModal && <IOSModal onClose={() => setShowIOSModal(false)} />}
    </>
  );
}

function IOSModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border/50 p-5 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Instalar no iPhone / iPad</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>Toque em <span className="inline-flex items-center gap-0.5 text-foreground font-medium">
              <Share size={13} className="text-blue-400" /> Compartilhar
            </span> na barra do Safari</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>Role para baixo e toque em <span className="text-foreground font-medium">"Adicionar à Tela de Início"</span></span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>Toque em <span className="text-foreground font-medium">"Adicionar"</span> no canto superior direito</span>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          ⚠️ Precisa estar no <span className="font-medium text-foreground">Safari</span> — não funciona no Chrome do iOS.
        </p>
      </div>
    </div>
  );
}
