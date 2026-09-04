import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { AccountSettingsForm } from "./AccountSettingsForm";
import { WebsiteManagement } from "./WebsiteManagement";
import { TeamManagement } from "./TeamManagement";
import { SettingsTabs } from "./SettingsTabs";
import { AutonomySettings } from "./AutonomySettings";
import { BillingControls } from "@/components/billing/BillingControls";
import { isStripeConfigured } from "@/lib/stripe/client";

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
    <div className="flex min-w-0 flex-col gap-6">
      <AccountSettingsForm
        initialName={account.name}
        initialIndustry={account.industry}
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

  // Show the read-only "managed by Shopify" state ONLY when Shopify is the
  // active billing rail — NOT merely because a store is connected. A web-first
  // merchant who paid by card and later connected Shopify keeps full Stripe
  // controls here (their rail is STRIPE, not SHOPIFY).
  const isShopify = account.billingSource === "SHOPIFY";

  const billingTab = (
    <BillingControls
      planTier={account.planTier}
      subscriptionStatus={account.subscriptionStatus}
      hasStripeCustomer={!!account.stripeCustomerId}
      isShopify={isShopify}
      isStripeConfigured={isStripeConfigured}
    />
  );

  const notificationsTab = (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-sm sm:p-6">
      <p className="mb-1 text-sm font-semibold text-[color:var(--color-text-primary)]">Notification preferences</p>
      <p className="mb-5 text-sm text-[color:var(--color-text-secondary)]">Choose which in-app and email alerts you receive.</p>
      <div className="flex flex-col gap-4">
        {[
          { id: "winner", label: "Variant winner declared", description: "When AI optimization identifies a clear winner.", defaultOn: true },
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
    <div className="flex min-w-0 flex-col gap-6">
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
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[color:var(--color-border)] py-3 last:border-0 sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">{label}</p>
        <p className="break-words text-xs text-[color:var(--color-text-secondary)]">{description}</p>
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
