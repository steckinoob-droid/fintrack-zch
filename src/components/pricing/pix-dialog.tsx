"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Clock, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface PixPaymentData {
  payment_id: number;
  qr_code: string;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expires_at: string;
}

interface PixDialogTx {
  title: string;
  instruction: string;
  orCopy: string;
  copy: string;
  copied: string;
  expiresIn: string;
  openApp: string;
  notice: string;
  generatingQr: string;
  error: string;
  checking: string;
  success: string;
  successDesc: string;
  refreshPage: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: PixPaymentData | null;
  loading: boolean;
  tx: PixDialogTx;
}

export function PixDialog({ open, onClose, data, loading, tx }: Props) {
  const [copied,       setCopied]       = useState(false);
  const [proActivated, setProActivated] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);

  // ── Polling: check payment status every 3 s once QR is visible ─────────────
  useEffect(() => {
    if (!open || !data || loading || proActivated) {
      clearInterval(intervalRef.current ?? undefined);
      clearTimeout(timeoutRef.current  ?? undefined);
      intervalRef.current = null;
      return;
    }

    async function checkStatus() {
      if (!data) return;
      try {
        const res = await fetch(`/api/billing/pix/status?payment_id=${data.payment_id}`);
        if (!res.ok) return;
        const json = await res.json() as { isPro?: boolean };
        if (json.isPro) {
          setProActivated(true);
          clearInterval(intervalRef.current ?? undefined);
          clearTimeout(timeoutRef.current  ?? undefined);
        }
      } catch {
        // keep polling silently
      }
    }

    intervalRef.current = setInterval(checkStatus, 3000);

    // Stop polling when the QR expires (or 25 min max, whichever is sooner)
    const expiresMs = new Date(data.expires_at).getTime() - Date.now();
    const stopAfter = Math.min(Math.max(expiresMs, 0), 25 * 60 * 1000);
    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current ?? undefined);
      intervalRef.current = null;
    }, stopAfter);

    return () => {
      clearInterval(intervalRef.current ?? undefined);
      clearTimeout(timeoutRef.current  ?? undefined);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, loading, proActivated]);

  // Reset success state when dialog closes
  useEffect(() => {
    if (!open) setProActivated(false);
  }, [open]);

  // ── Copy ────────────────────────────────────────────────────────────────────
  async function handleCopy() {
    if (!data?.qr_code) return;
    try {
      await navigator.clipboard.writeText(data.qr_code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = data.qr_code;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const qrSrc = data?.qr_code_base64
    ? data.qr_code_base64.startsWith("data:")
      ? data.qr_code_base64
      : `data:image/png;base64,${data.qr_code_base64}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl border border-border/50 bg-card">
        {/* Accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="p-6 space-y-5">

          {/* ── Success state ─────────────────────────────────────────────── */}
          {proActivated ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div className="space-y-1">
                <p className="font-display font-bold text-lg text-foreground">
                  {tx.success}
                </p>
                <p className="text-sm text-muted-foreground">{tx.successDesc}</p>
              </div>
              <Button
                size="sm"
                onClick={() => window.location.reload()}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
              >
                {tx.refreshPage}
              </Button>
            </div>

          ) : (
            <>
              {/* ── Header ──────────────────────────────────────────────── */}
              <DialogHeader className="space-y-1">
                <DialogTitle className="font-display text-lg font-bold text-foreground">
                  {tx.title}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">{tx.instruction}</p>
              </DialogHeader>

              {/* ── Loading state ────────────────────────────────────────── */}
              {loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <Loader2 size={28} className="animate-spin text-primary/60" />
                  <p className="text-sm text-muted-foreground">{tx.generatingQr}</p>
                </div>
              )}

              {/* ── QR content ──────────────────────────────────────────── */}
              {!loading && data && (
                <div className="space-y-4">
                  {/* QR image */}
                  {qrSrc && (
                    <div className="flex justify-center">
                      <div className="rounded-xl border border-border/40 bg-white p-3 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrSrc}
                          alt="Pix QR Code"
                          width={200}
                          height={200}
                          className="block"
                        />
                      </div>
                    </div>
                  )}

                  {/* Copy code */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{tx.orCopy}</p>
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                        <p className="text-xs font-mono text-foreground/70 truncate select-all">
                          {data.qr_code}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopy}
                        className={cn(
                          "shrink-0 gap-1.5 transition-all",
                          copied && "border-primary/40 text-primary bg-primary/8",
                        )}
                      >
                        {copied
                          ? <><Check size={13} />{tx.copied}</>
                          : <><Copy size={13} />{tx.copy}</>}
                      </Button>
                    </div>
                  </div>

                  {/* Mobile: open in bank app */}
                  {data.ticket_url && (
                    <a
                      href={data.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full rounded-xl border border-primary/30 bg-primary/8 py-2.5 text-sm font-medium text-primary hover:bg-primary/15 transition-colors"
                    >
                      <ExternalLink size={14} />
                      {tx.openApp}
                    </a>
                  )}

                  {/* Expiry + notice */}
                  <div className="flex items-start gap-2 rounded-xl bg-muted/20 border border-border/30 px-3.5 py-3">
                    <Clock size={13} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>{tx.expiresIn}</p>
                      <p className="text-foreground/70">{tx.notice}</p>
                    </div>
                  </div>

                  {/* Polling indicator */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
                    <Loader2 size={10} className="animate-spin" />
                    <span>{tx.checking}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
