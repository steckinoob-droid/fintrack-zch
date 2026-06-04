"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils/cn";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string;
  }
>(({ className, value, indicatorClassName, style, ...props }, ref) => {
  const clamped = Math.min(100, Math.max(0, value ?? 0));

  // Extract --progress-color CSS var if passed via style
  const progressColor = (style as Record<string, string>)?.["--progress-color"];

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={clamped}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      style={style}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          !progressColor && (indicatorClassName ?? "bg-primary"),
          progressColor && indicatorClassName
        )}
        style={{
          width: `${clamped}%`,
          ...(progressColor ? { backgroundColor: progressColor } : {}),
        }}
      />
    </ProgressPrimitive.Root>
  );
});

Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
