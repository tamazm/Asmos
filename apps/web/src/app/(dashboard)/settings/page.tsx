import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
        Account, billing, and team settings land here.
      </div>
    </div>
  );
}
