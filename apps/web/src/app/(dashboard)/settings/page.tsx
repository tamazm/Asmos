import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "./AccountSettingsForm";
import { WebsiteManagement } from "./WebsiteManagement";
import { TeamManagement } from "./TeamManagement";

export default async function SettingsPage() {
  const account = await getOrCreateAccount();
  const [members, invites] = await Promise.all([
    prisma.user.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "asc" } }),
    prisma.invite.findMany({
      where: { accountId: account.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />

      <AccountSettingsForm
        initialName={account.name}
        initialIndustry={account.industry}
        initialBrandColor={account.brandColor}
        initialGdpr={account.consentGdprEnabled}
        initialCcpa={account.consentCcpaEnabled}
        initialBannerText={account.consentBannerText}
      />

      <WebsiteManagement
        websites={account.websites.map((w) => ({
          id: w.id,
          url: w.url,
          installVerified: w.installVerified,
        }))}
      />

      <TeamManagement members={members} invites={invites} />

      <div className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <h2 className="text-sm font-medium text-[color:var(--color-text-primary)]">
          Billing & subscription
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[color:var(--color-text-secondary)]">
            Current plan:
          </span>
          <Badge variant="neutral">{account.planTier}</Badge>
          <Badge
            variant={account.subscriptionStatus === "ACTIVE" ? "success" : "neutral"}
          >
            {account.subscriptionStatus}
          </Badge>
        </div>
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          Plan upgrades, usage limits, and invoice history land here once
          billing (Stripe) is wired up.
        </p>
      </div>
    </div>
  );
}
