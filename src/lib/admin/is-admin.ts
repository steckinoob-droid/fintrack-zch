/**
 * Admin access control — server-only.
 * Never import this from client components.
 *
 * Reads ADMIN_EMAILS (comma-separated) from env var.
 * Example: ADMIN_EMAILS=social@zachstecki.com.br,outro@email.com
 */

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const adminEmails = raw
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}
