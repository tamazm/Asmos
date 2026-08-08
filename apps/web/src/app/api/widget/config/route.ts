// @ts-expect-error
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/host";
import { corsJson, corsPreflight } from "@/lib/cors";

// AI popup variation roadmap (Phase 1): lets widget.js decide whether to load
// posthog-js (with session replay/rage-click/dead-click detection) on the
// merchant's site. Off by default — this loads a third-party script and
// starts recording sessions, which has privacy/consent and CSP implications
// beyond a simple feature flag, so it's an explicit opt-in server-side
// rather than something that turns on the moment a key is present.
const TRACKING_CONFIG = {
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY || null,
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
  sessionRecordingEnabled: process.env.POSTHOG_SESSION_RECORDING_ENABLED === "true",
};

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const site = url.searchParams.get("site");
  const previewVariantId = url.searchParams.get("preview_variant_id");
  if (previewVariantId) {
    const previewVariant = await prisma.variant.findUnique({
      where: { id: previewVariantId },
      include: {
        campaign: {
          include: {
            website: {
              include: { account: true }
            },
            rewards: { select: { id: true, label: true, type: true } }
          }
        },
      },
    });

    if (previewVariant) {
      const consent = {
        required: previewVariant.campaign.website.account.consentGdprEnabled || previewVariant.campaign.website.account.consentCcpaEnabled,
        bannerText: previewVariant.campaign.website.account.consentBannerText,
      };

      return corsJson({
        campaign: {
          id: previewVariant.campaign.id,
          type: previewVariant.campaign.type,
          forcedVariantId: previewVariant.id,
          variants: [
            {
              id: previewVariant.id,
              name: previewVariant.name,
              trafficPercent: 100,
              design: previewVariant.design,
              formFields: previewVariant.formFields,
              targeting: previewVariant.targeting,
              rewards: previewVariant.campaign.rewards,
              generatedCode: previewVariant.generatedCode,
            }
          ],
        },
        consent,
        tracking: TRACKING_CONFIG,
      });
    }
  }

  if (!site) {
    return corsJson({ error: "site is required" }, { status: 400 });
  }

  const website = await prisma.website.findFirst({
    where: { 
      OR: [
        { url: normalizeHost(site) },
        { url: site }
      ]
    },
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

  const isPreview = url.searchParams.get("preview") === "true";
  const campaign = await prisma.campaign.findFirst({
    where: { 
      websiteId: website.id, 
      status: isPreview ? { notIn: ["DRAFT", "FAILED", "GENERATING"] } : "ACTIVE" 
    },
    orderBy: { createdAt: "desc" },
    include: {
      rewards: { select: { id: true, label: true, type: true } },
      variants: true,
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
        rewards: campaign.rewards,
        generatedCode: variant.generatedCode,
      })),
    },
    consent,
    tracking: TRACKING_CONFIG,
  });
}
