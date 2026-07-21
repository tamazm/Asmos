import { PageHeader } from "@/components/ui/PageHeader";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" />
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
        Campaign and site-wide analytics land here once tracking is wired up.
      </div>
    </div>
  );
}
