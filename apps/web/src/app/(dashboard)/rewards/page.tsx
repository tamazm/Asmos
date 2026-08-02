import { PageHeader } from "@/components/ui/PageHeader";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { RewardsBoard, type RewardRow } from "./RewardsBoard";

export default async function RewardsPage() {
  const account = await getOrCreateAccount();

  const rewards = await prisma.rewardRule.findMany({
    where: { campaign: { accountId: account.id } },
    include: {
      campaign: { select: { id: true, name: true } },
      couponCodes: { select: { usedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: RewardRow[] = rewards.map((r) => ({
    id: r.id,
    label: r.label,
    category: r.category,
    description: r.description,
    type: r.type,
    couponCode: r.couponCode,
    weight: r.weight,
    campaignId: r.campaign.id,
    campaignName: r.campaign.name,
    totalCodes: r.couponCodes.length,
    usedCodes: r.couponCodes.filter((c) => c.usedAt !== null).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Rewards" />
      <RewardsBoard rows={rows} />
    </div>
  );
}
