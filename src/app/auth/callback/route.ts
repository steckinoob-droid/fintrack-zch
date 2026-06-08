import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback route — handles PKCE code exchange for:
 *  - Email confirmation (signup)
 *  - Password reset (forgot-password)
 *
 * Supabase appends ?code=<pkce-code> when redirecting here.
 * We exchange it for a session, then redirect to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Only allow relative paths — prevents open redirect attacks
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Code missing or exchange failed — send to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
