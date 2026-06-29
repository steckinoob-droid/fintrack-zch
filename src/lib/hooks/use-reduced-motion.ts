"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * SSR-safe `prefers-reduced-motion` detector.
 *
 * Returns `false` on the server and first client render (so initial markup is
 * stable and hydration-safe), then syncs to the real media-query value after
 * mount and updates live when the OS setting changes.
 *
 * Use it to gate JS-driven animations that a CSS media query can't reach —
 * e.g. Recharts `isAnimationActive`.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
