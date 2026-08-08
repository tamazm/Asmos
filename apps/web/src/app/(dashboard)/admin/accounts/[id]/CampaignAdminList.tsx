"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { deleteCampaign, retryCampaign } from "@/app/(dashboard)/superadmin/actions";

type VariantStats = Record<string, number>;

type VariantItem = {
  id: string;
  name: string;
  isControl: boolean;
  status: string;
  trafficPercent: number;
  testAxis: string | null;
  hypothesis: string | null;
  motivatingMetric: string | null;
  design: unknown;
  generatedCode: string | null;
};

type CampaignItem = {
  id: string;
  name: string;
  type: string;
  status: string;
  lastError: string | null;
  createdAt: string;
  website: { url: string } | null;
  variants: VariantItem[];
};

function statusBadgeVariant(status: string): "success" | "warning" | "neutral" | "error" {
  if (status === "ACTIVE" || status === "WINNER") return "success";
  if (status === "GENERATING") return "warning";
  if (status === "FAILED" || status === "ELIMINATED") return "error";
  return "neutral";
}

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function extractDesign(design: unknown): { headline?: string; body?: string; ctaText?: string; primaryColor?: string } {
  if (!design || typeof design !== "object") return {};
  const d = design as Record<string, unknown>;
  return {
    headline: typeof d.headline === "string" ? d.headline : undefined,
    body: typeof d.body === "string" ? d.body : undefined,
    ctaText: typeof d.ctaText === "string" ? d.ctaText : undefined,
    primaryColor: typeof d.primaryColor === "string" ? d.primaryColor : undefined,
  };
}

function VariantRow({ variant, stats, leadCount }: { variant: VariantItem; stats: VariantStats; leadCount: number }) {
  const [expanded, setExpanded] = useState(false);
  const impressions = stats.IMPRESSION ?? 0;
  const submissions = stats.SUBMISSION ?? 0;
  const dismissed = stats.DISMISSED ?? 0;
  const design = extractDesign(variant.design);

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-medium text-sm text-[color:var(--color-text-primary)]">{variant.name}</span>
            {variant.isControl && <Badge variant="neutral">control</Badge>}
            <Badge variant={statusBadgeVariant(variant.status)}>{variant.status}</Badge>
            {variant.testAxis && <Badge variant="neutral">axis: {variant.testAxis}</Badge>}
            <span className="text-xs text-[color:var(--color-text-secondary)]">{variant.trafficPercent}% traffic</span>
          </div>
          {variant.hypothesis && (
            <p className="text-xs text-[color:var(--color-text-secondary)] mb-1">{variant.hypothesis}</p>
          )}
          {design.headline && (
            <p className="text-xs text-[color:var(--color-text-secondary)] truncate">
              &ldquo;{design.headline}&rdquo; {design.ctaText ? `→ ${design.ctaText}` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 text-xs text-[color:var(--color-text-secondary)] whitespace-nowrap">
          <span>{impressions.toLocaleString()} impressions</span>
          <span>{submissions.toLocaleString()} submissions ({pct(submissions, impressions)})</span>
          <span>{dismissed.toLocaleString()} dismissed ({pct(dismissed, impressions)})</span>
          <span>{leadCount.toLocaleString()} leads captured</span>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="self-start rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-sunken)]"
        >
          {expanded ? "Hide preview" : "Show preview"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[color:var(--color-border)] p-4 bg-[color:var(--color-surface-sunken)]">
          {variant.generatedCode ? (
            <iframe
              srcDoc={variant.generatedCode}
              title={`Preview — ${variant.name}`}
              className="w-full rounded-lg border-0 bg-white"
              style={{ height: 520 }}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <p className="text-sm text-[color:var(--color-text-secondary)]">No generated popup code for this variant.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  statsByVariant,
  leadsByVariant,
}: {
  campaign: CampaignItem;
  statsByVariant: Record<string, VariantStats>;
  leadsByVariant: Record<string, number>;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // deleteCampaign/retryCampaign only revalidate "/superadmin" (see
  // superadmin/actions.ts) — they don't know about this account page's
  // path. router.refresh() re-runs this route's server component with
  // fresh data regardless, so the list updates without needing every
  // action to know every page that might display its result.
  const handleDelete = async () => {
    if (!confirm(`Permanently delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await deleteCampaign(campaign.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setLoading(true);
    try {
      await retryCampaign(campaign.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to retry campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[color:var(--color-text-primary)]">{campaign.name}</h3>
            <Badge variant={statusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
            <Badge variant="neutral">{campaign.type}</Badge>
          </div>
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            {campaign.website?.url ?? "No domain"} · created {new Date(campaign.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "FAILED" && (
            <button
              disabled={loading}
              onClick={handleRetry}
              className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50"
            >
              Retry
            </button>
          )}
          <button
            disabled={loading}
            onClick={handleDelete}
            className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {campaign.lastError && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded whitespace-pre-wrap max-h-32 overflow-y-auto">
          {campaign.lastError}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {campaign.variants.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-secondary)]">No popups generated yet.</p>
        ) : (
          campaign.variants.map((v) => (
            <VariantRow
              key={v.id}
              variant={v}
              stats={statsByVariant[v.id] ?? {}}
              leadCount={leadsByVariant[v.id] ?? 0}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function CampaignAdminList({
  campaigns,
  statsByVariant,
  leadsByVariant,
}: {
  campaigns: CampaignItem[];
  statsByVariant: Record<string, VariantStats>;
  leadsByVariant: Record<string, number>;
}) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
        No campaigns yet for this account.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} statsByVariant={statsByVariant} leadsByVariant={leadsByVariant} />
      ))}
    </div>
  );
}
