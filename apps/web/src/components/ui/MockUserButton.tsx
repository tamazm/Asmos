"use client";

export function UserButton() {
  if (process.env.NEXT_PUBLIC_MOCK_AUTH === "true") {
    return (
      <div className="h-8 w-8 rounded-full bg-[color:var(--color-primary)] flex items-center justify-center text-white text-xs font-medium">
        T
      </div>
    );
  }
  // Real Clerk UserButton
  const { UserButton: ClerkUserButton } = require("@clerk/nextjs");
  return <ClerkUserButton />;
}
