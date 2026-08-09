"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { renderPopupTemplate } from "@/lib/templates";

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
  // Preserve whichever template/layout the AI originally chose for this
  // variant (see popupSpec.template_id) — a manual copy/color edit shouldn't
  // silently reset it back to the default split-screen template.
  const existingSpec = (variant.popupSpec ?? {}) as { template_id?: string; layout_style?: string };
  const generatedCode = renderPopupTemplate(existingSpec.template_id, {
    headline: design.headline,
    subhead: design.body,
    cta: design.ctaText,
    primaryColor: design.primaryColor,
    imageUrl: design.imageUrl,
    couponCode: reward?.couponCode || null,
    goal: "BOTH",
    layoutStyle: existingSpec.layout_style as "split-left" | "split-right" | "centered" | "minimal" | undefined,
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
