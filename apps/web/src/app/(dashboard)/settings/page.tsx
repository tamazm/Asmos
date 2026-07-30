import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "./AccountSettingsForm";
import { WebsiteManagement } from "./WebsiteManagement";
import { TeamManagement } from "./TeamManagement";
import { SettingsTabs } from "./SettingsTabs";
import { AutonomySettings } from "./AutonomySettings";

export default async function SettingsPage() {
  const account = await getOrCreateAccount();
  const [members, invites] = await Promise.all([
    prisma.user.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "asc" } }),
    prisma.invite.findMany({
      where: { accountId: account.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const accountTab = (
    <div className="flex flex-col gap-6">
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
    </div>
  );

  const teamTab = (
    <TeamManagement members={members} invites={invites} />
  );

  const billingTab = (
    <div className="flex flex-col gap-6">
      {/* Current plan */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Current plan</p>
            <p className="mt-1 text-2xl font-bold text-[color:var(--color-text-primary)] capitalize">{account.planTier.toLowerCase()}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={account.subscriptionStatus === "ACTIVE" || account.subscriptionStatus === "TRIALING" ? "success" : "neutral"}>
                {account.subscriptionStatus}
              </Badge>
            </div>
          </div>
          <button
            disabled
            className="rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
          >
            Upgrade plan
          </button>
        </div>
      </div>

      {/* Plan comparison */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { name: "Starter", price: "$29", campaigns: 3, impressions: "10k/mo", features: ["3 campaigns", "10k impressions/mo", "Basic analytics", "Email support"] },
          { name: "Growth", price: "$79", campaigns: 10, impressions: "100k/mo", features: ["10 campaigns", "100k impressions/mo", "Advanced analytics", "A/B testing", "Priority support"], highlighted: true },
          { name: "Scale", price: "$199", campaigns: 999, impressions: "1M/mo", features: ["Unlimited campaigns", "1M impressions/mo", "Custom domains", "API access", "Dedicated support"] },
        ].map((plan) => (
          <div
            key={plan.name}
            className={[
              "flex flex-col gap-3 rounded-2xl border p-5",
              plan.highlighted
                ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]"
                : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
            ].join(" ")}
          >
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{plan.name}</p>
              <p className="mt-0.5 text-xl font-bold text-[color:var(--color-text-primary)] tabular-nums">{plan.price}<span className="text-sm font-normal text-[color:var(--color-text-secondary)]">/mo</span></p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-[color:var(--color-text-secondary)]">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8l3.5 3.5L13 4.5" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              disabled
              className="mt-auto rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-xs font-medium text-[color:var(--color-text-secondary)] opacity-50 cursor-not-allowed"
            >
              Coming soon
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-center text-[color:var(--color-text-secondary)]">
        Billing is managed via Stripe. Payment setup coming soon.
      </p>
    </div>
  );

  const notificationsTab = (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
      <p className="mb-1 text-sm font-semibold text-[color:var(--color-text-primary)]">Notification preferences</p>
      <p className="mb-5 text-sm text-[color:var(--color-text-secondary)]">Choose which in-app and email alerts you receive.</p>
      <div className="flex flex-col gap-4">
        {[
          { id: "winner", label: "Variant winner declared", description: "When the bandit algorithm identifies a clear winner.", defaultOn: true },
          { id: "install", label: "Install not detected", description: "If your widget snippet is not found during verification.", defaultOn: true },
          { id: "campaign_live", label: "Campaign went live", description: "When a campaign is first published or reactivated.", defaultOn: false },
          { id: "weekly_digest", label: "Weekly performance digest", description: "A weekly summary of impressions and conversions.", defaultOn: true },
          { id: "new_lead", label: "New lead milestone", description: "When you hit 100, 500, or 1000 leads.", defaultOn: false },
        ].map((pref) => (
          <NotificationToggle key={pref.id} {...pref} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />
      <SettingsTabs
        tabs={[
          { key: "account", label: "Account", content: accountTab },
          { key: "team", label: "Team", content: teamTab },
          { key: "billing", label: "Billing", content: billingTab },
          { key: "autonomy", label: "Autonomy", content: <AutonomySettings /> },
          { key: "notifications", label: "Notifications", content: notificationsTab },
        ]}
      />
    </div>
  );
}

// Server component can't have hooks -- inline a minimal toggle here for the notification list
// It's rendered server-side but used as a pure presentational component
// Client interaction will be handled by SettingsTabs
function NotificationToggle({
  id,
  label,
  description,
  defaultOn,
}: {
  id: string;
  label: string;
  description: string;
  defaultOn: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[color:var(--color-border)] last:border-0">
      <div>
        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">{label}</p>
        <p className="text-xs text-[color:var(--color-text-secondary)]">{description}</p>
      </div>
      <div
        className={[
          "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
          defaultOn ? "bg-[color:var(--color-primary)]" : "bg-[color:var(--color-border)]",
        ].join(" ")}
        role="switch"
        aria-checked={defaultOn}
        aria-label={label}
        tabIndex={0}
      >
        <span
          className={[
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            defaultOn ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </div>
    </div>
  );
}
