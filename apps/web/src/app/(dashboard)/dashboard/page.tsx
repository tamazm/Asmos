import { getOrCreateAccount } from "@/lib/account";
import { getDashboardMetrics } from "@/lib/dashboardMetrics";
import { ActivePopupsCard } from "@/components/dashboard/ActivePopupsCard";
import { ConversionGoalCard } from "@/components/dashboard/ConversionGoalCard";
import { KnockoutBracketCard } from "@/components/dashboard/KnockoutBracketCard";
import { LeadCaptureCard } from "@/components/dashboard/LeadCaptureCard";
import { PopupPerformanceCard } from "@/components/dashboard/PopupPerformanceCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { RecentPerformanceTable } from "@/components/dashboard/RecentPerformanceTable";
import { TopPopupsCard } from "@/components/dashboard/TopPopupsCard";
import { DashboardEmptyState } from "./DashboardEmptyState";

export default async function DashboardHomePage() {
  const account = await getOrCreateAccount();
  const metrics = await getDashboardMetrics(account.id);

  // The page title lives in the top bar next to the account avatar, so the
  // heading here is for assistive tech and document outline only.
  const heading = <h1 className="sr-only">Dashboard</h1>;

  if (!metrics.hasCampaigns) {
    return (
      <div className="animate-page-enter">
        {heading}
        <DashboardEmptyState />
      </div>
    );
  }

  return (
    <div className="animate-page-enter space-y-4">
      {heading}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1.55fr]">
        <PopupPerformanceCard totals={metrics.totals} windowDays={metrics.windowDays} />
        <ActivePopupsCard active={metrics.active} />
        <div className="grid lg:col-span-2 xl:col-span-1">
          <KnockoutBracketCard bracket={metrics.bracket} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LeadCaptureCard
          series={metrics.leadSeries}
          totals={metrics.totals}
          windowDays={metrics.windowDays}
        />
        <TopPopupsCard campaigns={metrics.topByLeads} />
        <ConversionGoalCard goal={metrics.goal} />
        <RecentActivityCard activity={metrics.activity} />
      </div>

      <RecentPerformanceTable rows={metrics.recent} />
    </div>
  );
}
