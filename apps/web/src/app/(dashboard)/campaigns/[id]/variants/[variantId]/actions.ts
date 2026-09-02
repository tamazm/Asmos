"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { renderPopupTemplate } from "@/lib/templates";
import { sanitizeRedirectUrl, sanitizeCaptureFields } from "@/lib/templates/runtime";
import type { Prisma } from ".prisma/client";

export async function updateVariantDesign(
  campaignId: string,
  variantId: string,
  design: {
    headline: string;
    body: string;
    ctaText: string;
    primaryColor: string;
    imageUrl: string;
    redirectUrl: string;
    captureFields: string[];
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
  // Sanitized once, here, before it's persisted anywhere - this is the
  // authoritative gate (see sanitizeRedirectUrl's doc comment: a bad value
  // executing as window.location.href in a shopper's browser is a real
  // stored-XSS vector, not just a display bug). An invalid input is silently
  // dropped to null (closes the popup instead) rather than persisted as
  // something that will never actually take effect.
  const redirectUrl = sanitizeRedirectUrl(design.redirectUrl);
  // Same gate as redirectUrl: an unrecognised value degrades to "email only"
  // rather than being persisted as something the runtime will never render.
  const captureFields = sanitizeCaptureFields(design.captureFields);
  // Preserve whichever template/layout the AI originally chose for this
  // variant (see popupSpec.template_id) - a manual copy/color edit shouldn't
  // silently reset it back to the default split-screen template.
  const existingSpec = (variant.popupSpec ?? {}) as {
    template_id?: string;
    layout_style?: string;
    dna?: unknown;
    design_tokens?: {
      type_display?: string | null;
      type_body?: string | null;
      palette?: string[] | null;
    } | null;
    discount_percent?: number | null;
  };
  const generatedCode = renderPopupTemplate(existingSpec.template_id, {
    headline: design.headline,
    subhead: design.body,
    cta: design.ctaText,
    primaryColor: design.primaryColor,
    imageUrl: design.imageUrl,
    couponCode: reward?.couponCode || null,
    goal: "BOTH",
    layoutStyle: existingSpec.layout_style as "split-left" | "split-right" | "centered" | "minimal" | undefined,
    // Carry the design DNA through a manual edit too. Without this, editing a
    // headline would silently strip the popup's timer, eyebrow, theme, flow
    // and step copy back to defaults - i.e. reset it to the generic popup.
    dna: existingSpec.dna as Parameters<typeof renderPopupTemplate>[1]["dna"],
    // Same reasoning as the DNA above: a manual copy edit must not silently
    // drop the popup back to system-ui.
    brandFonts: existingSpec.design_tokens ?? null,
    palette: existingSpec.design_tokens?.palette ?? null,
    discountPercent: existingSpec.discount_percent ?? null,
    redirectUrl,
    captureFields,
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
        redirectUrl,
      },
      formFields: captureFields as unknown as Prisma.InputJsonValue,
      generatedCode,
    },
  });

  revalidatePath(`/campaigns/${campaignId}/variants/${variantId}`);
}
