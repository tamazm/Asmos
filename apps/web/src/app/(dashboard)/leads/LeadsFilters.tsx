"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type CampaignOption = { id: string; name: string };

export function LeadsFilters({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const campaignId = searchParams.get("campaignId") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const exportParams = new URLSearchParams(searchParams.toString());

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
          Campaign
        </label>
        <select
          value={campaignId}
          onChange={(e) => updateParam("campaignId", e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
          From
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => updateParam("from", e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
          To
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => updateParam("to", e.target.value)}
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
      </div>

      <a
        href={`/api/leads/export?${exportParams.toString()}`}
        className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)]"
      >
        Export CSV
      </a>
    </div>
  );
}
