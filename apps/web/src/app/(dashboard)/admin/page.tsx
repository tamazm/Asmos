import { currentUser } from "@/lib/auth-adapter";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccountsTable } from "@/components/admin/AccountsTable";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  
  // Strictly enforce superadmin on backend page load
  if (email !== "zaridzezurabi@gmail.com" && email !== "test@asmos.dev") {
    redirect("/dashboard");
  }

  // Fetch Global Platform Economics
  const [
    totalAccounts,
    totalCampaigns,
    totalAIGenerations,
    impressionsAgg,
    submissionsAgg,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.campaign.count(),
    prisma.account.aggregate({ _sum: { aiGenerationsCount: true } }),
    prisma.campaignEvent.count({ where: { type: "IMPRESSION" } }),
    prisma.campaignEvent.count({ where: { type: "SUBMISSION" } }),
  ]);

  // Fetch all accounts for table
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      industry: true,
      planTier: true,
      aiGenerationsCount: true,
      createdAt: true,
    }
  });

  const totalGens = totalAIGenerations._sum.aiGenerationsCount ?? 0;

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <PageHeader 
        title="Superadmin Dashboard"
        action={
          <Link href="/admin/logs" className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
            View Error Logs →
          </Link>
        } 
      />

      {/* Global Economics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[color:var(--color-text)]">Global Platform Economics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          
          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total Accounts</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{totalAccounts.toLocaleString()}</span>
          </div>

          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total Campaigns</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{totalCampaigns.toLocaleString()}</span>
          </div>

          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total AI Generations</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{totalGens.toLocaleString()}</span>
          </div>

          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total Impressions</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{impressionsAgg.toLocaleString()}</span>
          </div>

          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total Submissions</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{submissionsAgg.toLocaleString()}</span>
          </div>

        </div>
      </section>

      {/* Accounts Management */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">Accounts Management</h2>
        </div>
        <AccountsTable accounts={accounts} />
      </section>

    </div>
  );
}
