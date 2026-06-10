/**
 * Admin access control — server-only.
 * Never import this from client components.
 *
 * Reads ADMIN_EMAILS (comma-separated) from env var.
 * Example: ADMIN_EMAILS=social@zachstecki.com.br,outro@email.com
 */

// Warn once per cold-start if the env var is missing so it shows up clearly
// in deploy logs without spamming on every request.
if (!process.env.ADMIN_EMAILS) {
  console.warn("[admin] ADMIN_EMAILS env var is not set — admin access is blocked for all users. Set it in your hosting environment.");
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const adminEmails = raw
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}
