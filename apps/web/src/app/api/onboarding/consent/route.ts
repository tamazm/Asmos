import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gdpr, ccpa, bannerText } = (await request.json()) as {
    gdpr?: boolean;
    ccpa?: boolean;
    bannerText?: string;
  };

  const account = await getOrCreateAccount();
  const updated = await prisma.account.update({
    where: { id: account.id },
    data: {
      consentGdprEnabled: Boolean(gdpr),
      consentCcpaEnabled: Boolean(ccpa),
      consentBannerText: bannerText?.trim() || null,
      onboardingCompletedAt: account.onboardingCompletedAt ?? new Date(),
    },
  });

  return Response.json({
    account: {
      consentGdprEnabled: updated.consentGdprEnabled,
      consentCcpaEnabled: updated.consentCcpaEnabled,
      consentBannerText: updated.consentBannerText,
    },
  });
}
