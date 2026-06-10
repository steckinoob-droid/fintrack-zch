/**
 * In-memory fixed-window rate limiter.
 *
 * ⚠️  Serverless caveat: each Vercel function instance has its own
 * in-process memory. Limits are per-instance, not global. Under high
 * concurrency a request may hit a different cold instance and bypass a
 * warm counter. This is sufficient protection against sequential abuse
 * and accidental client loops. For cross-instance protection, replace
 * with Upstash Redis or Vercel KV.
 */

interface Entry {
  count:   number;
  resetAt: number; // epoch ms when the current window expires
}

const store = new Map<string, Entry>();
let lastPurge = 0;

function maybePurge(): void {
  const now = Date.now();
  if (now - lastPurge < 60_000) return;
  lastPurge = now;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed:    boolean;
  remaining:  number; // requests left in the current window
  retryAfter: number; // seconds until window resets (0 when allowed)
}

/**
 * Check and increment the rate-limit counter for a key.
 *
 * @param key       Unique bucket string, e.g. `rl:check-email:1.2.3.4`
 * @param limit     Maximum requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  maybePurge();

  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  entry.count += 1;

  if (entry.count > limit) {
    return {
      allowed:    false,
      remaining:  0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return { allowed: true, remaining: limit - entry.count, retryAfter: 0 };
}

/** Extract the best available client IP from a Request's headers. */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
