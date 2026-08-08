"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export type RewardRow = {
  id: string;
  label: string;
  category: string | null;
  description: string | null;
  type: string;
  couponCode: string | null;
  weight: number;
  active: boolean;
  maxRedemptions: number | null;
  redemptionsCount: number;
  campaignId: string;
  campaignName: string;
  totalCodes: number;
  usedCodes: number;
};

export type CampaignOption = { id: string; name: string };

// Mirrors the backend caps in api/rewards/[id]/codes/route.ts (see
// lib/limits.ts). Computed server-side in page.tsx from the account's real
// plan tier + current code count, so the UI always reflects what the
// backend will actually accept instead of a hardcoded number.
export type CodeLimits = {
  planTier: string;
  generateCap: number;
  importCap: number;
  totalCap: number;
  totalExisting: number;
};

const UNCATEGORIZED = "Uncategorized";
const REWARD_TYPES = ["COUPON", "DISCOUNT_PERCENT", "DISCOUNT_FIXED", "FREE_SHIPPING", "GIFT"] as const;

function typeLabel(type: string): string {
  return type.replace(/_/g, " ").toLowerCase();
}

export function RewardsBoard({
  rows,
  codeLimits,
  campaigns,
}: {
  rows: RewardRow[];
  codeLimits: CodeLimits;
  campaigns: CampaignOption[];
}) {
  const [showNew, setShowNew] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, RewardRow[]>();
    for (const row of rows) {
      const key = row.category?.trim() || UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      {/* A popup never shows without a redeemable reward attached (see
          generateCampaign.ts / api/widget/config/route.ts) — new campaigns
          get one automatically, but this is where to add more, change
          quantities, or hand a reward off to a different campaign. */}
      <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-text-secondary)]">
        A popup won&apos;t show if its campaign has no active, unclaimed reward. Every new campaign is
        stocked automatically — use this page to top up codes, pause/resize a reward, or move one to a
        different campaign.
      </div>

      <div>
        <Button onClick={() => setShowNew((v) => !v)}>{showNew ? "Cancel" : "+ New reward"}</Button>
      </div>
      {showNew && <NewRewardForm campaigns={campaigns} onDone={() => setShowNew(false)} />}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-20 text-center">
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">No rewards yet</p>
          <p className="mt-1 max-w-xs text-sm text-[color:var(--color-text-secondary)]">
            Rewards are created automatically with each campaign, or add one manually above.
          </p>
          <Link
            href="/campaigns"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 h-10 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
          >
            Go to Pop-ups
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, categoryRows]) => (
            <div key={category} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
                {category}
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {categoryRows.map((row) => (
                  <RewardCard key={row.id} row={row} codeLimits={codeLimits} campaigns={campaigns} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewRewardForm({ campaigns, onDone }: { campaigns: CampaignOption[]; onDone: () => void }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [type, setType] = useState<(typeof REWARD_TYPES)[number]>("FREE_SHIPPING");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!campaignId) {
      setError("Pick a campaign first.");
      return;
    }
    if (!label.trim()) {
      setError("Give the reward a label.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          type,
          label: label.trim(),
          description: description.trim() || undefined,
          maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Failed to create reward");
      }
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create reward");
    } finally {
      setBusy(false);
    }
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-sm text-[color:var(--color-text-secondary)]">
        Create a campaign first — rewards need a campaign to belong to.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">Campaign</label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof REWARD_TYPES)[number])}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          >
            {REWARD_TYPES.map((t) => (
              <option key={t} value={t}>{typeLabel(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. VIP Free Shipping"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
            Redemption limit <span className="font-normal">(blank = unlimited)</span>
          </label>
          <input
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Unlimited"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
            Description <span className="font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shown internally only — not to visitors"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy} className={busy ? "opacity-60" : ""}>
          {busy ? "Creating…" : "Create reward"}
        </Button>
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
      {type === "COUPON" && (
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          After creating, use &quot;Generate promo codes&quot; on the new card to stock it — a COUPON
          reward with no codes and no shared code won&apos;t be handed out.
        </p>
      )}
    </div>
  );
}

function RewardCard({
  row,
  codeLimits,
  campaigns,
}: {
  row: RewardRow;
  codeLimits: CodeLimits;
  campaigns: CampaignOption[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [prefix, setPrefix] = useState("");

  // Real per-tier caps from the backend (lib/limits.ts), not a hardcoded
  // "max 1000" — the account-wide remaining budget is often the tighter of
  // the two limits once an account has existing codes, so the generate
  // panel's actual ceiling is whichever is smaller.
  const remainingBudget = Math.max(0, codeLimits.totalCap - codeLimits.totalExisting);
  const generateMax = Math.max(1, Math.min(codeLimits.generateCap, remainingBudget || 1));
  const [count, setCount] = useState(() => Math.min(50, generateMax));

  const available = row.totalCodes - row.usedCodes;
  const usesCodePool = row.type === "COUPON";

  function clampCount(raw: number) {
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.min(generateMax, Math.floor(raw)));
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const text = await file.text();
      const codes = text
        .split(/\r?\n/)
        .map((line) => line.split(",")[0]?.trim())
        .filter((c): c is string => Boolean(c) && c.toLowerCase() !== "code");

      if (codes.length > codeLimits.importCap) {
        throw new Error(
          `File has ${codes.length.toLocaleString()} codes, which is over the ${codeLimits.importCap.toLocaleString()}-per-import limit on the ${codeLimits.planTier} plan.`,
        );
      }
      if (codes.length > remainingBudget) {
        throw new Error(
          `Only ${remainingBudget.toLocaleString()} more code(s) can be added on the ${codeLimits.planTier} plan (limit ${codeLimits.totalCap.toLocaleString()} total).`,
        );
      }

      const res = await fetch(`/api/rewards/${row.id}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import", codes }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Import failed");
      }
      const data = await res.json();
      setFeedback(`Imported ${data.created} new code(s)${data.created < data.requested ? ` (${data.requested - data.created} duplicate/skipped)` : ""}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/rewards/${row.id}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate", prefix, count }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Generation failed");
      }
      const data = await res.json();
      setFeedback(`Generated ${data.created} code(s).`);
      setShowGenerate(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteReward() {
    if (!confirm(`Delete "${row.label}"? This also removes its promo codes. This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Delete failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[color:var(--color-text-primary)]">{row.label}</p>
            <Badge variant="neutral">{typeLabel(row.type)}</Badge>
            {!row.active && <Badge variant="neutral">paused</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">
            {row.campaignName}
          </p>
          {row.description && (
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{row.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => setShowEdit((v) => !v)}>
            {showEdit ? "Close" : "Edit"}
          </Button>
        </div>
      </div>

      {showEdit && (
        <EditRewardPanel
          row={row}
          campaigns={campaigns}
          busy={busy}
          setBusy={setBusy}
          onDeleted={handleDeleteReward}
          onError={setError}
          onFeedback={setFeedback}
        />
      )}

      <div className="flex items-center gap-4 rounded-lg bg-[color:var(--color-surface-sunken)] px-3 py-2 text-sm flex-wrap">
        {usesCodePool ? (
          <>
            <span className="text-[color:var(--color-text-primary)] font-semibold">{available}</span>
            <span className="text-[color:var(--color-text-secondary)]">available</span>
            <span className="text-[color:var(--color-border)]">·</span>
            <span className="text-[color:var(--color-text-primary)] font-semibold">{row.usedCodes}</span>
            <span className="text-[color:var(--color-text-secondary)]">used</span>
            {row.totalCodes === 0 && row.couponCode && (
              <span className="ml-auto text-xs text-[color:var(--color-text-secondary)]">
                Shared code: {row.couponCode}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-[color:var(--color-text-primary)] font-semibold">{row.redemptionsCount}</span>
            <span className="text-[color:var(--color-text-secondary)]">redeemed</span>
            <span className="text-[color:var(--color-border)]">·</span>
            <span className="text-[color:var(--color-text-primary)] font-semibold">
              {row.maxRedemptions === null ? "Unlimited" : row.maxRedemptions - row.redemptionsCount}
            </span>
            <span className="text-[color:var(--color-text-secondary)]">
              {row.maxRedemptions === null ? "" : "remaining"}
            </span>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {feedback && <p className="text-xs text-[color:var(--color-primary)]">{feedback}</p>}

      {usesCodePool && (
        showGenerate ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] p-3">
            <div className="flex items-center gap-2">
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Prefix (e.g. SUMMER)"
                className="min-w-0 flex-1 rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
              />
              <input
                type="number"
                min={1}
                max={generateMax}
                value={count}
                onChange={(e) => setCount(clampCount(Number(e.target.value)))}
                onBlur={(e) => setCount(clampCount(Number(e.target.value)))}
                className="w-20 rounded-lg border border-[color:var(--color-border)] px-2 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
              />
            </div>
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Up to {generateMax.toLocaleString()} per request on the {codeLimits.planTier} plan ·{" "}
              {remainingBudget.toLocaleString()} of {codeLimits.totalCap.toLocaleString()} total codes remaining
              account-wide.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={busy || remainingBudget <= 0}
                className={busy || remainingBudget <= 0 ? "opacity-60" : ""}
              >
                {busy ? "Generating…" : `Generate ${count} codes`}
              </Button>
              <Button variant="secondary" onClick={() => setShowGenerate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-t border-[color:var(--color-border)] pt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleImportFile}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || remainingBudget <= 0}
              className={busy || remainingBudget <= 0 ? "opacity-60" : ""}
            >
              Bulk import (CSV)
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowGenerate(true)}
              disabled={busy || remainingBudget <= 0}>
              Generate promo codes
            </Button>
            <a
              href={`/api/rewards/${row.id}/codes/export?status=all`}
              className="inline-flex items-center justify-center rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
            >
              Export (CSV)
            </a>
            <Button variant="secondary" onClick={() => setShowCodes((v) => !v)}>
              {showCodes ? "Hide codes" : "Manage codes"}
            </Button>
          </div>
        )
      )}

      {usesCodePool && showCodes && (
        <ManageCodesPanel rewardId={row.id} onChanged={() => router.refresh()} />
      )}
    </div>
  );
}

function EditRewardPanel({
  row,
  campaigns,
  busy,
  setBusy,
  onDeleted,
  onError,
  onFeedback,
}: {
  row: RewardRow;
  campaigns: CampaignOption[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDeleted: () => void;
  onError: (e: string | null) => void;
  onFeedback: (f: string | null) => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(row.label);
  const [description, setDescription] = useState(row.description ?? "");
  const [category, setCategory] = useState(row.category ?? "");
  const [weight, setWeight] = useState(String(row.weight));
  const [maxRedemptions, setMaxRedemptions] = useState(row.maxRedemptions === null ? "" : String(row.maxRedemptions));
  const [active, setActive] = useState(row.active);
  const [campaignId, setCampaignId] = useState(row.campaignId);

  async function save() {
    setBusy(true);
    onError(null);
    onFeedback(null);
    try {
      const res = await fetch(`/api/rewards/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          weight: Number(weight) || 0,
          maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
          active,
          campaignId,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Save failed");
      }
      onFeedback("Saved.");
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-[color:var(--color-border)] p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Welcome offers"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
            Win weight <span className="font-normal">(for multi-reward campaigns)</span>
          </label>
          <input
            type="number"
            min={0}
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
            Redemption limit <span className="font-normal">(blank = unlimited)</span>
          </label>
          <input
            type="number"
            min={row.redemptionsCount || 1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Unlimited"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
            Assigned campaign
          </label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-[color:var(--color-text-primary)]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-[color:var(--color-border)]" />
          Active (eligible to be shown/redeemed)
        </label>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} className={busy ? "opacity-60" : ""}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="secondary" onClick={onDeleted} disabled={busy}>
          Delete reward
        </Button>
      </div>
    </div>
  );
}

type CodeRow = { id: string; code: string; usedAt: string | null; createdAt: string };

function ManageCodesPanel({ rewardId, onChanged }: { rewardId: string; onChanged: () => void }) {
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${rewardId}/codes?status=all`);
      if (!res.ok) throw new Error("Could not load codes");
      const data = await res.json();
      setCodes(data.codes ?? []);
      setTruncated(Boolean(data.truncated));
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load codes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loaded && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, loading]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!codes) return;
    setSelected((prev) => (prev.size === codes.length ? new Set() : new Set(codes.map((c) => c.id))));
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected code(s)?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${rewardId}/codes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Delete failed");
      }
      setSelected(new Set());
      setLoaded(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAllUnused() {
    if (!confirm("Delete every unused code for this reward?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${rewardId}/codes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "unused" }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Delete failed");
      }
      setSelected(new Set());
      setLoaded(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] p-3">
      {loading && <p className="text-xs text-[color:var(--color-text-secondary)]">Loading codes…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {codes && codes.length === 0 && !loading && (
        <p className="text-xs text-[color:var(--color-text-secondary)]">No codes yet.</p>
      )}
      {codes && codes.length > 0 && (
        <>
          {truncated && (
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Showing the first {codes.length} codes — use Export (CSV) for the full list.
            </p>
          )}
          <div className="flex items-center gap-2 text-xs">
            <button onClick={toggleAll} className="text-[color:var(--color-primary)] hover:underline">
              {selected.size === codes.length ? "Deselect all" : "Select all"}
            </button>
            <span className="text-[color:var(--color-text-secondary)]">{selected.size} selected</span>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-[color:var(--color-border)]">
            {codes.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 border-b border-[color:var(--color-border)] px-2 py-1.5 text-sm last:border-b-0 hover:bg-[color:var(--color-surface-sunken)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="rounded border-[color:var(--color-border)]"
                />
                <span className="font-mono text-xs flex-1">{c.code}</span>
                <span className={`text-xs ${c.usedAt ? "text-[color:var(--color-text-secondary)]" : "text-emerald-600"}`}>
                  {c.usedAt ? "used" : "available"}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={deleteSelected}
              disabled={busy || selected.size === 0}
              className={busy || selected.size === 0 ? "opacity-60" : ""}
            >
              Delete selected
            </Button>
            <Button variant="secondary" onClick={deleteAllUnused} disabled={busy} className={busy ? "opacity-60" : ""}>
              Delete all unused
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
