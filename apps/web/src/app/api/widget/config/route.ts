// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/host";
import { corsJson, corsPreflight } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const site = new URL(request.url).searchParams.get("site");
  if (!site) {
    return corsJson({ error: "site is required" }, { status: 400 });
  }

  const website = await prisma.website.findFirst({
    where: { url: normalizeHost(site) },
    include: {
      account: {
        select: {
          consentGdprEnabled: true,
          consentCcpaEnabled: true,
          consentBannerText: true,
        },
      },
    },
  });
  if (!website) {
    return corsJson({ campaign: null, consent: null });
  }

  const consent = {
    required: website.account.consentGdprEnabled || website.account.consentCcpaEnabled,
    bannerText: website.account.consentBannerText,
  };

  const campaign = await prisma.campaign.findFirst({
    where: { websiteId: website.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      variants: {
        include: {
          rewards: { select: { id: true, label: true, type: true } },
        },
      },
    },
  });

  if (!campaign || campaign.variants.length === 0) {
    return corsJson({ campaign: null, consent });
  }

  return corsJson({
    campaign: {
      id: campaign.id,
      type: campaign.type,
      forcedVariantId: campaign.winningVariantId,
      variants: campaign.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        trafficPercent: variant.trafficPercent,
        design: variant.design,
        formFields: variant.formFields,
        targeting: variant.targeting,
        rewards: variant.rewards,
      })),
    },
    consent,
  });
}
