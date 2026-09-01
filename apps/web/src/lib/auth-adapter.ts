/**
 * Auth adapter - proxies to real Clerk or mock depending on MOCK_AUTH env var.
 * Import from here instead of @clerk/nextjs/server in server components/routes.
 */

const isMock = process.env.MOCK_AUTH === "true";

const MOCK_USER = {
  id: "mock_user_dev",
  firstName: "Test",
  lastName: "User",
  primaryEmailAddress: { emailAddress: "test@asmos.dev" },
};

export async function currentUser() {
  if (isMock) return MOCK_USER;
  const { currentUser: clerkCurrentUser } = await import("@clerk/nextjs/server");
  try {
    return await clerkCurrentUser();
  } catch (e) {
    console.warn("Failed to fetch current user from Clerk:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function auth() {
  if (isMock) return { userId: MOCK_USER.id, protect: () => {} };
  const { auth: clerkAuth } = await import("@clerk/nextjs/server");
  return clerkAuth();
}

/**
 * Resolve the signed-in user's account in one call, for API routes that need
 * an accountId. Returns null when unauthenticated so callers can 401.
 * Uses a dynamic import of account.ts to avoid a circular import (account.ts
 * imports currentUser from this module).
 */
export async function getAccountSession(): Promise<{ userId: string; accountId: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const { getOrCreateAccount } = await import("@/lib/account");
  const account = await getOrCreateAccount();
  return { userId: String(userId), accountId: account.id };
}

// Sync protect shim used in layouts
export const authProtect = async () => {
  if (isMock) return;
  const { auth: clerkAuth } = await import("@clerk/nextjs/server");
  // .protect() lives on the auth function reference itself, not on what
  // calling auth() resolves to -- same as the proxy.ts middleware usage.
  return clerkAuth.protect();
};
