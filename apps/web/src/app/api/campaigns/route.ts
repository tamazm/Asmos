import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { GeneratedCampaign } from "@/lib/campaignGeneration";
import type { Prisma } from "@/generated/prisma/client";
import type { PopupSpec } from "@/lib/popupGeneration";

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
  };

  const account = await getOrCreateAccount();
  const website = await prisma.website.findFirst({
    where: { accountId: account.id },
    orderBy: { createdAt: "asc" },
  });

  if (!website) {
    return Response.json(
      { error: "Connect a website before publishing a campaign." },
      { status: 400 },
    );
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
      status: "ACTIVE",
      variants: {
        create: {
          name: "Control",
          isControl: true,
          trafficPercent: 100,
          design: controlDesign,
          formFields: controlFormFields,
          targeting: controlTargeting,
          // Store the AI-generated spec and code when available
          ...(hasPopupSpec && spec
            ? {
                popupSpec: spec as unknown as Prisma.InputJsonValue,
                generatedCode: body.popupSpec?.code,
              }
            : {}),
          rewards: {
            create: body.rewards?.map((reward) => ({
              label: reward.label,
              type: reward.type,
              couponCode: reward.couponCode,
              weight: reward.weight,
            })) ?? [],
          },
        },
      },
    },
    include: { variants: true },
  });

  return Response.json({ campaign: created });
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
