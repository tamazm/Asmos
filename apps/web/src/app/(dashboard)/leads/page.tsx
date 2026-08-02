import { authProtect } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import LeadsClient from "@/components/leads/LeadsClient";

export default async function LeadsPage() {
  await authProtect();
  const account = await getOrCreateAccount();

  const leads = await prisma.lead.findMany({
    where: {
      variant: {
        campaign: {
          accountId: account.id,
        },
      },
    },
    include: {
      variant: {
        include: {
          campaign: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializedLeads = leads.map((l: any) => ({
    id: l.id,
    email: l.email || "-",
    name: l.name || "-",
    campaignName: l.variant.campaign.name,
    variantName: l.variant.name,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            Captured Leads
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            Emails and phone numbers captured by your active campaigns.
          </p>
        </div>
      </div>
      <LeadsClient initialLeads={serializedLeads} />
    </div>
  );
}
