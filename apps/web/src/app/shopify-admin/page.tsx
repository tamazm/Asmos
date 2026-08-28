"use client";

import { useEffect, useState, useCallback } from "react";
import { OnboardingWizard } from "./OnboardingWizard";

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

// Theme app extension handle (matches extensions/asmos-popup, blocks/asmos-popup.liquid).
const EMBED_HANDLE = "asmos-popup";
// Set NEXT_PUBLIC_SHOPIFY_THEME_EXTENSION_UUID after `shopify app deploy` (the
// extension's registered UUID) to deep-link straight to the Asmos embed toggle,
// pre-activated. Without it, the button still opens the theme editor's App
// embeds panel — graceful fallback, never worse than before.
const EMBED_UUID = process.env.NEXT_PUBLIC_SHOPIFY_THEME_EXTENSION_UUID;

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

interface Segment {
  id: string;
  name: string;
  memberCount: number;
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

function openThemeEditor(shop: string) {
  // Break out of the iframe into the theme editor's App embeds panel. With the
  // extension UUID we deep-link straight to the Asmos embed, pre-activated
  // (embeds can't be turned on programmatically — this is the one-click path).
  const base = `https://${shop}/admin/themes/current/editor?context=apps`;
  const url = EMBED_UUID ? `${base}&activateAppId=${EMBED_UUID}/${EMBED_HANDLE}` : base;
  window.open(url, "_top");
}

export default function ShopifyAdminHome() {
  const [status, setStatus] = useState<Status>("loading");
  const [shop, setShop] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string[]>([]);
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingPlan, setBillingPlan] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [segmentsNeedScope, setSegmentsNeedScope] = useState(false);
  // Onboarding gate. `embedAck` records that the merchant confirmed enabling the
  // theme embed (there's no server-side signal for it), and `onboarded` is the
  // sticky "finished the wizard" flag. Both are persisted per-shop in
  // localStorage so a returning merchant lands straight in the dashboard.
  const [embedAck, setEmbedAck] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  const refreshScopes = useCallback(async () => {
    try {
      const state = await window.shopify?.scopes.query();
      if (state) setGranted(state.granted);
    } catch {
      /* Scopes API unavailable (older App Bridge) — leave toggles at "not granted". */
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

  const loadSegments = useCallback(async () => {
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/segments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSegmentsNeedScope(Boolean(data.needsScope));
      setSegments(data.segments ?? []);
    } catch {
      /* Non-fatal: Audiences section just won't populate. */
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
        setLinked(Boolean(data.linked));
        // Hydrate onboarding flags for this shop before we flip to "ready", so an
        // already-onboarded merchant lands straight in the dashboard with no
        // flash of the wizard. Keyed by shop so each store is evaluated on its
        // own. (Setting state here, after the await, is intentionally not the
        // synchronous-effect anti-pattern.)
        try {
          setEmbedAck(localStorage.getItem(`asmos_embed_ack_${data.shop}`) === "1");
          setOnboarded(localStorage.getItem(`asmos_onboarded_${data.shop}`) === "1");
        } catch {
          /* localStorage unavailable (privacy mode) — treat as not-yet-onboarded. */
        }
        setStatus("ready");
        await Promise.all([refreshScopes(), loadCampaigns(), loadBilling(), loadLeads(), loadSegments()]);
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
  }, [refreshScopes, loadCampaigns, loadBilling, loadLeads, loadSegments]);

  // Poll while anything is still generating so the list flips to a live-able
  // state on its own without the merchant reloading the iframe.
  useEffect(() => {
    if (!campaigns?.some((c) => c.status === "GENERATING")) return;
    const t = setInterval(loadCampaigns, 4000);
    return () => clearInterval(t);
  }, [campaigns, loadCampaigns]);

  function acknowledgeEmbed() {
    setEmbedAck(true);
    try {
      if (shop) localStorage.setItem(`asmos_embed_ack_${shop}`, "1");
    } catch {
      /* Non-fatal: the flag just won't persist across reloads. */
    }
  }

  function finishOnboarding() {
    setOnboarded(true);
    try {
      if (shop) localStorage.setItem(`asmos_onboarded_${shop}`, "1");
    } catch {
      /* Non-fatal. */
    }
  }

  async function toggleScope(scope: string, isGranted: boolean) {
    setBusyScope(scope);
    try {
      const state = isGranted
        ? await window.shopify!.scopes.revoke([scope])
        : await window.shopify!.scopes.request([scope]);
      if (state) setGranted(state.granted);
      else await refreshScopes();
      // Granting/revoking read_customers changes whether the Audiences panel can
      // read segments — refresh it (this is also what fires the segments /
      // customerSegmentMembers queries the moment the scope is allowed).
      if (scope === "read_customers") await loadSegments();
    } catch (err) {
      window.shopify?.toast?.show((err as Error).message || "Could not update permission", { isError: true });
    } finally {
      setBusyScope(null);
    }
  }

  // Break out of the Shopify iframe to the top-frame connect flow on
  // app.asmos.io, where the merchant signs into their existing Asmos account and
  // links this store (Clerk sign-in can't run inside the admin iframe).
  async function connectAccount() {
    setConnecting(true);
    try {
      const token = await window.shopify!.idToken();
      const res = await fetch("/api/shopify/admin/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        window.shopify?.toast?.show(data.error ?? "Could not start connection", { isError: true });
        return;
      }
      window.open(data.url, "_top");
    } catch (err) {
      window.shopify?.toast?.show((err as Error).message, { isError: true });
    } finally {
      setConnecting(false);
    }
  }

  // Send a linked merchant to the full Asmos popup builder (top-frame). The embed
  // is served from the app origin, so window.location.origin is app.asmos.io.
  function openAsmosBuilder() {
    window.open(`${window.location.origin}/campaigns/new`, "_top");
  }

  // The dropdown's "which popup is live" control: activating one campaign pauses
  // the rest (single-active model), so setting the active popup is just a PATCH
  // that activates the chosen one.
  async function setActivePopup(id: string) {
    await patchCampaign(id, { action: "activate" });
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

  if (status === "loading") {
    return <LoadingShell />;
  }

  if (status === "error") {
    return <ErrorShell message={error} />;
  }

  const list = campaigns ?? [];
  const activeCampaign = list.find((c) => c.status === "ACTIVE") ?? null;
  const hasCampaigns = list.length > 0;

  // Mandatory onboarding gate. Until the merchant has connected their Asmos
  // account, put a popup live, and switched on the theme embed, we show the
  // guided wizard instead of the full dashboard. `onboarded` (set by the
  // wizard's finish button) makes it sticky so we never re-gate a merchant who
  // later pauses a campaign. The flags are hydrated in boot() before status
  // flips to "ready", so an already-onboarded merchant never flashes the wizard.
  const onboardingComplete = onboarded || (linked && Boolean(activeCampaign) && embedAck);
  if (!onboardingComplete) {
    return (
      <OnboardingWizard
        linked={linked}
        connecting={connecting}
        onConnect={connectAccount}
        campaigns={list}
        hasActiveCampaign={Boolean(activeCampaign)}
        creating={creating}
        onCreateStarter={createStarterPopup}
        onSelectActive={setActivePopup}
        embedAcknowledged={embedAck}
        onOpenThemeEditor={() => shop && openThemeEditor(shop)}
        onAcknowledgeEmbed={acknowledgeEmbed}
        onFinish={finishOnboarding}
      />
    );
  }

  return (
    <s-page heading="Asmos">
      <s-stack direction="block" gap="large">
        {/* Connect prompt — shown until this store is linked to the merchant's
            existing Asmos account. Breaks out to the top-frame connect flow. */}
        {!linked && (
          <s-banner tone="info" heading="Connect your Asmos account">
            <s-stack direction="block" gap="base">
              <s-text>
                Already use Asmos on the web? Connect your account to manage the popups you’ve
                already built and choose which one runs on this store.
              </s-text>
              <s-box>
                <s-button
                  variant="primary"
                  loading={connecting}
                  disabled={connecting}
                  onClick={connectAccount}
                >
                  Connect Asmos account
                </s-button>
              </s-box>
            </s-stack>
          </s-banner>
        )}

        {/* Smart status — reflects where the merchant actually is, and surfaces
            the "turn on the embed" action exactly when a popup is live. */}
        {!hasCampaigns ? (
          <s-banner tone="info">
            <s-text>Generate your first popup below — it takes about a minute.</s-text>
          </s-banner>
        ) : activeCampaign ? (
          <s-banner tone="success" heading={`“${activeCampaign.name}” is live`}>
            <s-stack direction="block" gap="base">
              <s-text>
                Shoppers only see it once the Asmos embed is switched on in your theme. If you
                haven’t yet, turn it on now.
              </s-text>
              <s-box>
                <s-button onClick={() => shop && openThemeEditor(shop)}>Turn on in theme</s-button>
              </s-box>
            </s-stack>
          </s-banner>
        ) : (
          <s-banner tone="warning">
            <s-text>You have popups, but none are live. Activate one below to start showing it.</s-text>
          </s-banner>
        )}

        {/* ── Popups: the core surface ─────────────────────────────────────── */}
        <s-section heading="Popups">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-text tone="subdued">
                {hasCampaigns
                  ? "Choose which popup runs on your store, and control when and where it appears."
                  : linked
                    ? "Build a popup in Asmos, then choose it here to run it on your store."
                    : "Asmos generates a lead-capture popup tailored to your store. Customize it any time."}
              </s-text>
              <s-button
                variant={hasCampaigns ? undefined : "primary"}
                loading={!linked && creating}
                disabled={!linked && creating}
                onClick={linked ? openAsmosBuilder : createStarterPopup}
              >
                {linked
                  ? hasCampaigns
                    ? "Create another in Asmos"
                    : "Create a popup in Asmos"
                  : hasCampaigns
                    ? "Generate another"
                    : "Generate popup"}
              </s-button>
            </s-stack>

            {/* "Which popup is live" dropdown — the primary selection control the
                merchant asked for. Activating one pauses the rest (single-active
                model), so this is just an activate PATCH. */}
            {hasCampaigns && (
              <ActivePopupSelect
                campaigns={list}
                activeId={activeCampaign?.id ?? null}
                onSelect={setActivePopup}
              />
            )}

            {list.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                isLive={c.id === activeCampaign?.id}
                onPatch={patchCampaign}
                onOpenEmbed={() => shop && openThemeEditor(shop)}
              />
            ))}
          </s-stack>
        </s-section>

        {/* ── Leads ────────────────────────────────────────────────────────── */}
        <s-section heading="Captured leads">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-text tone="subdued">
                {leads == null
                  ? "Loading…"
                  : leads.length === 0
                    ? "No leads yet — they’ll appear here as your popup converts shoppers."
                    : `${leads.length} captured.`}
              </s-text>
              {leads && leads.length > 0 && (
                <s-button loading={exporting} disabled={exporting} onClick={exportLeads}>
                  Export CSV
                </s-button>
              )}
            </s-stack>
            {leads && leads.length > 0 && <LeadsTable leads={leads} />}
          </s-stack>
        </s-section>

        {/* ── Audiences (Shopify customer segments) ────────────────────────── */}
        <s-section heading="Audiences">
          <s-stack direction="block" gap="base">
            {segmentsNeedScope ? (
              <s-text tone="subdued">
                Allow <s-text type="strong">Customers</s-text> below to see how your shoppers are
                segmented and understand who your popups are reaching.
              </s-text>
            ) : segments == null ? (
              <s-text tone="subdued">Loading…</s-text>
            ) : segments.length === 0 ? (
              <s-text tone="subdued">
                No customer segments yet. Create segments in Shopify to see them here.
              </s-text>
            ) : (
              <>
                <s-text tone="subdued">Your Shopify customer segments.</s-text>
                {segments.map((seg) => (
                  <s-box key={seg.id} border="base" borderRadius="base" padding="base">
                    <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                      <s-text type="strong">{seg.name}</s-text>
                      <s-badge tone="info">
                        {seg.memberCount >= 10 ? "10+ members" : `${seg.memberCount} member${seg.memberCount === 1 ? "" : "s"}`}
                      </s-badge>
                    </s-stack>
                  </s-box>
                ))}
              </>
            )}
          </s-stack>
        </s-section>

        {/* ── Permissions (secondary) ──────────────────────────────────────── */}
        <s-section heading="What Asmos can track">
          <s-stack direction="block" gap="base">
            {TRACKED.map(({ scope, label, desc }) => {
              const isGranted = granted.includes(scope);
              return (
                <s-box key={scope}>
                  <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <s-stack direction="block" gap="none">
                      <s-stack direction="inline" gap="tight" alignItems="center">
                        <s-text type="strong">{label}</s-text>
                        <s-badge tone={isGranted ? "success" : "neutral"}>{isGranted ? "On" : "Off"}</s-badge>
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

        {/* ── Plan (de-emphasized: no paywall today) ───────────────────────── */}
        <s-section heading="Plan">
          <s-stack direction="block" gap="base">
            {subscription ? (
              <s-stack direction="inline" gap="tight" alignItems="center">
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
              <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                <s-text tone="subdued">You’re on the free plan.</s-text>
                {plans.length > 0 && (
                  <s-button onClick={() => setShowPlans((v) => !v)}>
                    {showPlans ? "Hide plans" : "View plans"}
                  </s-button>
                )}
              </s-stack>
            )}

            {(subscription || showPlans) &&
              plans.map((p) => {
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

// ── First-paint shells (plain HTML, no Polaris dependency) ───────────────────
// These render from the server HTML and paint the instant App Bridge loads —
// they do NOT wait on polaris.js (deferred) or the /api/shopify/session round
// trip. That makes a large skeleton card the LCP element (well under the App
// Store's 2.5s gate) instead of the old spinner, which only appeared after the
// whole boot sequence. Reserved heights keep CLS < 0.1 when the real Polaris UI
// swaps in. Inline styles so there's zero external CSS/JS on the critical path.
const SHELL_WRAP: React.CSSProperties = {
  maxWidth: 998,
  margin: "0 auto",
  padding: "20px 16px",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};
const SHELL_HEADING: React.CSSProperties = {
  fontSize: 20,
  lineHeight: "28px",
  fontWeight: 650,
  color: "#1a1a1a",
  margin: "0 0 16px",
};

function SkeletonCard({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      style={{
        height,
        borderRadius: 12,
        border: "1px solid #e3e3e3",
        background:
          "linear-gradient(100deg, #f6f6f7 30%, #efeff1 50%, #f6f6f7 70%)",
        backgroundSize: "200% 100%",
        animation: "asmos-shimmer 1.4s ease-in-out infinite",
        marginBottom: 16,
      }}
    />
  );
}

function LoadingShell() {
  return (
    <div style={SHELL_WRAP}>
      {/* Keyframes for the shimmer; scoped, tiny, inline so it's on the HTML. */}
      <style>{"@keyframes asmos-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}"}</style>
      <h1 style={SHELL_HEADING}>Asmos</h1>
      {/* The tallest block is the LCP candidate and paints immediately. */}
      <SkeletonCard height={72} />
      <SkeletonCard height={188} />
      <SkeletonCard height={140} />
      <span
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
        role="status"
      >
        Loading your Asmos dashboard…
      </span>
    </div>
  );
}

function ErrorShell({ message }: { message: string | null }) {
  return (
    <div style={SHELL_WRAP}>
      <h1 style={SHELL_HEADING}>Asmos</h1>
      <div
        role="alert"
        style={{
          borderRadius: 12,
          border: "1px solid #e0b3b3",
          background: "#fff4f4",
          padding: 16,
          color: "#8a1f1f",
          fontSize: 14,
          lineHeight: "20px",
        }}
      >
        {message ?? "Something went wrong loading the app."}
      </div>
    </div>
  );
}

// ── Active-popup selector ─────────────────────────────────────────────────────
// The dropdown a merchant uses to pick which popup runs on their storefront.
// GENERATING/FAILED popups can't go live, so they're shown but disabled.
function ActivePopupSelect({
  campaigns,
  activeId,
  onSelect,
}: {
  campaigns: Campaign[];
  activeId: string | null;
  onSelect: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleChange(id: string) {
    if (!id || id === activeId) return;
    setBusy(true);
    try {
      await onSelect(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <s-box border="base" borderRadius="base" padding="base">
      <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" }}>
        Active popup on your store
      </label>
      <select
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #c9cccf",
          fontSize: 14,
          width: "100%",
          boxSizing: "border-box",
        }}
        value={activeId ?? ""}
        disabled={busy}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="" disabled>
          {activeId ? "Change active popup…" : "None live — choose one…"}
        </option>
        {campaigns.map((c) => {
          const notReady = c.status === "GENERATING" || c.status === "FAILED";
          return (
            <option key={c.id} value={c.id} disabled={notReady}>
              {c.name}
              {c.id === activeId ? " — live" : notReady ? ` — ${c.status.toLowerCase()}` : ""}
            </option>
          );
        })}
      </select>
      {busy && (
        <s-text tone="subdued">Updating…</s-text>
      )}
    </s-box>
  );
}

// ── One campaign: status, activate/pause, expandable placement editor ─────────
function CampaignRow({
  campaign,
  isLive,
  onPatch,
  onOpenEmbed,
}: {
  campaign: Campaign;
  isLive: boolean;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
  onOpenEmbed: () => void;
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
    <s-box border="base" borderRadius="base" padding="base" background={isLive ? "subdued" : undefined}>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
          <s-stack direction="block" gap="none">
            <s-stack direction="inline" gap="tight" alignItems="center">
              <s-text type="strong">{campaign.name}</s-text>
              <s-badge tone={STATUS_TONE[campaign.status]}>
                {isActive ? "live" : campaign.status.toLowerCase()}
              </s-badge>
            </s-stack>
            <s-text tone="subdued">{placementSummary(campaign.placement)}</s-text>
          </s-stack>
          <s-stack direction="inline" gap="tight" alignItems="center">
            <s-button disabled={busy || isGenerating} onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "Edit placement"}
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

        {isLive && (
          <s-text tone="subdued">
            Not showing up on your store?{" "}
            <s-link onClick={onOpenEmbed}>Turn on the Asmos embed in your theme.</s-link>
          </s-text>
        )}

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

// ── Leads table ───────────────────────────────────────────────────────────────
// Native <table> (not a Polaris component) so rendering is predictable; styled
// to sit cleanly inside the Polaris card. Scrolls horizontally on narrow admin.
function LeadsTable({ leads }: { leads: Lead[] }) {
  const rows = leads.slice(0, 25);
  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: "#6d7175",
    padding: "8px 12px",
    borderBottom: "1px solid #e3e3e3",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    fontSize: 13,
    padding: "10px 12px",
    borderBottom: "1px solid #f1f1f1",
    whiteSpace: "nowrap",
  };

  return (
    <s-box border="base" borderRadius="base">
      <div style={{ overflowX: "auto", width: "100%" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
          <thead>
            <tr>
              <th style={th}>Contact</th>
              <th style={th}>Campaign</th>
              <th style={th}>Captured</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{l.email || l.phone || l.name || "—"}</div>
                  {l.name && (l.email || l.phone) && (
                    <div style={{ color: "#6d7175", fontSize: 12 }}>{l.name}</div>
                  )}
                </td>
                <td style={{ ...td, color: "#6d7175" }}>{l.campaignName}</td>
                <td style={{ ...td, color: "#6d7175" }}>{new Date(l.createdAt).toLocaleDateString()}</td>
                <td style={td}>{l.isCustomer ? "Customer" : "Lead"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leads.length > 25 && (
        <s-box padding="base">
          <s-text tone="subdued">Showing the 25 most recent. Export CSV for the full list.</s-text>
        </s-box>
      )}
    </s-box>
  );
}

// ── Placement editor ──────────────────────────────────────────────────────────
// Native <select>/<input> so React owns the value binding predictably; wrapped
// in Polaris layout so it still reads as one card.
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
          patterns: mode === "all" ? [] : patterns.split(",").map((p) => p.trim()).filter(Boolean),
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
