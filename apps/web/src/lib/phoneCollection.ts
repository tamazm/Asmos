import { prisma } from "./prisma";
import { renderVariantGeneratedCode, withPhoneField } from "./templates/renderVariant";

/**
 * Turn phone collection on/off for every variant of a campaign.
 *
 * `formFields` is the source of truth (drives the widget's fallback renderer and
 * every re-render), so it is always updated. Variants that render from a baked
 * HTML blob (`generatedCode`, i.e. real AI-template popups) are re-rendered so
 * the optional phone input actually appears/disappears on the live popup.
 *
 * Returns the number of variants changed.
 */
export async function setCampaignPhoneCollection(campaignId: string, collect: boolean): Promise<number> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { variants: true, rewards: true },
  });
  if (!campaign) return 0;

  const goal = (campaign.generationContext as { goal?: "EMAIL" | "DISCOUNT" | "BOTH" } | null)?.goal ?? "BOTH";
  const couponCode = campaign.rewards[0]?.couponCode ?? null;

  let changed = 0;
  for (const v of campaign.variants) {
    const alreadyCollects = Array.isArray(v.formFields) && (v.formFields as unknown[]).includes("phone");
    if (alreadyCollects === collect) continue;

    const data: { formFields: string[]; generatedCode?: string } = {
      formFields: withPhoneField(v.formFields, collect),
    };
    if (v.generatedCode) {
      data.generatedCode = renderVariantGeneratedCode(v, { collectPhone: collect, goal, couponCode });
    }
    await prisma.variant.update({ where: { id: v.id }, data });
    changed++;
  }
  return changed;
}

/** True when at least one variant of the campaign currently collects phone. */
export async function campaignCollectsPhone(campaignId: string): Promise<boolean> {
  const variants = await prisma.variant.findMany({
    where: { campaignId },
    select: { formFields: true },
  });
  return variants.some((v) => Array.isArray(v.formFields) && (v.formFields as unknown[]).includes("phone"));
}

/** True when any live (ACTIVE) popup for the account collects a phone number. */
export async function accountHasPhoneCollectingPopup(accountId: string): Promise<boolean> {
  const variants = await prisma.variant.findMany({
    where: { campaign: { accountId, status: "ACTIVE" } },
    select: { formFields: true },
  });
  return variants.some((v) => Array.isArray(v.formFields) && (v.formFields as unknown[]).includes("phone"));
}

/** Add phone collection to every live (ACTIVE) popup. Returns campaigns changed. */
export async function addPhoneToAllActivePopups(accountId: string): Promise<number> {
  const campaigns = await prisma.campaign.findMany({
    where: { accountId, status: "ACTIVE" },
    select: { id: true },
  });
  let campaignsChanged = 0;
  for (const c of campaigns) {
    if ((await setCampaignPhoneCollection(c.id, true)) > 0) campaignsChanged++;
  }
  return campaignsChanged;
}
