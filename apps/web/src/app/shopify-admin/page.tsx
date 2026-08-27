"use client";

import { useEffect, useState, useCallback } from "react";

type Status = "loading" | "ready" | "error";

// Data-tracking features the merchant opts into. Each maps to an OPTIONAL
// access scope (declared in shopify.app.toml); granting it via the App Bridge
// Scopes API pops Shopify's native consent modal — no redirect — and gates the
// matching webhooks (read_orders -> orders/*, read_customers -> customers/*).
const TRACKED = [
  { scope: "read_orders", label: "Orders & payments", desc: "Attribute revenue to the popup that converted the shopper." },
  { scope: "read_customers", label: "Customers", desc: "Sync new customers and enrich your lead list." },
  { scope: "read_products", label: "Products", desc: "Let Asmos tailor popups to your catalog." },
] as const;

type Trigger = "time_delay" | "exit_intent" | "scroll_depth";
type PageMode = "all" | "include" | "exclude";

interface Placement {
  trigger: Trigger;
  delaySeconds: number;
  pages: { mode: PageMode; patterns: string[] };
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: "DRAFT" | "GENERATING" | "ACTIVE" | "PAUSED" | "FAILED" | "ARCHIVED";
  createdAt: string;
  placement: Placement;
}

interface Plan {
  key: string;
  name: string;
  amount: number;
  currencyCode: string;
  interval: "EVERY_30_DAYS" | "ANNUAL";
  trialDays: number | null;
}

interface Subscription {
  id: string;
  name: string;
  status: string;
  test: boolean;
  currentPeriodEnd: string | null;
}

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  campaignName: string;
  isCustomer: boolean;
  createdAt: string;
}

const TRIGGER_LABELS: Record<Trigger, string> = {
  time_delay: "After a delay",
  exit_intent: "On exit intent",
  scroll_depth: "After scrolling halfway",
};

const STATUS_TONE: Record<Campaign["status"], "success" | "info" | "warning" | "neutral" | "critical"> = {
  ACTIVE: "success",
  GENERATING: "info",
  PAUSED: "neutral",
  DRAFT: "neutral",
  FAILED: "critical",
  ARCHIVED: "neutral",
};

