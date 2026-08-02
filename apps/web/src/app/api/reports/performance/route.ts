// @ts-expect-error
import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { CampaignEventType } from ".prisma/client";

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const campaigns = await prisma.campaign.findMany({
    where: {
      accountId: account.id,
      ...(campaignId ? { id: campaignId } : {}),
    },
    include: {
      variants: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const allVariantIds = campaigns.flatMap((c) => c.variants.map((v) => v.id));

  const eventWhere = {
    variantId: { in: allVariantIds },
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const grouped = await prisma.campaignEvent.groupBy({
    by: ["variantId", "type"],
    where: eventWhere,
    _count: { _all: true },
  });

  const eventCounts = new Map<string, number>();
  for (const row of grouped) {
    const key = `${row.variantId}:${row.type}`;
    eventCounts.set(key, (eventCounts.get(key) ?? 0) + row._count._all);
  }

  function getCount(variantId: string, type: CampaignEventType): number {
    return eventCounts.get(`${variantId}:${type}`) ?? 0;
  }

  const header = ["Campaign", "Variant", "Impressions", "Submissions", "Conversion Rate", "Is Winner"];
  const rows: string[][] = [];

  for (const campaign of campaigns) {
    let maxConversionRate = -1;
    let winnerVariantId: string | null = campaign.winningVariantId ?? null;

    // Compute per-variant stats first to determine winner by CVR if no explicit winner
    const variantStats = campaign.variants.map((variant) => {
      const impressions = getCount(variant.id, "IMPRESSION");
      const submissions = getCount(variant.id, "SUBMISSION");
      const conversionRate = impressions > 0 ? (submissions / impressions) * 100 : 0;
      if (!winnerVariantId && conversionRate > maxConversionRate && impressions > 0) {
        maxConversionRate = conversionRate;
        winnerVariantId = variant.id;
      }
      return { variant, impressions, submissions, conversionRate };
    });

    for (const { variant, impressions, submissions, conversionRate } of variantStats) {
      const isWinner = variant.id === winnerVariantId && impressions > 0 ? "Yes" : "No";
      rows.push([
        campaign.name,
        variant.name,
        String(impressions),
        String(submissions),
        `${conversionRate.toFixed(2)}%`,
        isWinner,
      ]);
    }
  }

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => csvField(String(cell))).join(","))
    .join("\n");

  const dateTag = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="performance-report-${dateTag}.csv"`,
    },
  });
}
