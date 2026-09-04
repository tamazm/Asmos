import { currentUser } from "@/lib/auth-adapter";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isSuperadminEmail } from "@/lib/superadmin";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import {
  AI_GENERATION_LIMITS,
  MAX_CODES_PER_GENERATE_REQUEST,
  MAX_CODES_PER_IMPORT_REQUEST,
  MAX_COUPON_CODES_PER_ACCOUNT,
} from "@/lib/limits";
import { AccountControls } from "./AccountControls";
import { CampaignAdminList } from "./CampaignAdminList";
import { RewardsBoard, type RewardRow } from "@/app/(app)/(dashboard)/rewards/RewardsBoard";

// Per-account detail view for superadmins: everything about one merchant in
// one place - team, websites, plan/generation controls, and every campaign
// with its generated popups (with live preview + performance) and controls
// to retry/delete a campaign. Previously the only surface was the flat
// accounts table on /admin, which had no drill-down at all.
export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    redirect("/dashboard");
  }

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      websites: { orderBy: { createdAt: "asc" } },
      campaigns: {
        orderBy: { createdAt: "desc" },
        include: {
          website: { select: { url: true } },
          variants: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!account) notFound();

  // Same query/shape as rewards/page.tsx, scoped to this account instead of
  // the logged-in superadmin's own - RewardsBoard's writes are threaded with
  // overrideAccountId so they land on this account (see
  // lib/account.ts's resolveAccountForRequest).
  const rewards = await prisma.rewardRule.findMany({
    where: { campaign: { accountId: account.id } },
    include: {
      campaign: { select: { id: true, name: true } },
      couponCodes: { select: { usedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const rewardRows: RewardRow[] = rewards.map((r) => ({
    id: r.id,
    label: r.label,
    category: r.category,
    description: r.description,
    type: r.type,
    couponCode: r.couponCode,
    weight: r.weight,
    active: r.active,
    maxRedemptions: r.maxRedemptions,
    redemptionsCount: r.redemptionsCount,
    campaignId: r.campaign.id,
    campaignName: r.campaign.name,
    totalCodes: r.couponCodes.length,
    usedCodes: r.couponCodes.filter((c) => c.usedAt !== null).length,
  }));
  const rewardTotalCodesExisting = rewardRows.reduce((sum, r) => sum + r.totalCodes, 0);
  const rewardCodeLimits = {
    planTier: account.planTier,
    generateCap: MAX_CODES_PER_GENERATE_REQUEST[account.planTier] ?? 25,
    importCap: MAX_CODES_PER_IMPORT_REQUEST[account.planTier] ?? 100,
    totalCap: MAX_COUPON_CODES_PER_ACCOUNT[account.planTier] ?? 100,
    totalExisting: rewardTotalCodesExisting,
  };
  const rewardCampaignOptions = account.campaigns.map((c) => ({ id: c.id, name: c.name }));

  const variantIds = account.campaigns.flatMap((c) => c.variants.map((v) => v.id));

  const [eventCounts, leadCounts] = await Promise.all([
    variantIds.length
      ? prisma.campaignEvent.groupBy({
          by: ["variantId", "type"],
          where: { variantId: { in: variantIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    variantIds.length
      ? prisma.lead.groupBy({
          by: ["variantId"],
          where: { variantId: { in: variantIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const statsByVariant: Record<string, Record<string, number>> = {};
  for (const row of eventCounts) {
    const existing = statsByVariant[row.variantId] ?? {};
    existing[row.type] = row._count._all;
    statsByVariant[row.variantId] = existing;
  }

  const leadsByVariant: Record<string, number> = {};
  for (const row of leadCounts) {
    leadsByVariant[row.variantId] = row._count._all;
  }

  const totalPopups = account.campaigns.reduce((sum, c) => sum + c.variants.length, 0);
  const totalImpressions = Object.values(statsByVariant).reduce((sum, s) => sum + (s.IMPRESSION ?? 0), 0);
  const totalSubmissions = Object.values(statsByVariant).reduce((sum, s) => sum + (s.SUBMISSION ?? 0), 0);
  const limit = AI_GENERATION_LIMITS[account.planTier] ?? 3;
  const gensLeft = Math.max(0, limit - account.aiGenerationsCount);

  // Serialize dates/campaigns into plain JSON-safe shapes for the client
  // components below (CampaignAdminList needs createdAt as a string, and
  // Prisma Decimal/Date instances aren't valid RSC-to-client props).
  const campaignsForClient = account.campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    lastError: c.lastError,
    createdAt: c.createdAt.toISOString(),
    website: c.website ? { url: c.website.url } : null,
    variants: c.variants.map((v) => ({
      id: v.id,
      name: v.name,
      isControl: v.isControl,
      status: v.status,
      trafficPercent: v.trafficPercent,
      testAxis: v.testAxis,
      hypothesis: v.hypothesis,
      motivatingMetric: v.motivatingMetric,
      design: v.design,
      generatedCode: v.generatedCode,
    })),
  }));

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <div>
        <div className="flex items-center gap-3 mb-2 text-sm text-[color:var(--color-text-secondary)]">
          <Link href="/admin" className="hover:text-[color:var(--color-text-primary)]">Admin</Link>
          <span>/</span>
          <span className="text-[color:var(--color-text-primary)] font-medium">{account.name}</span>
        </div>
        <PageHeader
          title={account.name}
          actions={
            <AccountControls
              accountId={account.id}
              planTier={account.planTier}
              aiGenerationsCount={account.aiGenerationsCount}
            />
          }
        />
      </div>

      {/* Stats row */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Plan</span>
          <span className="mt-2 text-2xl font-bold text-[color:var(--color-text)]">{account.planTier}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Gens Left</span>
          <span className="mt-2 text-2xl font-bold text-[color:var(--color-text)]">{gensLeft} / {limit}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Campaigns</span>
          <span className="mt-2 text-2xl font-bold text-[color:var(--color-text)]">{account.campaigns.length}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Popups Generated</span>
          <span className="mt-2 text-2xl font-bold text-[color:var(--color-text)]">{totalPopups}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Impressions / Submissions</span>
          <span className="mt-2 text-2xl font-bold text-[color:var(--color-text)]">{totalImpressions} / {totalSubmissions}</span>
        </div>
      </section>

      {/* Account info */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)] mb-3">Team ({account.users.length})</h2>
          <div className="flex flex-col gap-2">
            {account.users.length === 0 && (
              <p className="text-sm text-[color:var(--color-text-secondary)]">No users on this account.</p>
            )}
            {account.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-[color:var(--color-text-primary)]">{u.name ?? u.email}</span>
                  <span className="text-[color:var(--color-text-secondary)] ml-2">{u.email}</span>
                </div>
                <Badge variant="neutral">{u.role}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)] mb-3">Websites ({account.websites.length})</h2>
          <div className="flex flex-col gap-2">
            {account.websites.length === 0 && (
              <p className="text-sm text-[color:var(--color-text-secondary)]">No websites connected.</p>
            )}
            {account.websites.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="text-[color:var(--color-text-primary)] truncate">{w.url}</span>
                <Badge variant={w.installVerified ? "success" : "warning"}>
                  {w.installVerified ? "verified" : "not verified"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rewards - same board account holders see on /rewards, editing this
          account's rewards instead of the superadmin's own. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">Rewards</h2>
        <RewardsBoard
          rows={rewardRows}
          codeLimits={rewardCodeLimits}
          campaigns={rewardCampaignOptions}
          overrideAccountId={account.id}
        />
      </section>

      {/* Campaigns & popups */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">Campaigns &amp; Popups</h2>
        <CampaignAdminList
          campaigns={campaignsForClient}
          statsByVariant={statsByVariant}
          leadsByVariant={leadsByVariant}
        />
      </section>
    </div>
  );
}
