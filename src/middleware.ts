/**
 * Next.js Edge Middleware — auth guard.
 *
 * The logic lives in src/proxy.ts so it can be unit-tested independently.
 * This file simply re-exports it under the name Next.js requires ("middleware")
 * and passes through the route-matcher config.
 *
 * Excluded from the matcher (no auth check):
 *   • _next/static, _next/image  — Next.js internals
 *   • favicon.ico                — browser favicon
 *   • manifest.json              — PWA manifest (Chrome must fetch this before login)
 *   • sw.js                      — Service Worker (registered before login)
 *   • offline                    — offline fallback page
 *   • *.svg|png|jpg|…            — static images
 */
export { proxy as middleware, config } from "./proxy";
