import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { GeneratedCampaign } from "@/lib/campaignGeneration";
import type { Prisma } from ".prisma/client";
import type { PopupSpec } from "@/lib/popupGeneration";
import { inngest } from "@/lib/inngest/client";
import { AI_GENERATION_LIMITS } from "@/lib/limits";
import { normalizeHost } from "@/lib/host";
import { renderPopupTemplate } from "@/lib/templates";
import { sanitizeCaptureFields } from "@/lib/templates/runtime";
import { after } from "next/server";
import { emitIntegrationEvent } from "@/lib/integrations/emit";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as GeneratedCampaign & {
    // Optional: AI-generated popup spec from /api/analyze/generate-popup
    popupSpec?: {
      spec: PopupSpec;
      code: string;
      popup_id: string;
    };
    status?: string;
    generationContext?: Record<string, unknown>;
  };

  const account = await getOrCreateAccount();

  // Find-or-create the Website for THIS campaign's own store URL - every
  // campaign creation call (AI wizard via generationContext.storeUrl, manual
  // wizard via body.domain) carries the URL the merchant just typed, and it
  // must be looked up/created fresh every time. The previous version of this
  // handler only ever did this once per account (grabbing whatever website
  // was created first, forever after) - so every later campaign for a
  // "different" store silently landed on the account's original website,
  // and only the newest campaign was ever reachable from any of them (see
  // the "same campaign everywhere" bug). This mirrors the same
  // find-by-(accountId, url)-or-create pattern already used correctly in
  // /api/onboarding/website/route.ts.
  const storeUrlFromContext = body.generationContext?.storeUrl;
  const domainFromBody = (body as { domain?: unknown }).domain;
  const rawUrl =
    (typeof storeUrlFromContext === "string" && storeUrlFromContext.trim()) ||
    (typeof domainFromBody === "string" && domainFromBody.trim()) ||
    // No URL provided at all - fall back to a synthetic, per-account
    // placeholder rather than a shared literal string, so it can never
    // collide with another account's placeholder or a real domain.
    `pending-setup-${account.id}.invalid`;
  const url = normalizeHost(rawUrl);

  let website = await prisma.website.findFirst({
    where: { accountId: account.id, url },
  });
  if (!website) {
    website = await prisma.website.create({
      data: {
        accountId: account.id,
        url,
        installVerified: false,
      },
    });
  }

  // Spend Protection Check
  const isGeneratingAI = body.status === "GENERATING" || Boolean(body.popupSpec?.spec);
  if (isGeneratingAI) {
    const max = AI_GENERATION_LIMITS[account.planTier as keyof typeof AI_GENERATION_LIMITS] ?? 3;
    if (account.aiGenerationsCount >= max) {
      return Response.json(
        { error: `You have reached your AI generation limit (${max}) for the ${account.planTier} plan. Please upgrade your plan to generate more variants.` },
        { status: 403 }
      );
    }
  }

  // When a popup spec is provided (from /analyze flow), use it to seed the control variant
  const hasPopupSpec = Boolean(body.popupSpec?.spec);
  const spec = body.popupSpec?.spec;

  const controlDesign: Prisma.InputJsonValue = hasPopupSpec && spec
    ? {
        headline: spec.headline,
        body: spec.subhead,
        primaryColor: spec.design_tokens.palette[0] ?? body.design?.primaryColor ?? "#111827",
        ctaText: spec.cta,
      }
    : body.design;

  // Merchant's own field choice (manual wizard's body.formFields) wins over
  // the AI's spec.fields - see sanitizeCaptureFields's doc comment for why
  // the model's output there was never a real signal to begin with.
  const captureFields = sanitizeCaptureFields(
    hasPopupSpec && spec ? body.formFields ?? spec.fields : body.formFields,
  );
  const controlFormFields: Prisma.InputJsonValue = captureFields;

  const controlTargeting: Prisma.InputJsonValue = hasPopupSpec && spec
    ? { trigger: spec.trigger, delaySeconds: null }
    : body.targeting;

  // Render the popup HTML server-side from the spec rather than trusting the
  // client to send it. The onboarding flow reads `code` off a response that no
  // longer carries one (the generation API returns a spec, not HTML), so
  // relying on the client left these campaigns with an empty generatedCode and
  // no popup at all on the merchant's site.
  const controlGeneratedCode =
    hasPopupSpec && spec
      ? body.popupSpec?.code ||
        renderPopupTemplate(spec.template_id, {
          headline: spec.headline,
          subhead: spec.subhead,
          cta: spec.cta,
          primaryColor: spec.design_tokens.palette[0] ?? body.design?.primaryColor ?? "#111827",
          couponCode: spec.coupon_code,
          imageUrl: spec.image_url,
          goal: "BOTH",
          layoutStyle: spec.layout_style,
          dna: spec.dna,
          brandFonts: spec.design_tokens,
          palette: spec.design_tokens.palette,
          discountPercent: spec.discount_percent,
          captureFields,
        })
      : undefined;

  const created = await prisma.campaign.create({
    data: {
      accountId: account.id,
      websiteId: website.id,
      name: body.name,
      type: "FORM", // schema-driven generation always produces FORM popups
      status: body.status === "GENERATING" ? "GENERATING" : "ACTIVE",
      generationStage: body.status === "GENERATING" ? "QUEUED" : undefined,
      // account.brandColor is never stamped in here - generateCampaign.ts
      // doesn't read context.brandColor for anything anymore (colour comes
      // from measured brandTokens, or a scraped-industry colour as fallback;
      // see popupGeneration.ts's brandTokensFromAnalyzeResult), so folding
      // the account's stored colour into this blob was only ever dead
      // write-only data at best, and at worst a stale account colour
      // silently overriding a fresh analysis for whoever did still read it.
      generationContext: body.generationContext as Prisma.InputJsonValue,
      variants: body.status === "GENERATING" ? undefined : {
        create: {
          name: "Control",
          isControl: true,
          trafficPercent: 100,
          design: controlDesign,
          formFields: controlFormFields,
          targeting: controlTargeting,
          ...(hasPopupSpec && spec
            ? {
                popupSpec: spec as unknown as Prisma.InputJsonValue,
                generatedCode: controlGeneratedCode,
              }
            : {}),
        },
      },
      rewards: {
        create: body.rewards?.map((reward) => ({
          label: reward.label,
          type: reward.type,
          couponCode: reward.couponCode,
          weight: reward.weight,
        })) ?? [],
      },
    },
    include: { variants: true },
  });

  let responseCampaign = created;

  if (isGeneratingAI) {
    // Send background task to Inngest instead of waiting for a cron.
    // If this fails (no local Inngest Dev Server, or missing
    // INNGEST_EVENT_KEY/SIGNING_KEY in production), the campaign row
    // already exists in the DB - mark it FAILED instead of leaving it
    // stuck in GENERATING forever, and don't 500 the whole request.
    try {
      await inngest.send({
        name: "campaign.generate",
        data: { campaignId: created.id, enqueuedAt: Date.now() },
      });
    } catch (err) {
      console.error("[campaigns/route] inngest.send failed for campaign.generate", err);
      responseCampaign = await prisma.campaign.update({
        where: { id: created.id },
        data: {
          status: "FAILED",
          lastError: "Failed to queue campaign generation. Please retry.",
        },
        include: { variants: true },
      });
    }
  }

  if (responseCampaign.status === "ACTIVE") {
    after(async () => {
      try {
        await emitIntegrationEvent(account.id, {
          event: "campaign.activated",
          payload: {
            campaign_id: created.id,
            campaign_name: created.name,
            changed_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error("[integrations] campaign.activated emit failed", err);
      }
    });
  }

  return Response.json(
    { campaign: responseCampaign },
    { status: body.status === "GENERATING" ? 202 : 200 },
  );
}



export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: {
      variants: { include: { _count: { select: { leads: true } } } },
    },
  });

  return Response.json({ campaigns });
}