export default function ShopifyAdminHome() {
  const [status, setStatus] = useState<Status>("loading");
  const [shop, setShop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string[]>([]);
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingPlan, setBillingPlan] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [exporting, setExporting] = useState(false);

  const refreshScopes = useCallback(async () => {
    try {
      const state = await window.shopify?.scopes.query();
      if (state) setGranted(state.granted);
    } catch {
      /* Scopes API unavailable (older App Bridge) — leave toggles at "not granted". */
    }
  }, []);

  const loadBilling = useCallback(async () => {
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/billing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSubscription(data.subscription ?? null);
      setPlans(data.plans ?? []);
    } catch {
      /* Non-fatal: billing section just won't render its plans. */
    }
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/leads", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setLeads(data.leads ?? []);
    } catch {
      /* Non-fatal: leads section just won't populate. */
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/campaigns", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    } catch {
      /* Non-fatal: manager still renders, list just stays as-is. */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!window.shopify) {
        setStatus("error");
        setError("App Bridge did not load (window.shopify is unavailable).");
        return;
      }
      try {
        const token = await window.shopify.idToken();
        const res = await fetch("/api/shopify/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        // The route can 500 with an empty/HTML body (e.g. missing server env,
        // token-exchange failure) — reading it as text first avoids a cryptic
        // "Unexpected end of JSON input" and surfaces something actionable.
        const raw = await res.text();
        const data = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;
        if (cancelled) return;
        if (!res.ok || !data) {
          setStatus("error");
          setError(
            data?.error ??
              `Session exchange failed (HTTP ${res.status}). This usually means the app's Shopify server credentials aren't configured on the deployment.`,
          );
          return;
        }
        setShop(data.shop);
        setStatus("ready");
        await Promise.all([refreshScopes(), loadCampaigns(), loadBilling(), loadLeads()]);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError((err as Error).message);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [refreshScopes, loadCampaigns, loadBilling, loadLeads]);

  async function exportLeads() {
    setExporting(true);
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/leads?format=csv", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        window.shopify?.toast?.show("Could not export leads", { isError: true });
        return;
      }
      // Session-token auth means we can't just link to the URL — fetch the CSV
      // with the Bearer header, then hand it to the browser as a blob download.
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `asmos-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      window.shopify?.toast?.show((err as Error).message, { isError: true });
    } finally {
      setExporting(false);
    }
  }

  async function subscribe(planKey: string) {
    setBillingPlan(planKey);
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/billing", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.confirmationUrl) {
        window.shopify?.toast?.show(data.error ?? "Could not start checkout", { isError: true });
        return;
      }
      // Shopify's charge-approval page must load in the top frame, not the
      // embedded iframe — App Bridge blocks the charge screen inside the app.
      window.open(data.confirmationUrl, "_top");
    } catch (err) {
      window.shopify?.toast?.show((err as Error).message, { isError: true });
    } finally {
      setBillingPlan(null);
    }
  }

  // Poll while anything is still generating so the list flips to a live-able
  // state (ACTIVE-able) on its own without the merchant reloading the iframe.
  useEffect(() => {
    if (!campaigns?.some((c) => c.status === "GENERATING")) return;
    const t = setInterval(loadCampaigns, 4000);
    return () => clearInterval(t);
  }, [campaigns, loadCampaigns]);

  async function toggleScope(scope: string, isGranted: boolean) {
    setBusyScope(scope);
    try {
      const state = isGranted
        ? await window.shopify!.scopes.revoke([scope])
        : await window.shopify!.scopes.request([scope]);
      if (state) setGranted(state.granted);
      else await refreshScopes();
    } catch (err) {
      window.shopify?.toast?.show((err as Error).message || "Could not update permission", { isError: true });
    } finally {
      setBusyScope(null);
    }
  }

  function openThemeEditor() {
    if (!shop) return;
    // Opens the theme editor's App embeds panel (breaks out of the iframe) so
    // the merchant can turn on the Asmos popup embed. App embeds can't be
    // activated programmatically — this deep link is the one-click path.
    window.open(`https://${shop}/admin/themes/current/editor?context=apps`, "_top");
  }

  async function createStarterPopup() {
    setCreating(true);
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/campaigns", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "BOTH" }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.shopify?.toast?.show(data.error ?? "Could not create popup", { isError: true });
        return;
      }
      window.shopify?.toast?.show("Popup is generating — activate it once it's ready.");
      await loadCampaigns();
    } catch (err) {
      window.shopify?.toast?.show((err as Error).message, { isError: true });
    } finally {
      setCreating(false);
    }
  }

  // Shared helper: authed PATCH to a campaign, then refresh the list.
  const patchCampaign = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<boolean> => {
      const token = await window.shopify!.idToken();
      const res = await fetch(`/api/shopify/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.shopify?.toast?.show(data.error ?? "Update failed", { isError: true });
        return false;
      }
      await loadCampaigns();
      return true;
    },
    [loadCampaigns],
  );

  if (status === "loading") {
    return (
      <s-page heading="Asmos">
        <s-stack direction="inline" gap="base">
          <s-spinner accessibilityLabel="Connecting" />
          <s-text>Connecting…</s-text>
        </s-stack>
      </s-page>
    );
  }

  if (status === "error") {
    return (
      <s-page heading="Asmos">
        <s-banner tone="critical">
          <s-text>{error}</s-text>
        </s-banner>
      </s-page>
    );
  }

  const hasCampaigns = (campaigns?.length ?? 0) > 0;

  return (
    <s-page heading="Asmos">
      <s-stack direction="block" gap="large">
        <s-banner tone="success">
          <s-text>Connected to {shop}. Manage your storefront popups below.</s-text>
        </s-banner>

        {/* Step 1 — storefront delivery */}
        <s-section heading="1. Show popups on your store">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Turn on the Asmos app embed in your theme so popups can appear on your storefront.
            </s-paragraph>
            <s-box>
              <s-button variant="primary" onClick={openThemeEditor}>
                Open theme editor
              </s-button>
            </s-box>
          </s-stack>
        </s-section>

        {/* Step 2 — the "what you'll allow" consent toggles */}
        <s-section heading="2. Choose what Asmos can track">
          <s-stack direction="block" gap="base">
            {TRACKED.map(({ scope, label, desc }) => {
              const isGranted = granted.includes(scope);
              return (
                <s-box key={scope}>
                  <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <s-stack direction="block" gap="none">
                      <s-stack direction="inline" gap="tight" alignItems="center">
                        <s-text type="strong">{label}</s-text>
                        <s-badge tone={isGranted ? "success" : "neutral"}>
                          {isGranted ? "On" : "Off"}
                        </s-badge>
                      </s-stack>
                      <s-text tone="subdued">{desc}</s-text>
                    </s-stack>
                    <s-button
                      disabled={busyScope === scope}
                      loading={busyScope === scope}
                      onClick={() => toggleScope(scope, isGranted)}
                    >
                      {isGranted ? "Turn off" : "Allow"}
                    </s-button>
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        </s-section>

        {/* Step 3 — the popup manager: which popup shows, and where */}
        <s-section heading="3. Your popups">
          <s-stack direction="block" gap="base">
            {!hasCampaigns && (
              <s-paragraph>
                No popups yet. Generate one tailored to your store — you can customize when and where it
                shows, then activate it.
              </s-paragraph>
            )}

            {campaigns?.map((c) => (
              <CampaignRow key={c.id} campaign={c} onPatch={patchCampaign} />
            ))}

            <s-box>
              <s-button
                variant={hasCampaigns ? undefined : "primary"}
                loading={creating}
                disabled={creating}
                onClick={createStarterPopup}
              >
                {hasCampaigns ? "Generate another popup" : "Generate popup"}
              </s-button>
            </s-box>
          </s-stack>
        </s-section>

        {/* Step 4 — leads (App Store 5.1.5: collected data must be merchant-accessible) */}
        <s-section heading="4. Captured leads">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-text tone="subdued">
                {leads == null
                  ? "Loading…"
                  : leads.length === 0
                    ? "No leads captured yet — they'll appear here once your popup starts converting."
                    : `${leads.length} lead${leads.length > 1 ? "s" : ""} captured.`}
              </s-text>
              {leads && leads.length > 0 && (
                <s-button loading={exporting} disabled={exporting} onClick={exportLeads}>
                  Export CSV
                </s-button>
              )}
            </s-stack>

            {leads && leads.length > 0 && (
              <s-box border="base" borderRadius="base" padding="base">
                <s-stack direction="block" gap="tight">
                  {leads.slice(0, 25).map((l) => (
                    <s-stack
                      key={l.id}
                      direction="inline"
                      gap="base"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <s-stack direction="block" gap="none">
                        <s-stack direction="inline" gap="tight" alignItems="center">
                          <s-text type="strong">{l.email || l.phone || l.name || "—"}</s-text>
                          {l.isCustomer && <s-badge tone="success">customer</s-badge>}
                        </s-stack>
                        <s-text tone="subdued">
                          {l.campaignName} · {new Date(l.createdAt).toLocaleDateString()}
                        </s-text>
                      </s-stack>
                    </s-stack>
                  ))}
                </s-stack>
              </s-box>
            )}
            {leads && leads.length > 25 && (
              <s-text tone="subdued">Showing the 25 most recent. Export CSV for the full list.</s-text>
            )}
          </s-stack>
        </s-section>

        {/* Step 5 — billing (Shopify-managed, required for App Store apps) */}
        <s-section heading="5. Your plan">
          <s-stack direction="block" gap="base">
            {subscription ? (
              <s-stack direction="inline" gap="tight" alignItems="center">
                <s-text>Current plan:</s-text>
                <s-text type="strong">{subscription.name}</s-text>
                <s-badge tone={subscription.status === "ACTIVE" ? "success" : "warning"}>
                  {subscription.status.toLowerCase()}
                </s-badge>
                {subscription.test && <s-badge tone="info">test</s-badge>}
                {subscription.currentPeriodEnd && (
                  <s-text tone="subdued">
                    · renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </s-text>
                )}
              </s-stack>
            ) : (
              <s-paragraph>Choose a plan to unlock the full Asmos experience.</s-paragraph>
            )}

            {/* Every plan is always listed so merchants can upgrade/downgrade
                in-app without contacting support (App Store rule 1.2.3). */}
            {plans.map((p) => {
              const isCurrent = subscription?.name === p.name;
              return (
                <s-box key={p.key} border="base" borderRadius="base" padding="base">
                  <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <s-stack direction="block" gap="none">
                      <s-stack direction="inline" gap="tight" alignItems="center">
                        <s-text type="strong">{p.name}</s-text>
                        {isCurrent && <s-badge tone="success">current</s-badge>}
                      </s-stack>
                      <s-text tone="subdued">
                        {p.currencyCode} {p.amount}/{p.interval === "ANNUAL" ? "yr" : "mo"}
                        {p.trialDays ? ` · ${p.trialDays}-day free trial` : ""}
                      </s-text>
                    </s-stack>
                    {isCurrent ? (
                      <s-badge tone="neutral">active</s-badge>
                    ) : (
                      <s-button
                        variant={subscription ? undefined : "primary"}
                        loading={billingPlan === p.key}
                        disabled={billingPlan !== null}
                        onClick={() => subscribe(p.key)}
                      >
                        {subscription ? `Switch to ${p.name}` : `Choose ${p.name}`}
                      </s-button>
                    )}
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

// ── One campaign: status, activate/pause, and an expandable placement editor ──
function CampaignRow({
  campaign,
  onPatch,
}: {
  campaign: Campaign;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const isActive = campaign.status === "ACTIVE";
  const isGenerating = campaign.status === "GENERATING";
  const canActivate = !isActive && !isGenerating && campaign.status !== "FAILED";

  async function toggleActive() {
    setBusy(true);
    try {
      await onPatch(campaign.id, { action: isActive ? "pause" : "activate" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <s-box border="base" borderRadius="base" padding="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="block" gap="none">
            <s-stack direction="inline" gap="tight" alignItems="center">
              <s-text type="strong">{campaign.name}</s-text>
              <s-badge tone={STATUS_TONE[campaign.status]}>{campaign.status.toLowerCase()}</s-badge>
            </s-stack>
            <s-text tone="subdued">{placementSummary(campaign.placement)}</s-text>
          </s-stack>
          <s-stack direction="inline" gap="tight" alignItems="center">
            <s-button disabled={busy || isGenerating} onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "Placement"}
            </s-button>
            {canActivate || isActive ? (
              <s-button
                variant={isActive ? undefined : "primary"}
                tone={isActive ? undefined : "success"}
                loading={busy}
                disabled={busy}
                onClick={toggleActive}
              >
                {isActive ? "Pause" : "Activate"}
              </s-button>
            ) : (
              <s-badge tone="info">{isGenerating ? "Generating…" : "Not ready"}</s-badge>
            )}
          </s-stack>
        </s-stack>

        {editing && (
          <PlacementEditor
            campaign={campaign}
            onSave={async (placement) => {
              const ok = await onPatch(campaign.id, { placement });
              if (ok) setEditing(false);
            }}
          />
        )}
      </s-stack>
    </s-box>
  );
}

// ── Placement editor ─────────────────────────────────────────────────────────
// Native <select>/<input> (not Polaris web components) so React owns the value
// binding predictably; wrapped in Polaris layout so it still reads as one card.
function PlacementEditor({
  campaign,
  onSave,
}: {
  campaign: Campaign;
  onSave: (placement: Placement) => Promise<void>;
}) {
  const [trigger, setTrigger] = useState<Trigger>(campaign.placement.trigger);
  const [delaySeconds, setDelaySeconds] = useState(String(campaign.placement.delaySeconds));
  const [mode, setMode] = useState<PageMode>(campaign.placement.pages.mode);
  const [patterns, setPatterns] = useState(campaign.placement.pages.patterns.join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        trigger,
        delaySeconds: Math.max(0, Math.min(120, Number(delaySeconds) || 0)),
        pages: {
          mode,
          patterns:
            mode === "all"
              ? []
              : patterns.split(",").map((p) => p.trim()).filter(Boolean),
        },
      });
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #c9cccf",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" };

  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="base">
        <div>
          <label style={labelStyle}>When it appears</label>
          <select style={fieldStyle} value={trigger} onChange={(e) => setTrigger(e.target.value as Trigger)}>
            {(Object.keys(TRIGGER_LABELS) as Trigger[]).map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {trigger === "time_delay" && (
          <div>
            <label style={labelStyle}>Delay (seconds)</label>
            <input
              style={fieldStyle}
              type="number"
              min={0}
              max={120}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
            />
          </div>
        )}

        <div>
          <label style={labelStyle}>Which pages</label>
          <select style={fieldStyle} value={mode} onChange={(e) => setMode(e.target.value as PageMode)}>
            <option value="all">All pages</option>
            <option value="include">Only these pages</option>
            <option value="exclude">All pages except these</option>
          </select>
        </div>

        {mode !== "all" && (
          <div>
            <label style={labelStyle}>Page paths (comma-separated)</label>
            <input
              style={fieldStyle}
              type="text"
              placeholder="/, /products/*, /pages/sale"
              value={patterns}
              onChange={(e) => setPatterns(e.target.value)}
            />
            <s-text tone="subdued">
              Exact paths like <code>/</code> or <code>/pages/sale</code>, or a wildcard like{" "}
              <code>/products/*</code>.
            </s-text>
          </div>
        )}

        <s-box>
          <s-button variant="primary" loading={saving} disabled={saving} onClick={save}>
            Save placement
          </s-button>
        </s-box>
      </s-stack>
    </s-box>
  );
}

function placementSummary(p: Placement): string {
  const when =
    p.trigger === "time_delay"
      ? `after ${p.delaySeconds}s`
      : p.trigger === "exit_intent"
        ? "on exit intent"
        : "after scrolling";
  const where =
    p.pages.mode === "all" || p.pages.patterns.length === 0
      ? "all pages"
      : p.pages.mode === "include"
        ? `${p.pages.patterns.length} page${p.pages.patterns.length > 1 ? "s" : ""}`
        : `all except ${p.pages.patterns.length}`;
  return `Shows ${when} · ${where}`;
}
