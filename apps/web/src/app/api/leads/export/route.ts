// @ts-nocheck
import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

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

  const where: Prisma.LeadWhereInput = {
    variant: {
      campaign: {
        accountId: account.id,
        ...(campaignId ? { id: campaignId } : {}),
      },
    },
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { variant: { include: { campaign: { select: { name: true } } } } },
  });

  const header = ["Name", "Email", "Phone", "Campaign", "Reward Code", "Created At"];
  const rows = leads.map((lead) => [
    lead.name ?? "",
    lead.email ?? "",
    lead.phone ?? "",
    lead.variant.campaign.name,
    lead.rewardClaimedCode ?? "",
    lead.createdAt.toISOString(),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => csvField(String(cell))).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
