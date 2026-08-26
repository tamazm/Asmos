import { currentUser } from "@/lib/auth-adapter";
import { isSuperadminEmail } from "@/lib/superadmin";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { recomputeCampaignAllocation } from "@/lib/bandit";

// Superadmin-only test harness for the knockout/bandit system - lets you
// skip the real-world wait for impressions to accumulate. See
// components/TesterToolkit.tsx for the UI.
async function requireSuperadmin() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    throw new Error("Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperadmin();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "inject" | "trigger_knockout";
    variantId?: string;
    mockCount?: number;
  };

  if (!body.variantId) {
    return Response.json({ error: "variantId is required" }, { status: 400 });
  }

  const variant = await prisma.variant.findUnique({
    where: { id: body.variantId },
    select: { id: true, campaignId: true },
  });
  if (!variant) {
    return Response.json({ error: "Variant not found" }, { status: 404 });
  }

  if (body.action === "trigger_knockout") {
    await inngest.send({ name: "campaign.evaluate", data: { campaignId: variant.campaignId } });
    return Response.json({ ok: true, message: "campaign.evaluate sent", campaignId: variant.campaignId });
  }

  // Default action: inject.
  const count = Math.floor(Number(body.mockCount));
  if (!Number.isFinite(count) || count < 1 || count > 10000) {
    return Response.json({ error: "mockCount must be between 1 and 10000" }, { status: 400 });
  }

  // Favorable ~20% conversion rate so the target variant looks like a clear
  // winner, comfortably past MIN_SAMPLE_FOR_SIGNIFICANCE (100 impressions).
  const submissions = Math.round(count * 0.2);
  const rows: { variantId: string; type: "IMPRESSION" | "SUBMISSION" }[] = [
    ...Array.from({ length: count }, () => ({ variantId: variant.id, type: "IMPRESSION" as const })),
    ...Array.from({ length: submissions }, () => ({ variantId: variant.id, type: "SUBMISSION" as const })),
  ];
  await prisma.campaignEvent.createMany({ data: rows });

  try {
    await recomputeCampaignAllocation(variant.id);
  } catch (err) {
    console.error("[testing] bandit recompute after injection failed", err);
  }

  return Response.json({ ok: true, injectedImpressions: count, injectedSubmissions: submissions });
}
