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
  error: "border-red-500/30 bg-red-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
};

const iconStyles = {
  default: "text-muted-foreground",
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-amber-400",
};

export function Toaster() {
  const { toasts, add, dismiss, addListener } = useToastState();

  useEffect(() => {
    return addListener(add);
  }, [add, addListener]);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 lg:bottom-4 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => {
        const Icon = icons[t.variant ?? "default"];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-sm animate-slide-up",
              styles[t.variant ?? "default"]
            )}
          >
            <Icon size={18} className={cn("mt-0.5 shrink-0", iconStyles[t.variant ?? "default"])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
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
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
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
