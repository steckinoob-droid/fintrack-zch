import { cn } from "@/lib/utils/cn";
import { TrendingUp } from "lucide-react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: 16, text: "text-base", container: "h-7 w-7" },
    md: { icon: 18, text: "text-lg", container: "h-8 w-8" },
    lg: { icon: 22, text: "text-2xl", container: "h-10 w-10" },
  };
  const s = sizes[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn(
        "rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20",
        s.container
      )}>
        <TrendingUp size={s.icon} className="text-white" strokeWidth={2.5} />
      </div>
      {showText && (
        <span className={cn("font-display font-bold tracking-tight text-foreground", s.text)}>
          Fin<span className="text-emerald-400">Track</span>
        </span>
      )}
    </div>
  );
}
