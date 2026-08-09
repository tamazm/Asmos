// @ts-expect-error
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/host";
import { corsJson, corsPreflight } from "@/lib/cors";
import { campaignHasAvailableReward } from "@/lib/reward";

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

  // Website.url has no unique constraint (a pre-existing gap — fixing it
  // outright would need a data audit first, since duplicate rows may
  // already exist from the old buggy campaign-creation flow). findMany
  // instead of findFirst so a duplicate match is something we can detect
  // and pick deterministically, rather than a silent, DB-order-dependent
  // pick of whichever row the query planner returns first — which risked
  // serving one account's campaign to a visitor on another account's site.
  const matches = await prisma.website.findMany({
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

  if (matches.length === 0) {
    return corsJson({ campaign: null, consent: null });
  }

  let website = matches[0];
  if (matches.length > 1) {
    // Ambiguous — prefer a website that's actually been verified installed
    // on a real domain, then fall back to the most recently created. Either
    // way, log it: this should never happen once every Website.url is
    // genuinely unique, so seeing it means there's a real collision to go
    // clean up.
    website =
      matches.find((w) => w.installVerified) ??
      [...matches].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    console.error(
      `[widget/config] ambiguous website lookup for site="${site}": ${matches.length} rows matched (ids: ${matches.map((m) => m.id).join(", ")}), serving ${website.id}`,
    );
    await prisma.systemLog.create({
      data: {
        level: "ERROR",
        message: `Ambiguous website lookup for site="${site}"`,
        details: `${matches.length} Website rows matched: ${matches.map((m) => `${m.id} (account ${m.accountId})`).join(", ")}. Served ${website.id}.`,
      },
    }).catch(() => {});
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
      rewards: {
        select: {
          id: true,
          label: true,
          type: true,
          couponCode: true,
          weight: true,
          active: true,
          maxRedemptions: true,
          redemptionsCount: true,
          couponCodes: { where: { usedAt: null }, select: { id: true } },
        },
      },
      variants: true,
    },
  });

  if (!campaign || campaign.variants.length === 0) {
    return corsJson({ campaign: null, consent });
  }

  // A popup must never go live promising a reward it can't actually give
  // out. Campaigns whose goal is pure email capture are exempt — they're
  // designed to have zero rewards, that's not a broken state for them.
  // Real merchant previews (isPreview) always bypass this, same as the
  // page-targeting rule below — a merchant checking their own popup should
  // never see "nothing" just because they haven't stocked codes yet.
  const goal = (campaign.generationContext as { goal?: string } | null)?.goal ?? "BOTH";
  if (!isPreview && goal !== "EMAIL" && !campaignHasAvailableReward(campaign.rewards)) {
    return corsJson({ campaign: null, consent });
  }

  // Public payload — just what the widget needs to render (label/type),
  // not the internal availability bookkeeping (active/maxRedemptions/
  // couponCodes) used only for the server-side gate above.
  const publicRewards = campaign.rewards.map((r) => ({ id: r.id, label: r.label, type: r.type }));

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
        rewards: publicRewards,
        generatedCode: variant.generatedCode,
      })),
    },
    consent,
    tracking: TRACKING_CONFIG,
  });
}
