"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export type InsightRow = {
  id: string;
  summary: string;
  suggestedVariant: {
    name: string;
    rationale: string;
    design: { headline: string; body: string; primaryColor: string; ctaText: string };
    formFields: string[];
    targeting: { trigger: string; delaySeconds: number | null };
    rewards: { label: string; type: string; couponCode: string | null; weight: number }[];
  } | null;
  createdAt: string;
};

export function InsightsPanel({
  campaignId,
  insights,
}: {
  campaignId: string;
  insights: InsightRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/insights`, { method: "POST" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not generate report");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function addSuggestedVariant(insight: InsightRow) {
    if (!insight.suggestedVariant) return;
    setBusy(insight.id);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: insight.suggestedVariant.name,
          design: insight.suggestedVariant.design,
          formFields: insight.suggestedVariant.formFields,
          targeting: insight.suggestedVariant.targeting,
          rewards: insight.suggestedVariant.rewards,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not add variant");
      }
      setAddedIds((prev) => new Set(prev).add(insight.id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          Generated automatically every two weeks. The bandit already reallocates traffic live -
          these reports explain why, and occasionally propose a new variant to test.
        </p>
        <Button
          onClick={generate}
          className={`w-fit shrink-0 ${busy === "generate" ? "opacity-60" : ""}`}
        >
          {busy === "generate" ? (
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
              Generating...
            </span>
          ) : (
            "Generate report now"
          )}
        </Button>
      </div>

      {insights.length === 0 && (
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          No reports yet — generate one once the campaign has some traffic.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
          >
            <span className="text-xs text-[color:var(--color-text-secondary)]">
              {new Date(insight.createdAt).toLocaleString()}
            </span>
            <p className="text-sm text-[color:var(--color-text-primary)]">{insight.summary}</p>

            {insight.suggestedVariant && (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">Suggested variant</Badge>
                  <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
                    {insight.suggestedVariant.name}
                  </p>
                </div>
                <p className="text-xs text-[color:var(--color-text-secondary)]">
                  {insight.suggestedVariant.rationale}
                </p>
                <p className="text-sm text-[color:var(--color-text-primary)]">
                  &ldquo;{insight.suggestedVariant.design.headline}&rdquo;
                </p>
                <Button
                  variant="secondary"
                  onClick={() => addSuggestedVariant(insight)}
                  disabled={addedIds.has(insight.id)}
                  className={`w-fit ${busy === insight.id ? "opacity-60" : ""}`}
                >
                  {addedIds.has(insight.id)
                    ? "Added"
                    : busy === insight.id
                      ? "Adding…"
                      : "Add as new variant"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
