"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, UserCheck, UserX, RefreshCw, CheckCircle2,
  AlertCircle, Loader2, Clock, Infinity, QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n/context";
import { appT } from "@/lib/i18n/app";
import type { AdminGrant } from "@/app/api/admin/grants/route";

interface Props {
  adminEmail: string;
}

type GrantStatus = null | "loading" | "success" | "error";
type RevokeStep  = null | "confirming" | "loading" | "success" | "error";

type Duration        = "30d" | "1y" | "lifetime";
type ReconcileStatus = null | "loading" | "success" | "not_approved" | "not_found" | "error";
type SearchStatus    = null | "loading" | "found" | "not_found" | "no_payments" | "error";

interface ReconcileResult {
  userId?:        string;
  mpStatus?:      string;
  expiresAt?:     string | null;
  grantExtended?: boolean;
  detail?:        string;
}

interface PixPaymentRow {
  mp_payment_id: string;
  status:        string;
  amount:        number;
  currency:      string;
  created_at:    string;
}

function formatDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function getGrantStatus(g: AdminGrant): "active" | "expired" | "revoked" | "lifetime" {
  if (g.revoked_at) return "revoked";
  if (!g.expires_at) return "lifetime";
  if (new Date(g.expires_at) < new Date()) return "expired";
  return "active";
}

