"use client";

import { useEffect } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useToastState, toast } from "@/lib/hooks/use-toast";

const icons = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const styles = {
  default: "border-border bg-card",
  success: "border-emerald-500/30 bg-emerald-500/10",
  error:   "border-red-500/30 bg-red-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
};

const iconStyles = {
  default: "text-muted-foreground",
  success: "text-emerald-400",
  error:   "text-red-400",
  warning: "text-amber-400",
};

export function Toaster() {
  const { toasts, add, dismiss, addListener } = useToastState();

  useEffect(() => {
    return addListener(add);
  }, [add, addListener]);

  return (
    /**
     * Mobile fix: the old "right-4 w-full" caused a negative left edge on screens
     * narrower than ~400px (e.g. 375px: left = 375 - 16 - 375 = -16px overflow).
     *
     * Fix: use inset-x-4 (left-4 right-4, auto width) on mobile so the toast
     * stretches edge-to-edge with 16px padding on both sides.
     * On desktop (lg+) we revert to the classic anchored-bottom-right pattern.
     *
     * Bottom offset accounts for the mobile bottom-nav (~56px) + FAB (~16px gap)
     * + safe-area-inset-bottom so the toast is never hidden under the home bar.
     */
    <div
      aria-live="polite"
      className={cn(
        "fixed z-[90] flex flex-col gap-2 pointer-events-none",
        // Mobile: full-width between left/right gutters, above bottom nav + FAB
        // bottom-24 (96px) clears the nav (~56px) + FAB area + safe-area buffer
        "left-4 right-4 bottom-24",
        // Desktop: anchored bottom-right with fixed max-width
        "lg:left-auto lg:right-4 lg:bottom-4 lg:w-80"
      )}
    >
      {toasts.map((t) => {
        const Icon = icons[t.variant ?? "default"];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4",
              "shadow-xl backdrop-blur-sm animate-slide-up",
              styles[t.variant ?? "default"]
            )}
          >
            <Icon size={18} className={cn("mt-0.5 shrink-0", iconStyles[t.variant ?? "default"])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.description}</p>
              )}
            </div>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                className="shrink-0 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
              aria-label="Fechar notificação"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
