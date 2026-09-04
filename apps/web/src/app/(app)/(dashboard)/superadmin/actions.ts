// @ts-expect-error
"use server";

import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isSuperadminEmail } from "@/lib/superadmin";

async function requireSuperadmin() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    throw new Error("Unauthorized");
  }
}

export async function deleteCampaign(campaignId: string) {
  await requireSuperadmin();
  
  await prisma.campaign.delete({
    where: { id: campaignId },
  });
  
  revalidatePath("/superadmin");
}

export async function retryCampaign(campaignId: string) {
  await requireSuperadmin();
  
  // Reset variants and status
  await prisma.$transaction(async (tx) => {
    await tx.variant.deleteMany({
      where: { campaignId },
    });
    
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        status: "GENERATING",
        lastError: null,
      },
    });
  });
  
  revalidatePath("/superadmin");
}

export async function triggerCronNow() {
  await requireSuperadmin();
  
  // This is a manual trigger for testing
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    await fetch(`${baseUrl}/api/cron/generate`, {
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      }
    });
  } catch (err) {
    console.error("Failed to trigger cron manually", err);
  }
  
  revalidatePath("/superadmin");
}
