"use server";

import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isSuperadminEmail } from "@/lib/superadmin";

async function verifySuperadmin() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    throw new Error("Unauthorized: Superadmin access required.");
  }
  return email ?? "unknown";
}

// AI popup variation roadmap, Phase 4: the human-approval gate for patterns
// mined across accounts (see lib/inngest/mineCrossAccountPatterns.ts).
// Approving a row here is the only way a mined pattern can ever affect live
// generation - see popupGeneration.ts's getLearnedPatternsSection, which
// only reads status=APPROVED rows.
export async function approveLearnedPattern(id: string) {
  const email = await verifySuperadmin();

  await prisma.learnedPattern.update({
    where: { id },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: email },
  });

  revalidatePath("/admin/learned-patterns");
}

export async function rejectLearnedPattern(id: string) {
  const email = await verifySuperadmin();

  await prisma.learnedPattern.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: email },
  });

  revalidatePath("/admin/learned-patterns");
}
