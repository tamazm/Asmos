"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "ready" | "error";

// Proves the B1 auth round-trip end to end: get a session token from
// App Bridge, exchange it via /api/shopify/session, land on a working
// authenticated state. No Clerk sign-in/sign-up anywhere in this path.
export default function ShopifyAdminHome() {
  const [status, setStatus] = useState<Status>("loading");
  const [shop, setShop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function exchangeSession() {
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
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError((err as Error).message);
      }
    }

    exchangeSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <s-page heading="Asmos">
      {status === "loading" && (
        <s-stack direction="inline" gap="base">
          <s-spinner />
          <s-text>Connecting…</s-text>
        </s-stack>
      )}
      {status === "ready" && (
        <s-banner tone="success">
          <s-text>Connected to {shop}. Session-token auth is working.</s-text>
        </s-banner>
      )}
      {status === "error" && (
        <s-banner tone="critical">
          <s-text>{error}</s-text>
        </s-banner>
      )}
    </s-page>
  );
}
