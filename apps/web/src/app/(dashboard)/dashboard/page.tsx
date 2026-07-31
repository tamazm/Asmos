import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { RecentCampaignsBoard, type RecentCampaignRow } from "./RecentCampaignsBoard";

export default async function DashboardHomePage() {
  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: { variants: { include: { events: true } } },
  });

  const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;
  const allEvents = campaigns.flatMap((c) => c.variants.flatMap((v) => v.events));
  const impressions = allEvents.filter((e) => e.type === "IMPRESSION").length;
  const submissions = allEvents.filter((e) => e.type === "SUBMISSION").length;
  const emailsCaptured = await prisma.lead.count({
    where: {
      variant: { campaign: { accountId: account.id } },
      email: { not: null },
    },
  });
  const conversionRate =
    impressions > 0 ? ((submissions / impressions) * 100).toFixed(1) : "0.0";

  const rows: RecentCampaignRow[] = campaigns.slice(0, 5).map((campaign) => {
    const events = campaign.variants.flatMap((v) => v.events);
    const variants = campaign.variants.map((variant) => {
      const variantImpressions = variant.events.filter((e) => e.type === "IMPRESSION").length;
      const variantSubmissions = variant.events.filter((e) => e.type === "SUBMISSION").length;
      return {
        id: variant.id,
        name: variant.name,
        isControl: variant.isControl,
        isWinner: campaign.winningVariantId === variant.id,
        trafficPercent: variant.trafficPercent,
        impressions: variantImpressions,
        submissions: variantSubmissions,
        conversionRate: variantImpressions > 0 ? (variantSubmissions / variantImpressions) * 100 : 0,
      };
    });
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      impressions: events.filter((e) => e.type === "IMPRESSION").length,
      conversions: events.filter((e) => e.type === "SUBMISSION").length,
      variants,
    };
  });

  const STATS = [
    { label: "Active campaigns", value: activeCount.toString() },
    { label: "Impressions (total)", value: impressions.toLocaleString() },
    { label: "Emails captured", value: emailsCaptured.toLocaleString() },
    { label: "Conversion rate", value: `${conversionRate}%` },
  ];

  return (
    <div className="animate-page-enter space-y-7">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-secondary)]">
            Your campaigns, captures, and conversions at a glance.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 reveal-stagger is-visible">
        {STATS.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {campaigns.length === 0 ? (
        /* ── Welcome empty state ── */
        <div className="flex flex-col gap-4">
          {/* Welcome banner */}
          <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
            <div
              className="rounded-[1rem] bg-[color:var(--color-surface)] px-6 py-6"
              style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
            >
              <div className="flex items-start gap-4">
                {/* Double-Bezel icon */}
                <div className="shrink-0 rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[0.625rem] bg-[color:var(--color-primary-light)]"
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 9l9-6 9 6v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#165DFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 22V12h6v10" stroke="#165DFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-[color:var(--color-text-primary)] tracking-tight">
                    Welcome to Asmos
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                    Your store analysis is ready. Here&apos;s what to do next:
                  </p>
                </div>
              </div>

              {/* 3 numbered CTAs */}
              <div className="mt-5 flex flex-col gap-3">
                {[
                  {
                    num: 1,
                    label: "Create your first popup",
                    sub: "Set up an A/B tested lead-capture popup in minutes.",
                    href: "/campaigns/new",
                    cta: "Get started",
                    primary: true,
                  },
                  {
                    num: 2,
                    label: "Connect your store",
                    sub: "Link your Shopify or custom store to unlock full personalization.",
                    href: "/onboarding/connect-store",
                    cta: "Connect",
                    primary: false,
                  },
                  {
                    num: 3,
                    label: "View integrations",
                    sub: "Connect Klaviyo, webhooks, or your email platform to sync leads automatically.",
                    href: "/integrations",
                    cta: "Browse",
                    primary: false,
                  },
                ].map((item) => (
                  <div
                    key={item.num}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{
                          backgroundColor: item.primary ? "var(--color-primary)" : "var(--color-border)",
                          color: item.primary ? "#fff" : "var(--color-text-secondary)",
                        }}
                      >
                        {item.num}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{item.label}</p>
                        <p className="text-xs text-[color:var(--color-text-secondary)] truncate" style={{ textWrap: "pretty" } as React.CSSProperties}>{item.sub}</p>
                      </div>
                    </div>
                    <Link
                      href={item.href}
                      className="shrink-0 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 h-8 inline-flex items-center text-xs font-semibold text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-[background-color] duration-150"
                      style={item.primary ? { backgroundColor: "var(--color-primary)", color: "#fff", borderColor: "transparent" } : {}}
                    >
                      {item.cta}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <RecentCampaignsBoard rows={rows} />
      )}
    </div>
  );
}
