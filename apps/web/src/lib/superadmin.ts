// Comma-separated allowlist, e.g. SUPERADMINS=alice@example.com,bob@example.com
// Empty/unset means no superadmin access for anyone -- fail closed, not open.
export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  // The mock auth user (see lib/auth-adapter.ts) - only reachable at all when
  // MOCK_AUTH=true, so allowing it here doesn't grant anything in production.
  if (email === "test@asmos.dev") return true;
  const list = (process.env.SUPERADMINS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
