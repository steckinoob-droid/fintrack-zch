import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

/**
 * POST /api/check-email
 * Body:    { email: string }
 * Returns: { state: "free" | "confirmed" | "unconfirmed" }
 *
 * Uses the GoTrue Admin API (service-role key) to look up the email in
 * auth.users WITHOUT creating or modifying anything.
 *
 * "free"        → email does not exist, signup may proceed.
 * "confirmed"   → email exists and is confirmed; user must sign in or reset password.
 * "unconfirmed" → email exists but confirmation link was never clicked; resend it.
 *
 * Returns 503 when SUPABASE_SERVICE_ROLE_KEY is not configured (the register
 * form falls back to the Supabase `identities[]` trick in that case).
 *
 * Security note: this endpoint reveals whether an email is registered.
 * That is an acceptable trade-off for preventing the "fake success" UX bug
 * where a user waits for a confirmation email that will never arrive.
 */

interface GoTrueUser {
  email: string;
  email_confirmed_at: string | null;
}

interface GoTrueListResponse {
  users?: GoTrueUser[];
}

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    // Not configured — return 503 so the client can fall back gracefully
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(`rl:check-email:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    console.warn("[check-email] Rate limit exceeded");
    return NextResponse.json({ error: "too_many_requests" }, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  // Parse and validate input
  let email: string;
  try {
    const body = await request.json() as { email?: unknown };
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    // GoTrue admin users endpoint supports a `filter` query param (ILIKE search).
    // We fetch up to 10 results and do an exact match client-side to avoid
    // false positives from the partial-text search.
    const apiUrl = new URL("/auth/v1/admin/users", supabaseUrl);
    apiUrl.searchParams.set("filter", email);
    apiUrl.searchParams.set("page", "1");
    apiUrl.searchParams.set("per_page", "10");

    const res = await fetch(apiUrl.toString(), {
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      // Prevent hanging if GoTrue is slow
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("[check-email] GoTrue returned", res.status);
      return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
    }

    const json = await res.json() as GoTrueListResponse;
    const users = json.users ?? [];

    // Exact match — GoTrue filter is ILIKE so we must verify
    const match = users.find(u => u.email?.toLowerCase() === email);

    if (!match) {
      return NextResponse.json({ state: "free" });
    }

    return NextResponse.json({
      state: match.email_confirmed_at ? "confirmed" : "unconfirmed",
    });
  } catch (err) {
    console.error("[check-email] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
