"use client";

import { useState, useEffect } from "react";
import { Download, X, Share, Monitor, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) return "ios";
  const isAndroid = /Android/.test(ua);
  if (isAndroid) return "android";
  return "desktop";
}

export function PwaInstallButton({ variant = "sidebar" }: { variant?: "sidebar" | "banner" }) {
  const [prompt, setPrompt]             = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform]         = useState<Platform>("unknown");
  const [installed, setInstalled]       = useState(false);
  const [dismissed, setDismissed]       = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [mounted, setMounted]           = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    if (sessionStorage.getItem("pwa-dismissed")) {
      setDismissed(true);
      return;
    }

    setPlatform(detectPlatform());

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Don't render during SSR or if already installed
  if (!mounted || installed) return null;

  // Banner variant: only show on mobile (android/ios)
  if (variant === "banner") {
    if (dismissed) return null;
    if (platform !== "android" && platform !== "ios") return null;

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
              onClick={() => {
                if (platform === "android" && prompt) {
                  prompt.prompt();
                  prompt.userChoice.then(({ outcome }) => {
                    if (outcome === "accepted") { setInstalled(true); setPrompt(null); }
                  });
                } else {
                  setShowModal(true);
                }
              }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
            >
              Instalar
            </button>
            <button
              onClick={() => { sessionStorage.setItem("pwa-dismissed", "1"); setDismissed(true); }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {showModal && (
          platform === "ios"
            ? <IOSModal onClose={() => setShowModal(false)} />
            : <AndroidManualModal onClose={() => setShowModal(false)} />
        )}
      </>
    );
  }

  // ── SIDEBAR variant (desktop + always visible) ──────────────────────────────
  if (dismissed) return null;

  return (
    <>
      <button
        onClick={() => {
          if (prompt) {
            prompt.prompt();
            prompt.userChoice.then(({ outcome }) => {
              if (outcome === "accepted") { setInstalled(true); setPrompt(null); }
            });
          } else {
            setShowModal(true);
          }
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                   bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
      >
        <Download size={16} />
        Instalar como app
      </button>

      {showModal && (
        platform === "ios"
          ? <IOSModal onClose={() => setShowModal(false)} />
          : platform === "android"
            ? <AndroidManualModal onClose={() => setShowModal(false)} />
            : <DesktopModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

/* ── Modals ──────────────────────────────────────────────────────────────────── */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-border/50 p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function IOSModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Instalar no iPhone / iPad" onClose={onClose}>
      <ol className="space-y-3 text-sm text-muted-foreground">
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
          <span>Abra o site no <span className="text-foreground font-medium">Safari</span> (não funciona no Chrome/Firefox do iOS)</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
          <span>Toque em <span className="inline-flex items-center gap-0.5 text-foreground font-medium"><Share size={13} className="text-blue-400" /> Compartilhar</span> na barra do Safari</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
          <span>Role para baixo e toque em <span className="text-foreground font-medium">"Adicionar à Tela de Início"</span></span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
          <span>Toque em <span className="text-foreground font-medium">"Adicionar"</span> no canto superior direito</span>
        </li>
      </ol>
    </ModalShell>
  );
}

function AndroidManualModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Instalar no Android" onClose={onClose}>
      <ol className="space-y-3 text-sm text-muted-foreground">
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
          <span>No Chrome, toque nos <span className="text-foreground font-medium">3 pontos ⋮</span> no canto superior direito</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
          <span>Toque em <span className="text-foreground font-medium">"Adicionar à tela inicial"</span> ou <span className="text-foreground font-medium">"Instalar app"</span></span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
          <span>Confirme tocando em <span className="text-foreground font-medium">"Instalar"</span> ou <span className="text-foreground font-medium">"Adicionar"</span></span>
        </li>
      </ol>
      <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        💡 Precisa estar usando o <span className="font-medium text-foreground">Chrome</span> ou <span className="font-medium text-foreground">Samsung Internet</span>
      </p>
    </ModalShell>
  );
}

function DesktopModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Instalar no computador" onClose={onClose}>
      <ol className="space-y-3 text-sm text-muted-foreground">
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
          <span>No Chrome, olhe para o <span className="text-foreground font-medium">ícone de computador ⊕</span> no canto direito da barra de endereços</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
          <span>Clique nesse ícone e depois em <span className="text-foreground font-medium">"Instalar"</span></span>
        </li>
      </ol>
      <div className="rounded-xl bg-muted/20 border border-border/40 p-3 text-center">
        <Monitor size={28} className="mx-auto mb-1.5 text-primary" />
        <p className="text-xs text-muted-foreground leading-snug">
          Se o ícone não aparecer, recarregue a página e aguarde alguns segundos
        </p>
      </div>
      <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
        ⚠️ Funciona no <span className="font-medium text-foreground">Google Chrome</span> ou <span className="font-medium text-foreground">Microsoft Edge</span>. No Firefox não há suporte a instalação de PWA.
      </p>
    </ModalShell>
  );
}
