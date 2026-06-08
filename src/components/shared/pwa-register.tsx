"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js and logs its lifecycle events to the console.
 * Previously this silently swallowed ALL errors, making PWA debugging impossible.
 * Now errors are logged so they appear in Chrome DevTools → Application → Service Workers.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[pwa] service worker registered, scope:", registration.scope);

        // Log when a new version installs
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener("statechange", () => {
            console.log("[pwa] service worker state:", newWorker.state);
          });
        });
      })
      .catch((err) => {
        // Log errors clearly — this is the most common reason Chrome shows
        // "Add to Home Screen" instead of "Install app".
        console.error("[pwa] service worker registration failed:", err);
      });
  }, []);

  return null;
}
