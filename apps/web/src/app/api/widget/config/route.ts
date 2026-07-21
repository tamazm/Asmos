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
  });
  if (!website) {
    return corsJson({ campaign: null });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { websiteId: website.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      rewards: { select: { id: true, label: true, type: true } },
    },
  });

  if (!campaign) {
    return corsJson({ campaign: null });
  }

  return corsJson({
    campaign: {
      id: campaign.id,
      type: campaign.type,
      design: campaign.design,
      formFields: campaign.formFields,
      targeting: campaign.targeting,
      rewards: campaign.rewards,
    },
  });
}
