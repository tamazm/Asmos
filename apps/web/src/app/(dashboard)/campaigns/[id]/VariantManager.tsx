"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";

export type VariantStat = {
  id: string;
  name: string;
  isControl: boolean;
  isWinner: boolean;
  trafficPercent: number;
  impressions: number;
  submissions: number;
  conversionRate: number;
  confidenceVsControl: number | null;
  headline: string;
  body: string;
  primaryColor: string;
  ctaText: string;
};

export function VariantManager({
  campaignId,
  variants,
  hasWinner,
}: {
  campaignId: string;
  variants: VariantStat[];
  hasWinner: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<VariantStat>>({});
  // Once there's a real test running, traffic % is bandit-managed (see
  // lib/bandit.ts) and reallocates automatically on every widget event —
  // manual editing would just get overwritten on the next impression.
  const banditActive = !hasWinner && variants.length > 1;

  function startEdit(variant: VariantStat) {
    setEditingId(variant.id);
    setDraft(variant);
    setError(null);
  }

  async function saveEdit(variantId: string) {
    setBusy(variantId);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          design: {
            headline: draft.headline,
            body: draft.body,
            primaryColor: draft.primaryColor,
            ctaText: draft.ctaText,
          },
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not save variant");
      }
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function addVariant() {
    setBusy("new");
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/variants`, { method: "POST" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not add variant");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function deleteVariant(variantId: string) {
    setBusy(variantId);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/variants/${variantId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not delete variant");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function declareWinner(variantId: string | null) {
    setBusy(variantId ?? "clear");
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winningVariantId: variantId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not update winner");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {variants.map((variant) => (
          <div
            key={variant.id}
            className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[color:var(--color-text-primary)]">
                  {variant.name}
                </p>
                {variant.isControl && <Badge variant="neutral">Control</Badge>}
                {variant.isWinner && <Badge variant="success">Winner</Badge>}
              </div>
              <span className="text-xs text-[color:var(--color-text-secondary)]">
                {variant.trafficPercent}% traffic{banditActive ? " · auto" : ""}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-[color:var(--color-text-primary)]">
                  {variant.impressions.toLocaleString()}
                </p>
                <p className="text-xs text-[color:var(--color-text-secondary)]">Impressions</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[color:var(--color-text-primary)]">
                  {variant.submissions.toLocaleString()}
                </p>
                <p className="text-xs text-[color:var(--color-text-secondary)]">Submissions</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[color:var(--color-text-primary)]">
                  {variant.conversionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-[color:var(--color-text-secondary)]">Conv. rate</p>
              </div>
            </div>

            {!variant.isControl && (
              <div>
                <p className="mb-1 text-xs text-[color:var(--color-text-secondary)]">
                  Confidence vs. control
                </p>
                {variant.confidenceVsControl === null ? (
                  <p className="text-xs text-[color:var(--color-text-secondary)]">
                    Not enough data yet
                  </p>
                ) : (
                  <ConfidenceBar percent={variant.confidenceVsControl} />
                )}
              </div>
            )}

            {editingId === variant.id ? (
              <div className="flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-3">
                <input
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Variant name"
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
                />
                <input
                  value={draft.headline ?? ""}
                  onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                  placeholder="Headline"
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
                />
                <textarea
                  value={draft.body ?? ""}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="Body"
                  rows={2}
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
                />
                <input
                  value={draft.ctaText ?? ""}
                  onChange={(e) => setDraft({ ...draft, ctaText: e.target.value })}
                  placeholder="CTA text"
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.primaryColor ?? "#6366f1"}
                    onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded border border-[color:var(--color-border)]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => saveEdit(variant.id)}
                    className={busy === variant.id ? "opacity-60" : ""}
                  >
                    {busy === variant.id ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 border-t border-[color:var(--color-border)] pt-3">
                <Button variant="secondary" onClick={() => startEdit(variant)}>
                  Edit
                </Button>
                {!hasWinner && variants.length > 1 && (
                  <Button
                    variant="secondary"
                    onClick={() => declareWinner(variant.id)}
                    className={busy === variant.id ? "opacity-60" : ""}
                  >
                    Declare winner
                  </Button>
                )}
                {variant.isWinner && (
                  <Button
                    variant="secondary"
                    onClick={() => declareWinner(null)}
                    className={busy === "clear" ? "opacity-60" : ""}
                  >
                    Clear winner
                  </Button>
                )}
                {!variant.isControl && !variant.isWinner && (
                  <Button
                    variant="secondary"
                    onClick={() => deleteVariant(variant.id)}
                    className={busy === variant.id ? "opacity-60" : ""}
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {variants.length < 5 && (
        <Button
          variant="secondary"
          onClick={addVariant}
          className={`w-fit ${busy === "new" ? "opacity-60" : ""}`}
        >
          {busy === "new" ? "Adding…" : "Add Variant"}
        </Button>
      )}
    </div>
  );
}
