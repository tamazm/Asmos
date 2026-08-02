import { PageHeader } from "@/components/ui/PageHeader";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { PoolRow } from "./PoolRow";

export default async function RewardsPage() {
  const account = await getOrCreateAccount();

  const rewardRules = await prisma.rewardRule.findMany({
    where: {
      campaign: {
        accountId: account.id
      }
    },
    include: {
      campaign: true,
      _count: { select: { coupons: true } },
      coupons: {
        where: { isUsed: true }
      }
    }
  });

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Rewards & Coupons"
      />
      <div className="text-[color:var(--color-text-secondary)] text-sm -mt-2 mb-2">
        Manage your coupon pools. Assign rewards to campaigns and track their usage.
      </div>
      
      {rewardRules.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-12 text-center shadow-sm">
          <p className="text-[color:var(--color-text-primary)] font-medium">No rewards found</p>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
            When you create campaigns with rewards, you can manage their coupon pools here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-[color:var(--color-text-primary)]">
            <thead className="bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)] border-b border-[color:var(--color-border)]">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Reward Name</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Campaign</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Type</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Fallback Code</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Pool (Used / Total)</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {rewardRules.map((reward: any) => (
                <PoolRow key={reward.id} reward={reward} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
