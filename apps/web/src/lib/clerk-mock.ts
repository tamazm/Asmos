/**
 * Mock shim for @clerk/nextjs/server - used when MOCK_AUTH=true.
 * Returns a hardcoded fake user so we can screenshot the app without real Clerk auth.
 */

const MOCK_USER = {
  id: "mock_user_dev",
  firstName: "Test",
  lastName: "User",
  primaryEmailAddress: { emailAddress: "test@asmos.dev" },
};

export async function currentUser() {
  return MOCK_USER;
}

export function auth() {
  return {
    userId: MOCK_USER.id,
    protect: () => {},
  };
}

// auth.protect shim
auth.protect = () => {};
