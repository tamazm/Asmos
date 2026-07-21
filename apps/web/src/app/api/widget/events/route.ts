import { prisma } from "@/lib/prisma";
import { corsJson, corsPreflight } from "@/lib/cors";

const VALID_TYPES = ["IMPRESSION", "INTERACTION", "SUBMISSION", "GIFT_CLAIMED"] as const;

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const { campaignId, type } = (await request.json().catch(() => ({}))) as {
    campaignId?: string;
    type?: string;
  };

  if (!campaignId || !type || !(VALID_TYPES as readonly string[]).includes(type)) {
    return corsJson({ error: "campaignId and a valid type are required" }, { status: 400 });
  }

  await prisma.campaignEvent.create({
    data: { campaignId, type: type as (typeof VALID_TYPES)[number] },
  });

  return corsJson({ ok: true });
}
