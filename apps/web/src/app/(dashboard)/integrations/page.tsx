import { PageHeader } from "@/components/ui/PageHeader";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Integrations" />
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
        Connect Mailchimp, Klaviyo, Shopify, and Zapier here in a later phase.
      </div>
    </div>
  );
}
