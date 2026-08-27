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

export default function ShopifyAdminHome() {
  const [status, setStatus] = useState<Status>("loading");
  const [shop, setShop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<string[]>([]);
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const refreshScopes = useCallback(async () => {
    try {
      const state = await window.shopify?.scopes.query();
      if (state) setGranted(state.granted);
    } catch {
      /* Scopes API unavailable (older App Bridge) — leave toggles at "not granted". */
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
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setError(data.error ?? "Session exchange failed.");
          return;
        }
        setShop(data.shop);
        setStatus("ready");
        await refreshScopes();
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
  }, [refreshScopes]);

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
      setCreated(true);
      window.shopify?.toast?.show("Popup is generating — it'll go live once the app embed is on.");
    } catch (err) {
      window.shopify?.toast?.show((err as Error).message, { isError: true });
    } finally {
      setCreating(false);
    }
  }

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

  return (
    <s-page heading="Asmos">
      <s-stack direction="block" gap="large">
        <s-banner tone="success">
          <s-text>Connected to {shop}. Finish the steps below to go live.</s-text>
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

        {/* Step 3 — first popup */}
        <s-section heading="3. Create your first popup">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Asmos will generate a lead-capture popup tailored to your store. You can customize it any time.
            </s-paragraph>
            <s-box>
              {created ? (
                <s-badge tone="success">Popup generating</s-badge>
              ) : (
                <s-button variant="primary" loading={creating} disabled={creating} onClick={createStarterPopup}>
                  Generate popup
                </s-button>
              )}
            </s-box>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
