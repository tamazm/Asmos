"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { renderSplitScreenTemplate } from "@/lib/templates/splitScreen";

export async function updateVariantDesign(
  campaignId: string,
  variantId: string,
  design: {
    headline: string;
    body: string;
    ctaText: string;
    primaryColor: string;
    imageUrl: string;
  }
) {
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    include: {
      campaign: {
        include: { rewards: true }
      }
    }
  });

  if (!variant) throw new Error("Variant not found");

  const reward = variant.campaign.rewards[0];
  const generatedCode = renderSplitScreenTemplate({
    headline: design.headline,
    subhead: design.body,
    cta: design.ctaText,
    primaryColor: design.primaryColor,
    imageUrl: design.imageUrl,
    couponCode: reward?.couponCode || null,
    goal: "BOTH"
  });

  await prisma.variant.update({
    where: { id: variantId },
    data: {
      design: {
        ...(typeof variant.design === "object" ? variant.design : {}),
        headline: design.headline,
        body: design.body,
        ctaText: design.ctaText,
        primaryColor: design.primaryColor,
        imageUrl: design.imageUrl,
      },
      generatedCode,
    },
  });

  revalidatePath(`/campaigns/${campaignId}/variants/${variantId}`);
}
