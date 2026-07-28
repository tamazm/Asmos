import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    industry?: string;
    brandColor?: string;
    consentGdprEnabled?: boolean;
    consentCcpaEnabled?: boolean;
    consentBannerText?: string;
  };

  if (!body.name || body.name.trim().length === 0) {
    return Response.json({ error: "Business name is required" }, { status: 400 });
  }

  const account = await getOrCreateAccount();
  const updated = await prisma.account.update({
    where: { id: account.id },
    data: {
      name: body.name.trim(),
      industry: body.industry?.trim() || null,
      brandColor: body.brandColor?.trim() || null,
      consentGdprEnabled: Boolean(body.consentGdprEnabled),
      consentCcpaEnabled: Boolean(body.consentCcpaEnabled),
      consentBannerText: body.consentBannerText?.trim() || null,
    },
  });

  return Response.json({
    account: {
      name: updated.name,
      industry: updated.industry,
      brandColor: updated.brandColor,
      consentGdprEnabled: updated.consentGdprEnabled,
      consentCcpaEnabled: updated.consentCcpaEnabled,
      consentBannerText: updated.consentBannerText,
    },
  });
}
