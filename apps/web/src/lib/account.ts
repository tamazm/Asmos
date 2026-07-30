import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";

export async function getOrCreateAccount() {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");

  const existing = await prisma.user.findUnique({
    where: { clerkUserId: user.id },
    include: { account: { include: { websites: true } } },
  });
  if (existing) return existing.account;

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

  const isMock = process.env.MOCK_AUTH === "true";

  const account = await prisma.account.create({
    data: {
      name: name ?? email ?? "New Account",
      // In mock mode, mark onboarding complete so the dashboard doesn't redirect
      onboardingCompletedAt: isMock ? new Date() : null,
      users: {
        create: { clerkUserId: user.id, email, name },
      },
    },
    include: { websites: true },
  });

  return account;
}
