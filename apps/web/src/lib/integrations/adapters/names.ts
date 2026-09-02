/** Split a full name into first/last for providers that store them separately. */
export function splitName(fullName: string | null | undefined): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  const lastName = parts.pop() || null;
  const firstName = parts.join(" ");
  return { firstName, lastName };
}
