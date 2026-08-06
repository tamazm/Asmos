import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { GeneratedCampaign } from "@/lib/campaignGeneration";
import type { Prisma } from ".prisma/client";
import type { PopupSpec } from "@/lib/popupGeneration";
import { inngest } from "@/lib/inngest/client";
import { AI_GENERATION_LIMITS } from "@/lib/limits";
import { normalizeHost } from "@/lib/host";

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
  let website = await prisma.website.findFirst({
    where: { accountId: account.id },
    orderBy: { createdAt: "asc" },
  });

  if (!website) {
    const rawUrl = body.generationContext?.storeUrl 
      ? String(body.generationContext.storeUrl) 
      : "pending-setup.com";
    const url = normalizeHost(rawUrl);
      
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
        primaryColor: spec.design_tokens.palette[0] ?? body.design?.primaryColor ?? "#165DFF",
        ctaText: spec.cta,
      }
    : body.design;

  const controlFormFields: Prisma.InputJsonValue = hasPopupSpec && spec
    ? spec.fields
    : body.formFields;

  const controlTargeting: Prisma.InputJsonValue = hasPopupSpec && spec
    ? { trigger: spec.trigger, delaySeconds: null }
    : body.targeting;

  const created = await prisma.campaign.create({
    data: {
      accountId: account.id,
      websiteId: website.id,
      name: body.name,
      type: "FORM", // schema-driven generation always produces FORM popups
      status: body.status === "GENERATING" ? "GENERATING" : "ACTIVE",
      generationContext: body.generationContext 
        ? { ...body.generationContext, brandColor: account.brandColor ?? body.generationContext.brandColor } as Prisma.InputJsonValue
        : undefined,
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
                generatedCode: body.popupSpec?.code,
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
    // already exists in the DB — mark it FAILED instead of leaving it
    // stuck in GENERATING forever, and don't 500 the whole request.
    try {
      await inngest.send({
        name: "campaign.generate",
        data: { campaignId: created.id },
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
