/**
 * Auth adapter — proxies to real Clerk or mock depending on MOCK_AUTH env var.
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
  return clerkCurrentUser();
}

export async function auth() {
  if (isMock) return { userId: MOCK_USER.id, protect: () => {} };
  const { auth: clerkAuth } = await import("@clerk/nextjs/server");
  return clerkAuth();
}

// Sync protect shim used in layouts
export const authProtect = async () => {
  if (isMock) return;
  const { auth: clerkAuth } = await import("@clerk/nextjs/server");
  return (await clerkAuth()).protect();
};
