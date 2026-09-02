"use server";

import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { setCampaignPhoneCollection } from "@/lib/phoneCollection";

/**
 * Turn phone collection on/off for a whole popup (all its variants). Scoped to
 * the current account so one merchant can't toggle another's campaign.
 */
export async function setPhoneCollectionAction(
  campaignId: string,
  collect: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const account = await getOrCreateAccount();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, accountId: account.id },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };

  await setCampaignPhoneCollection(campaignId, collect);
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true };
}
