"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { variantWinnerDeclared } from "@/lib/analytics";

type Design = {
  headline?: string;
  body?: string;
  ctaText?: string;
  primaryColor?: string;
};

export function VariantDetailActions({
  campaignId,
  variantId,
  isControl,
  isWinner,
  hasWinner,
  currentDesign,
  currentName,
  conversionRate,
}: {
  campaignId: string;
  variantId: string;
  isControl: boolean;
  isWinner: boolean;
  hasWinner: boolean;
  currentDesign: Design;
  currentName: string;
  conversionRate?: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Design & { name: string }>({
    name: currentName,
    ...currentDesign,
  });

  async function saveEdit() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/variants/${variantId}`,
        {
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
        },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? "Could not save variant");
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function declareWinner(winnerId: string | null) {
    setBusy(winnerId ?? "clear");
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winningVariantId: winnerId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? "Could not update winner");
      }
      if (winnerId) {
        variantWinnerDeclared({
          campaignId,
          variantId: winnerId,
          conversionRate: conversionRate ?? 0,
        });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function deleteVariant() {
    if (
      !confirm(
        "Delete this variant? This cannot be undone. All associated event data will be removed.",
      )
    )
      return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/variants/${variantId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? "Could not delete variant");
      }
      router.push(`/campaigns/${campaignId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150";

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-[color:var(--color-text-primary)]">
            Edit variant
          </p>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Variant name"
            className={inputClass}
          />
          <input
            value={draft.headline ?? ""}
            onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
            placeholder="Headline"
            className={inputClass}
          />
          <textarea
            value={draft.body ?? ""}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Body"
            rows={2}
            className={inputClass}
          />
          <input
            value={draft.ctaText ?? ""}
            onChange={(e) => setDraft({ ...draft, ctaText: e.target.value })}
            placeholder="CTA text"
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-[color:var(--color-text-secondary)]">
              Primary color
            </label>
            <input
              type="color"
              value={draft.primaryColor ?? "#165DFF"}
              onChange={(e) =>
                setDraft({ ...draft, primaryColor: e.target.value })
              }
              className="h-9 w-9 cursor-pointer rounded border border-[color:var(--color-border)]"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={saveEdit}
              className={busy === "save" ? "opacity-60" : ""}
            >
              {busy === "save" ? "Saving..." : "Save"}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {!hasWinner && (
            <Button
              variant="secondary"
              onClick={() => declareWinner(variantId)}
              className={busy === variantId ? "opacity-60" : ""}
            >
              {busy === variantId ? "Declaring..." : "Declare winner"}
            </Button>
          )}
          {isWinner && (
            <Button
              variant="secondary"
              onClick={() => declareWinner(null)}
              className={busy === "clear" ? "opacity-60" : ""}
            >
              {busy === "clear" ? "Clearing..." : "Clear winner"}
            </Button>
          )}
          {!isControl && !isWinner && (
            <Button
              variant="secondary"
              onClick={deleteVariant}
              className={
                busy === "delete"
                  ? "opacity-60 text-red-600"
                  : "text-red-600 hover:bg-red-50"
              }
            >
              {busy === "delete" ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
