import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsJson, corsPreflight } from "@/lib/cors";
import { recomputeCampaignAllocation } from "@/lib/bandit";

const VALID_TYPES = ["IMPRESSION", "INTERACTION", "SUBMISSION", "GIFT_CLAIMED"] as const;

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const { variantId, type } = (await request.json().catch(() => ({}))) as {
    variantId?: string;
    type?: string;
  };

  if (!variantId || !type || !(VALID_TYPES as readonly string[]).includes(type)) {
    return corsJson({ error: "variantId and a valid type are required" }, { status: 400 });
  }

  await prisma.campaignEvent.create({
    data: { variantId, type: type as (typeof VALID_TYPES)[number] },
  });

  // Only these two event types feed the bandit — skip the recompute query on
  // INTERACTION/GIFT_CLAIMED writes. Deferred via after() so a slow/failed
  // reallocation never delays or breaks the widget's event ack, and keeps
  // running after the response is sent instead of racing the function exit.
  if (type === "IMPRESSION" || type === "SUBMISSION") {
    after(async () => {
      try {
        await recomputeCampaignAllocation(variantId);
      } catch (err) {
        console.error("[bandit] allocation recompute failed", err);
      }
    });
  }

  return corsJson({ ok: true });
}
