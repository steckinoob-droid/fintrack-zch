"use client";

import { useState, useEffect } from "react";
import { Download, X, Share, Monitor } from "lucide-react";
import { useLang } from "@/lib/i18n/context";

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
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function PwaInstallButton({ variant = "sidebar" }: { variant?: "sidebar" | "banner" | "header" }) {
  const { lang } = useLang();
  const [prompt, setPrompt]       = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform]   = useState<Platform>("unknown");
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia("(display-mode: standalone)").matches) { setInstalled(true); return; }
    if (sessionStorage.getItem("pwa-dismissed")) { setDismissed(true); return; }
    setPlatform(detectPlatform());
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!mounted || installed) return null;

  const installLabel  = lang === "en" ? "Install as app"         : "Instalar como app";
  const installAria   = lang === "en" ? "Install app"            : "Instalar como app";
  const bannerTitle   = lang === "en" ? "Install FinTrack"       : "Instalar o FinTrack";
  const bannerSubtitle = lang === "en" ? "Open without a browser" : "Acesse sem abrir o navegador";
  const installBtn    = lang === "en" ? "Install"                : "Instalar";

  function handleInstallClick() {
    if (platform === "android" && prompt) {
      prompt.prompt();
      prompt.userChoice.then(({ outcome }) => {
        if (outcome === "accepted") { setInstalled(true); setPrompt(null); }
      });
    } else {
      setShowModal(true);
    }
  }

  // ── HEADER variant ─────────────────────────────────────────────────────────
  if (variant === "header") {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label={installAria}
          title={installAria}
        >
          <Download size={17} />
        </button>
        {showModal && (
          platform === "ios"
            ? <IOSModal lang={lang} onClose={() => setShowModal(false)} />
            : platform === "android"
            ? <AndroidManualModal lang={lang} onClose={() => setShowModal(false)} />
            : <DesktopModal lang={lang} onClose={() => setShowModal(false)} />
        )}
      </>
    );
  }

  // ── BANNER variant — mobile only ────────────────────────────────────────────
  if (variant === "banner") {
    if (dismissed || (platform !== "android" && platform !== "ios")) return null;
    return (
      <>
        <div className="lg:hidden fixed left-0 right-0 z-40 px-3 pb-2" style={{ bottom: "calc(57px + env(safe-area-inset-bottom, 0px))" }}>
          <div className="flex items-center gap-3 rounded-2xl bg-card border border-primary/30 shadow-xl px-4 py-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Download size={17} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{bannerTitle}</p>
              <p className="text-xs text-muted-foreground">{bannerSubtitle}</p>
            </div>
            <button onClick={handleInstallClick}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
              {installBtn}
            </button>
            <button
              onClick={() => { sessionStorage.setItem("pwa-dismissed", "1"); setDismissed(true); }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={lang === "en" ? "Dismiss" : "Fechar"}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {showModal && (
          platform === "ios"
            ? <IOSModal lang={lang} onClose={() => setShowModal(false)} />
            : <AndroidManualModal lang={lang} onClose={() => setShowModal(false)} />
        )}
      </>
    );
  }

  // ── SIDEBAR variant ─────────────────────────────────────────────────────────
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
          } else { setShowModal(true); }
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                   bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
      >
        <Download size={16} />
        {installLabel}
      </button>
      {showModal && (
        platform === "ios"
          ? <IOSModal lang={lang} onClose={() => setShowModal(false)} />
          : platform === "android"
          ? <AndroidManualModal lang={lang} onClose={() => setShowModal(false)} />
          : <DesktopModal lang={lang} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

/* ── Shared modal shell ────────────────────────────────────────────────────── */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border/50 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </li>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <span className="text-foreground font-medium">{children}</span>;
}

function IOSModal({ lang, onClose }: { lang: string; onClose: () => void }) {
  const isEn = lang === "en";
  return (
    <ModalShell title={isEn ? "Install on iPhone / iPad" : "Instalar no iPhone / iPad"} onClose={onClose}>
      <ol className="space-y-3">
        <Step n={1}>
          {isEn ? <>Open this site in <Em>Safari</Em> (Chrome/Firefox on iOS don't support PWA install)</> : <>Abra o site no <Em>Safari</Em> (não funciona no Chrome/Firefox do iOS)</>}
        </Step>
        <Step n={2}>
          {isEn ? <>Tap the <Em><Share size={13} className="inline" /> Share</Em> button in the Safari toolbar</> : <>Toque em <Em><Share size={13} className="inline text-blue-400" /> Compartilhar</Em> na barra do Safari</>}
        </Step>
        <Step n={3}>
          {isEn ? <>Scroll down and tap <Em>"Add to Home Screen"</Em></> : <>Role para baixo e toque em <Em>"Adicionar à Tela de Início"</Em></>}
        </Step>
        <Step n={4}>
          {isEn ? <>Tap <Em>"Add"</Em> in the top-right corner</> : <>Toque em <Em>"Adicionar"</Em> no canto superior direito</>}
        </Step>
      </ol>
    </ModalShell>
  );
}

function AndroidManualModal({ lang, onClose }: { lang: string; onClose: () => void }) {
  const isEn = lang === "en";
  return (
    <ModalShell title={isEn ? "Install on Android" : "Instalar no Android"} onClose={onClose}>
      <ol className="space-y-3">
        <Step n={1}>
          {isEn ? <>In Chrome, tap the <Em>⋮ three-dot menu</Em> in the top-right</> : <>No Chrome, toque nos <Em>3 pontos ⋮</Em> no canto superior direito</>}
        </Step>
        <Step n={2}>
          {isEn ? <>Tap <Em>"Add to Home Screen"</Em> or <Em>"Install app"</Em></> : <>Toque em <Em>"Adicionar à tela inicial"</Em> ou <Em>"Instalar app"</Em></>}
        </Step>
        <Step n={3}>
          {isEn ? <>Confirm by tapping <Em>"Install"</Em> or <Em>"Add"</Em></> : <>Confirme tocando em <Em>"Instalar"</Em> ou <Em>"Adicionar"</Em></>}
        </Step>
      </ol>
      <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        {isEn
          ? <>💡 Requires <Em>Chrome</Em> or <Em>Samsung Internet</Em></>
          : <>💡 Precisa estar usando <Em>Chrome</Em> ou <Em>Samsung Internet</Em></>}
      </p>
    </ModalShell>
  );
}

function DesktopModal({ lang, onClose }: { lang: string; onClose: () => void }) {
  const isEn = lang === "en";
  return (
    <ModalShell title={isEn ? "Install on desktop" : "Instalar no computador"} onClose={onClose}>
      <ol className="space-y-3">
        <Step n={1}>
          {isEn ? <>In Chrome, look for the <Em>⊕ install icon</Em> on the right side of the address bar</> : <>No Chrome, olhe para o <Em>ícone ⊕</Em> no canto direito da barra de endereços</>}
        </Step>
        <Step n={2}>
          {isEn ? <>Click it and then click <Em>"Install"</Em></> : <>Clique nesse ícone e depois em <Em>"Instalar"</Em></>}
        </Step>
      </ol>
      <div className="rounded-xl bg-muted/20 border border-border/40 p-3 text-center">
        <Monitor size={28} className="mx-auto mb-1.5 text-primary" />
        <p className="text-xs text-muted-foreground leading-snug">
          {isEn
            ? "If the icon doesn't appear, refresh the page and wait a few seconds"
            : "Se o ícone não aparecer, recarregue a página e aguarde alguns segundos"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
        {isEn
          ? <>⚠️ Works in <Em>Google Chrome</Em> or <Em>Microsoft Edge</Em>. Firefox does not support PWA installation.</>
          : <>⚠️ Funciona no <Em>Google Chrome</Em> ou <Em>Microsoft Edge</Em>. No Firefox não há suporte a instalação de PWA.</>}
      </p>
    </ModalShell>
  );
}
