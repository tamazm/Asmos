"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export type RewardRow = {
  id: string;
  label: string;
  category: string | null;
  description: string | null;
  type: string;
  couponCode: string | null;
  discountValue: number | null;
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
  overrideAccountId,
}: {
  rows: RewardRow[];
  codeLimits: CodeLimits;
  campaigns: CampaignOption[];
  // Set only when a superadmin is editing another account's rewards from
  // /admin/accounts/[id] - see lib/account.ts's resolveAccountForRequest.
  // Every write below threads this through so the API routes operate on the
  // account being viewed instead of the superadmin's own account.
  overrideAccountId?: string;
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
          generateCampaign.ts / api/widget/config/route.ts) - new campaigns
          get one automatically, but this is where to add more, change
          quantities, or hand a reward off to a different campaign. */}
      <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-text-secondary)]">
        A popup won&apos;t show if its campaign has no active, unclaimed reward. Every new campaign is
        stocked automatically - use this page to top up codes, pause/resize a reward, or move one to a
        different campaign.
      </div>

      <div>
        <Button onClick={() => setShowNew((v) => !v)}>{showNew ? "Cancel" : "+ New reward"}</Button>
      </div>
      {showNew && <NewRewardForm campaigns={campaigns} onDone={() => setShowNew(false)} overrideAccountId={overrideAccountId} />}

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
                  <RewardCard key={row.id} row={row} codeLimits={codeLimits} campaigns={campaigns} overrideAccountId={overrideAccountId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewRewardForm({ campaigns, onDone, overrideAccountId }: { campaigns: CampaignOption[]; onDone: () => void; overrideAccountId?: string }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [type, setType] = useState<(typeof REWARD_TYPES)[number]>("FREE_SHIPPING");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCoded = type === "COUPON" || type === "DISCOUNT_PERCENT" || type === "DISCOUNT_FIXED";
  const isDiscount = type === "DISCOUNT_PERCENT" || type === "DISCOUNT_FIXED";

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
          couponCode: isCoded && couponCode.trim() ? couponCode.trim() : undefined,
          discountValue: isDiscount && discountValue.trim() ? Number(discountValue) : undefined,
          maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : undefined,
          accountId: overrideAccountId,
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
        Create a campaign first - rewards need a campaign to belong to.
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
        {isCoded && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
              Coupon code <span className="font-normal">(optional)</span>
            </label>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="e.g. WELCOME10"
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>
        )}
        {isDiscount && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
              Discount value {type === "DISCOUNT_PERCENT" ? "(%)" : "(whole currency units)"}
            </label>
            <input
              type="number"
              min={1}
              max={type === "DISCOUNT_PERCENT" ? 100 : undefined}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={type === "DISCOUNT_PERCENT" ? "e.g. 10" : "e.g. 5"}
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
            <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
              With a linked Shopify store, saving creates a matching, redeemable discount code.
            </p>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
            Description <span className="font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shown internally only - not to visitors"
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
          After creating, use &quot;Generate promo codes&quot; on the new card to stock it - a COUPON
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
  overrideAccountId,
}: {
  row: RewardRow;
  codeLimits: CodeLimits;
  campaigns: CampaignOption[];
  overrideAccountId?: string;
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
  // "max 1000" - the account-wide remaining budget is often the tighter of
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
        body: JSON.stringify({ mode: "import", codes, accountId: overrideAccountId }),
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
        body: JSON.stringify({ mode: "generate", prefix, count, accountId: overrideAccountId }),
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
      const res = await fetch(`/api/rewards/${row.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: overrideAccountId }),
      });
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
          overrideAccountId={overrideAccountId}
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
              href={`/api/rewards/${row.id}/codes/export?status=all${overrideAccountId ? `&accountId=${overrideAccountId}` : ""}`}
              className="inline-flex items-center justify-center rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
            >
              Export (CSV)
            </a>
            <Button variant="secondary" onClick={() => setShowCodes(true)}>
              Manage codes
            </Button>
          </div>
        )
      )}

      {usesCodePool && (
        <ManageCodesModal
          open={showCodes}
          onClose={() => setShowCodes(false)}
          rewardId={row.id}
          rewardLabel={row.label}
          overrideAccountId={overrideAccountId}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

function EditRewardPanel({
  row,
  campaigns,
  busy,
  setBusy,
  overrideAccountId,
  onDeleted,
  onError,
  onFeedback,
}: {
  row: RewardRow;
  campaigns: CampaignOption[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  overrideAccountId?: string;
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
  const [couponCode, setCouponCode] = useState(row.couponCode ?? "");
  const [discountValue, setDiscountValue] = useState(row.discountValue == null ? "" : String(row.discountValue));

  const isCoded = row.type === "COUPON" || row.type === "DISCOUNT_PERCENT" || row.type === "DISCOUNT_FIXED";
  const isDiscount = row.type === "DISCOUNT_PERCENT" || row.type === "DISCOUNT_FIXED";

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
          couponCode: isCoded ? (couponCode.trim() || null) : undefined,
          discountValue: isDiscount ? (discountValue.trim() ? Number(discountValue) : null) : undefined,
          active,
          campaignId,
          accountId: overrideAccountId,
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
        {isCoded && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">Coupon code</label>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="e.g. WELCOME10"
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>
        )}
        {isDiscount && (
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--color-text-secondary)]">
              Discount value {row.type === "DISCOUNT_PERCENT" ? "(%)" : "(whole currency units)"}
            </label>
            <input
              type="number"
              min={1}
              max={row.type === "DISCOUNT_PERCENT" ? 100 : undefined}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={row.type === "DISCOUNT_PERCENT" ? "e.g. 10" : "e.g. 5"}
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>
        )}
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
type StatusFilter = "all" | "unused" | "used";
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function ManageCodesModal({
  open,
  onClose,
  rewardId,
  rewardLabel,
  overrideAccountId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  rewardId: string;
  rewardLabel: string;
  overrideAccountId?: string;
  onChanged: () => void;
}) {
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalUnfiltered, setTotalUnfiltered] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Debounce the search box so every keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status,
          page: String(page),
          pageSize: String(pageSize),
          ...(search ? { search } : {}),
          ...(overrideAccountId ? { accountId: overrideAccountId } : {}),
        });
        const res = await fetch(`/api/rewards/${rewardId}/codes?${params.toString()}`);
        if (!res.ok) throw new Error("Could not load codes");
        const data = await res.json();
        if (cancelled) return;
        setCodes(data.codes ?? []);
        setTotal(data.total ?? 0);
        setTotalUnfiltered(data.totalUnfiltered ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load codes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, rewardId, status, search, page, pageSize, reloadToken, overrideAccountId]);

  // Reset transient state each time the modal is reopened.
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setPage(1);
    }
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    if (!codes) return;
    const allSelected = codes.every((c) => selected.has(c.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) codes.forEach((c) => next.delete(c.id));
      else codes.forEach((c) => next.add(c.id));
      return next;
    });
  }

  function refetchCurrentPage() {
    setReloadToken((t) => t + 1);
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
        body: JSON.stringify({ codeIds: Array.from(selected), accountId: overrideAccountId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Delete failed");
      }
      setSelected(new Set());
      refetchCurrentPage();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAllUnused() {
    if (!confirm("Delete every unused code for this reward? This ignores the current search/filter.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rewards/${rewardId}/codes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "unused", accountId: overrideAccountId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Delete failed");
      }
      setSelected(new Set());
      setPage(1);
      refetchCurrentPage();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const allOnPageSelected = Boolean(codes && codes.length > 0 && codes.every((c) => selected.has(c.id)));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Manage codes - ${rewardLabel}`}
      subtitle={`${totalUnfiltered.toLocaleString()} total code${totalUnfiltered === 1 ? "" : "s"}`}
      size="xl"
    >
      <div className="flex flex-col gap-3 p-5">
        {/* Toolbar: search + status filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--color-text-secondary)]" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search codes…"
              className="w-full rounded-lg border border-[color:var(--color-border)] py-2 pl-8 pr-3 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] p-0.5">
            {(["all", "unused", "used"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                  status === s
                    ? "bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                    : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
                }`}
              >
                {s === "all" ? "All" : s === "unused" ? "Available" : "Used"}
              </button>
            ))}
          </div>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]); setPage(1); }}
            className="rounded-lg border border-[color:var(--color-border)] px-2 py-2 text-xs outline-none focus:border-[color:var(--color-primary)]"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Selection / bulk action bar */}
        {selected.size > 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-[color:var(--color-primary-light)] px-3 py-2 text-xs">
            <span className="font-medium text-[color:var(--color-primary)]">{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} className="text-[color:var(--color-text-secondary)] hover:underline">
              Clear
            </button>
            <div className="ml-auto">
              <Button variant="secondary" onClick={deleteSelected} disabled={busy} className={busy ? "opacity-60" : ""}>
                Delete selected
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            <button
              onClick={deleteAllUnused}
              disabled={busy || totalUnfiltered === 0}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Delete all unused
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[color:var(--color-surface-sunken)]">
                <tr className="border-b border-[color:var(--color-border)]">
                  <th className="w-9 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                      disabled={!codes || codes.length === 0}
                      className="rounded border-[color:var(--color-border)]"
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[color:var(--color-text-secondary)]">Code</th>
                  <th className="w-28 px-3 py-2 text-left text-xs font-semibold text-[color:var(--color-text-secondary)]">Status</th>
                  <th className="w-36 px-3 py-2 text-left text-xs font-semibold text-[color:var(--color-text-secondary)]">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading && (!codes || codes.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-xs text-[color:var(--color-text-secondary)]">
                      Loading codes…
                    </td>
                  </tr>
                )}
                {!loading && codes && codes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-xs text-[color:var(--color-text-secondary)]">
                      {search || status !== "all" ? "No codes match your search/filter." : "No codes yet."}
                    </td>
                  </tr>
                )}
                {codes?.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[color:var(--color-border)] last:border-b-0 hover:bg-[color:var(--color-surface-sunken)] cursor-pointer"
                    onClick={() => toggle(c.id)}
                  >
                    <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                        className="rounded border-[color:var(--color-border)]"
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-[color:var(--color-text-primary)]">{c.code}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant={c.usedAt ? "neutral" : "success"}>{c.usedAt ? "Used" : "Available"}</Badge>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-text-secondary)]">
          <span>
            {total === 0 ? "0 results" : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-md border border-[color:var(--color-border)] px-2.5 py-1.5 font-medium disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-md border border-[color:var(--color-border)] px-2.5 py-1.5 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
