"use server";

import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PlanTier } from "@/generated/prisma/client";
import { isSuperadminEmail } from "@/lib/superadmin";

async function verifySuperadmin() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    throw new Error("Unauthorized: Superadmin access required.");
  }
}

export async function updatePlanTier(accountId: string, newTier: PlanTier) {
  await verifySuperadmin();
  
  await prisma.account.update({
    where: { id: accountId },
    data: { planTier: newTier },
  });

  revalidatePath("/admin");
}

export async function resetAIGenerations(accountId: string) {
  await verifySuperadmin();
  
  await prisma.account.update({
    where: { id: accountId },
    data: { aiGenerationsCount: 0 },
  });

  revalidatePath("/admin");
}