export function AdminClient({ adminEmail }: Props) {
  const { lang } = useLang();
  const tx = appT[lang].admin;

  // ── Grant form ─────────────────────────────────────────────────────────────
  const [grantEmail,    setGrantEmail]    = useState("");
  const [grantDuration, setGrantDuration] = useState<Duration>("30d");
  const [grantReason,   setGrantReason]   = useState("");
  const [grantStatus,   setGrantStatus]   = useState<GrantStatus>(null);
  const [grantMsg,      setGrantMsg]      = useState("");

  // ── Revoke form ────────────────────────────────────────────────────────────
  const [revokeEmail,  setRevokeEmail]  = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeStep,   setRevokeStep]   = useState<RevokeStep>(null);
  const [revokeMsg,    setRevokeMsg]    = useState("");

  // ── Reconcile Pix form ────────────────────────────────────────────────────
  const [searchEmail,    setSearchEmail]    = useState("");
  const [searchStatus,   setSearchStatus]   = useState<SearchStatus>(null);
  const [searchPayments, setSearchPayments] = useState<PixPaymentRow[]>([]);

  const [reconcileId,     setReconcileId]     = useState("");
  const [reconcileStatus, setReconcileStatus] = useState<ReconcileStatus>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);

  // ── Grants list ────────────────────────────────────────────────────────────
  const [grants,        setGrants]       = useState<AdminGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);

  const loadGrants = useCallback(async () => {
    setGrantsLoading(true);
    try {
      const res  = await fetch("/api/admin/grants");
      const json = await res.json() as { grants?: AdminGrant[] };
      setGrants(json.grants ?? []);
    } catch {
      // silent — user can refresh manually
    } finally {
      setGrantsLoading(false);
    }
  }, []);

  useEffect(() => { loadGrants(); }, [loadGrants]);

  // ── Search Pix payments by email ──────────────────────────────────────────
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearchStatus("loading");
    setSearchPayments([]);
    try {
      const res  = await fetch(`/api/admin/reconcile-pix?email=${encodeURIComponent(searchEmail.trim())}`);
      const json = await res.json() as {
        error?: string; userId?: string;
        payments?: PixPaymentRow[];
      };
      if (!res.ok) {
        setSearchStatus(json.error === "user_not_found" ? "not_found" : "error");
        return;
      }
      const list = json.payments ?? [];
      if (list.length === 0) { setSearchStatus("no_payments"); return; }
      setSearchPayments(list);
      setSearchStatus("found");
    } catch {
      setSearchStatus("error");
    }
  }

  // ── Reconcile Pix submit ───────────────────────────────────────────────────
  async function handleReconcile(e: React.FormEvent) {
    e.preventDefault();
    if (!reconcileId.trim()) return;
    setReconcileStatus("loading");
    setReconcileResult(null);
    try {
      const res  = await fetch("/api/admin/reconcile-pix", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mp_payment_id: reconcileId.trim() }),
      });
      const json = await res.json() as {
        ok?: boolean; error?: string; detail?: string; message?: string;
        userId?: string; mpStatus?: string; expiresAt?: string | null; grantExtended?: boolean;
      };

      if (!res.ok) {
        if (json.error === "payment_not_found") {
          setReconcileStatus("not_found");
        } else {
          setReconcileStatus("error");
          setReconcileResult({ detail: json.detail ?? json.error ?? "unknown" });
        }
        return;
      }

      if (!json.ok) {
        setReconcileStatus("not_approved");
        setReconcileResult({ mpStatus: json.mpStatus });
        return;
      }

      setReconcileStatus("success");
      setReconcileResult({
        userId:        json.userId,
        mpStatus:      json.mpStatus,
        expiresAt:     json.expiresAt ?? null,
        grantExtended: json.grantExtended,
      });
      void loadGrants();
    } catch {
      setReconcileStatus("error");
      setReconcileResult({ detail: "Network error" });
    }
  }

  // ── Grant submit ───────────────────────────────────────────────────────────
  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!grantEmail.trim()) return;
    setGrantStatus("loading");
    setGrantMsg("");
    try {
      const res  = await fetch("/api/admin/grant-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: grantEmail.trim(), duration: grantDuration, reason: grantReason.trim() }),
      });
      const json = await res.json() as {
        ok?: boolean; error?: string;
        expires_at?: string | null; email?: string;
      };

      if (!res.ok) {
        setGrantStatus("error");
        if (json.error === "user_not_found")       setGrantMsg(tx.errorUserNotFound);
        else if (json.error === "already_pro")     setGrantMsg(tx.errorAlreadyPro.replace("{date}", formatDate(json.expires_at, lang)));
        else if (json.error === "already_pro_lifetime") setGrantMsg(tx.errorAlreadyProLifetime);
        else if (json.error === "forbidden")       setGrantMsg(tx.errorForbidden);
        else if (json.error === "email_required")  setGrantMsg(tx.errorEmailRequired);
        else                                       setGrantMsg(tx.errorInternal);
        return;
      }

      setGrantStatus("success");
      const msg = json.expires_at
        ? tx.successGrantDesc.replace("{email}", json.email ?? "").replace("{date}", formatDate(json.expires_at, lang))
        : tx.successGrantLifetime.replace("{email}", json.email ?? "");
      setGrantMsg(msg);
      setGrantEmail("");
      setGrantReason("");
      void loadGrants();
    } catch {
      setGrantStatus("error");
      setGrantMsg(tx.errorInternal);
    }
  }

  // ── Revoke: step 1 — validate + show confirmation ─────────────────────────
  function handleRevokeRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!revokeEmail.trim()) return;
    setRevokeStep("confirming");
    setRevokeMsg("");
  }

  // ── Revoke: step 2 — confirmed ────────────────────────────────────────────
  async function handleRevokeConfirm() {
    setRevokeStep("loading");
    try {
      const res  = await fetch("/api/admin/revoke-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: revokeEmail.trim(), reason: revokeReason.trim() }),
      });
      const json = await res.json() as {
        ok?: boolean; error?: string;
        revoked_count?: number; email?: string;
      };

      if (!res.ok) {
        setRevokeStep("error");
        if (json.error === "user_not_found")  setRevokeMsg(tx.errorUserNotFound);
        else if (json.error === "no_active_grant") setRevokeMsg(tx.errorNoGrant);
        else if (json.error === "forbidden")  setRevokeMsg(tx.errorForbidden);
        else if (json.error === "email_required") setRevokeMsg(tx.errorEmailRequired);
        else                                  setRevokeMsg(tx.errorInternal);
        return;
      }

      setRevokeStep("success");
      setRevokeMsg(
        tx.successRevokeDesc
          .replace("{n}", String(json.revoked_count ?? 1))
          .replace("{email}", json.email ?? revokeEmail.trim()),
      );
      setRevokeEmail("");
      setRevokeReason("");
      void loadGrants();
    } catch {
      setRevokeStep("error");
      setRevokeMsg(tx.errorInternal);
    }
  }

  // ── Status badge ───────────────────────────────────────────────────────────
  function StatusBadge({ grant }: { grant: AdminGrant }) {
    const s = getGrantStatus(grant);
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        s === "active"   && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
        s === "lifetime" && "bg-primary/15 text-primary border border-primary/25",
        s === "expired"  && "bg-muted/50 text-muted-foreground border border-border/30",
        s === "revoked"  && "bg-red-500/10 text-red-400 border border-red-500/20",
      )}>
        {s === "active"   && <><Clock size={9} />{tx.statusActive}</>}
        {s === "lifetime" && <><Infinity size={9} />{tx.statusLifetime}</>}
        {s === "expired"  && tx.statusExpired}
        {s === "revoked"  && tx.statusRevoked}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
          <Shield size={20} className="text-primary" />
        </span>
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">{tx.title}</h1>
          <p className="text-sm text-muted-foreground">{tx.description}</p>
        </div>
        <div className="ml-auto">
          <span className="text-xs text-muted-foreground bg-muted/30 border border-border/30 rounded-full px-3 py-1">
            {adminEmail}
          </span>
        </div>
      </div>

      {/* Top row: Grant + Revoke side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Grant Pro ─────────────────────────────────────────────────────── */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
              <UserCheck size={15} className="text-emerald-400" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{tx.grantTitle}</p>
              <p className="text-xs text-muted-foreground">{tx.grantSubtitle}</p>
            </div>
          </div>

          <form onSubmit={handleGrant} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tx.emailLabel}</Label>
              <Input
                type="email"
                placeholder={tx.emailPlaceholder}
                value={grantEmail}
                onChange={e => { setGrantEmail(e.target.value); setGrantStatus(null); }}
                disabled={grantStatus === "loading"}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{tx.durationLabel}</Label>
              <Select
                value={grantDuration}
                onValueChange={v => setGrantDuration(v as Duration)}
                disabled={grantStatus === "loading"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">{tx.duration30d}</SelectItem>
                  <SelectItem value="1y">{tx.duration1y}</SelectItem>
                  <SelectItem value="lifetime">{tx.durationLifetime}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{tx.reasonLabel}</Label>
              <textarea
                className={cn(
                  "flex w-full min-h-[72px] resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground shadow-sm",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                placeholder={tx.reasonPlaceholder}
                value={grantReason}
                onChange={e => setGrantReason(e.target.value)}
                disabled={grantStatus === "loading"}
              />
            </div>

            {/* Feedback */}
            {grantStatus === "success" && (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-xs text-emerald-400">
                <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                <span>{grantMsg}</span>
              </div>
            )}
            {grantStatus === "error" && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{grantMsg}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={grantStatus === "loading" || !grantEmail.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
            >
              {grantStatus === "loading"
                ? <><Loader2 size={14} className="animate-spin" />{tx.granting}</>
                : <><UserCheck size={14} />{tx.grantBtn}</>}
            </Button>
          </form>
        </div>

        {/* ── Revoke Pro ────────────────────────────────────────────────────── */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
              <UserX size={15} className="text-red-400" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{tx.revokeTitle}</p>
              <p className="text-xs text-muted-foreground">{tx.revokeSubtitle}</p>
            </div>
          </div>

          {/* Confirmation step */}
          {revokeStep === "confirming" ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-red-500/8 border border-red-500/20 px-3.5 py-3 text-xs text-red-300 space-y-1">
                <p className="font-semibold">{tx.revokeConfirmTitle}</p>
                <p className="text-red-400/80">{tx.revokeConfirmDesc}</p>
                <p className="font-mono text-red-300 bg-red-500/10 rounded px-2 py-1 mt-2 text-[11px] truncate">
                  {revokeEmail}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setRevokeStep(null)}
                >
                  {lang === "pt" ? "Cancelar" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                  onClick={handleRevokeConfirm}
                >
                  {tx.revokeConfirmBtn}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRevokeRequest} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{tx.emailLabel}</Label>
                <Input
                  type="email"
                  placeholder={tx.emailPlaceholder}
                  value={revokeEmail}
                  onChange={e => { setRevokeEmail(e.target.value); setRevokeStep(null); }}
                  disabled={revokeStep === "loading"}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{tx.revokeReasonLabel}</Label>
                <textarea
                  className={cn(
                    "flex w-full min-h-[72px] resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground shadow-sm",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  placeholder={tx.revokeReasonPlaceholder}
                  value={revokeReason}
                  onChange={e => setRevokeReason(e.target.value)}
                  disabled={revokeStep === "loading"}
                />
              </div>

              {/* Feedback */}
              {revokeStep === "success" && (
                <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-xs text-emerald-400">
                  <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                  <span>{revokeMsg}</span>
                </div>
              )}
              {revokeStep === "error" && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span>{revokeMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={revokeStep === "loading" || !revokeEmail.trim()}
                variant="outline"
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 gap-2"
              >
                {revokeStep === "loading"
                  ? <><Loader2 size={14} className="animate-spin" />{tx.revoking}</>
                  : <><UserX size={14} />{tx.revokeBtn}</>}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* ── Reconciliar Pix ───────────────────────────────────────────────── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
            <QrCode size={15} className="text-amber-400" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{tx.reconcileTitle}</p>
            <p className="text-xs text-muted-foreground">{tx.reconcileSubtitle}</p>
          </div>
        </div>

        {/* Step 1: search by email */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="email"
            className="flex-1"
            placeholder={tx.reconcileSearchPlaceholder}
            value={searchEmail}
            onChange={e => { setSearchEmail(e.target.value); setSearchStatus(null); setSearchPayments([]); }}
            disabled={searchStatus === "loading"}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={searchStatus === "loading" || !searchEmail.trim()}
            className="shrink-0 gap-1.5"
          >
            {searchStatus === "loading"
              ? <><Loader2 size={13} className="animate-spin" />{tx.reconcileSearching}</>
              : tx.reconcileSearchBtn}
          </Button>
        </form>

        {searchStatus === "not_found" && (
          <p className="text-xs text-muted-foreground">{tx.reconcileUserNotFound}</p>
        )}
        {searchStatus === "no_payments" && (
          <p className="text-xs text-muted-foreground">{tx.reconcileNoPayments}</p>
        )}

        {/* Payment list */}
        {searchStatus === "found" && searchPayments.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border/40">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  {[tx.reconcileColId, tx.reconcileColStatus, tx.reconcileColAmount, tx.reconcileColDate, ""].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searchPayments.map(p => (
                  <tr key={p.mp_payment_id} className={cn(
                    "border-b border-border/20 last:border-0",
                    reconcileId === p.mp_payment_id && "bg-amber-500/8",
                  )}>
                    <td className="px-3 py-2 font-mono text-foreground/80">{p.mp_payment_id}</td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                        p.status === "approved"  && "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
                        p.status === "pending"   && "bg-amber-500/15 text-amber-400 border-amber-500/25",
                        p.status === "rejected"  && "bg-red-500/10 text-red-400 border-red-500/20",
                        !["approved","pending","rejected"].includes(p.status) && "bg-muted/50 text-muted-foreground border-border/30",
                      )}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {p.currency} {p.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(p.created_at, lang)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => { setReconcileId(p.mp_payment_id); setReconcileStatus(null); setReconcileResult(null); }}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors",
                          reconcileId === p.mp_payment_id
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70",
                        )}
                      >
                        {tx.reconcileUse}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Step 2: reconcile by ID */}
        <form onSubmit={handleReconcile} className="flex gap-2">
          <Input
            className="flex-1 font-mono text-sm"
            placeholder={tx.reconcileIdPlaceholder}
            value={reconcileId}
            onChange={e => { setReconcileId(e.target.value); setReconcileStatus(null); setReconcileResult(null); }}
            disabled={reconcileStatus === "loading"}
          />
          <Button
            type="submit"
            disabled={reconcileStatus === "loading" || !reconcileId.trim()}
            className="shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-500 text-white"
          >
            {reconcileStatus === "loading"
              ? <><Loader2 size={14} className="animate-spin" />{tx.reconciling}</>
              : <><QrCode size={14} />{tx.reconcileBtn}</>}
          </Button>
        </form>

        {/* Success */}
        {reconcileStatus === "success" && reconcileResult && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-3 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 size={13} />
              {reconcileResult.grantExtended ? tx.reconcileSuccessExtend : tx.reconcileSuccessGrant}
            </div>
            <div className="space-y-0.5 font-mono text-muted-foreground">
              <p>userId: <span className="text-foreground/80 break-all">{reconcileResult.userId}</span></p>
              <p>mpStatus: <span className="text-emerald-400">{reconcileResult.mpStatus}</span></p>
              {reconcileResult.expiresAt && (
                <p>expiresAt: <span className="text-foreground/80">{formatDate(reconcileResult.expiresAt, lang)}</span></p>
              )}
            </div>
          </div>
        )}

        {/* Not approved */}
        {reconcileStatus === "not_approved" && reconcileResult && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3.5 py-3 text-xs text-amber-400">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{tx.reconcileNotApproved.replace("{status}", reconcileResult.mpStatus ?? "")}</span>
          </div>
        )}

        {/* Not found */}
        {reconcileStatus === "not_found" && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-3 text-xs text-red-400">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{tx.reconcileNotFound}</span>
          </div>
        )}

        {/* API / network error */}
        {reconcileStatus === "error" && reconcileResult && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-3 text-xs text-red-400">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{tx.reconcileApiError.replace("{detail}", reconcileResult.detail ?? "")}</span>
          </div>
        )}
      </div>

      {/* ── Recent Grants ──────────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <div>
            <p className="text-sm font-semibold text-foreground">{tx.grantsTitle}</p>
            <p className="text-xs text-muted-foreground">{tx.grantsSubtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadGrants}
            disabled={grantsLoading}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw size={12} className={cn(grantsLoading && "animate-spin")} />
            {lang === "pt" ? "Atualizar" : "Refresh"}
          </Button>
        </div>

        {grantsLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            {lang === "pt" ? "Carregando…" : "Loading…"}
          </div>
        ) : grants.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {tx.noGrants}
          </div>
        ) : (
          /* Scrollable table wrapper */
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  {[
                    tx.colUser, tx.colPlan, tx.colReason, tx.colGrantedBy,
                    tx.colDate, tx.colExpires, tx.colStatus,
                  ].map(col => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grants.map((g, i) => (
                  <tr
                    key={g.id}
                    className={cn(
                      "border-b border-border/20 transition-colors hover:bg-muted/10",
                      i % 2 === 0 && "bg-muted/5",
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-foreground/80 max-w-[180px] truncate">
                      {g.user_email}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold border border-primary/25">
                        {g.plan_id}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-[160px] truncate">
                      {g.reason ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-[150px] truncate">
                      {g.granted_by ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {formatDate(g.granted_at, lang)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {g.expires_at
                        ? <span className="text-muted-foreground">{formatDate(g.expires_at, lang)}</span>
                        : <span className="flex items-center gap-1 text-primary"><Infinity size={11} />{tx.never}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge grant={g} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
