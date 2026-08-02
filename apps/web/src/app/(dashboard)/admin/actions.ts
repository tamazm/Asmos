"use server";

import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PlanTier } from ".prisma/client";

async function verifySuperadmin() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (email !== "zaridzezurabi@gmail.com" && email !== "test@asmos.dev") {
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

export async function updateAIGenerationsCount(accountId: string, count: number) {
  await verifySuperadmin();
  
  await prisma.account.update({
    where: { id: accountId },
    data: { aiGenerationsCount: count },
  });

  revalidatePath("/admin");
}
