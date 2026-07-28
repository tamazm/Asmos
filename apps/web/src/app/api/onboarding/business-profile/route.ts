import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { industry, brandColor } = (await request.json()) as {
    industry?: string;
    brandColor?: string;
  };

  const account = await getOrCreateAccount();
  const updated = await prisma.account.update({
    where: { id: account.id },
    data: {
      industry: industry?.trim() || null,
      brandColor: brandColor?.trim() || null,
    },
  });

  return Response.json({
    account: { industry: updated.industry, brandColor: updated.brandColor },
  });
}
