/**
 * Client-side logging helpers gated behind NODE_ENV.
 *
 * Use these instead of raw `console.log`/`console.warn` in client components
 * ("use client") so debug noise does not leak into the user's browser console
 * in production. Real errors should still use `console.error` directly.
 */
export const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.log(...args);
};

export const devWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.warn(...args);
};
