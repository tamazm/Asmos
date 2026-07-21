import { currentUser } from "@clerk/nextjs/server";
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

  const account = await prisma.account.create({
    data: {
      name: name ?? email ?? "New Account",
      users: {
        create: { clerkUserId: user.id, email, name },
      },
    },
    include: { websites: true },
  });

  return account;
}
