"use client";

import { useState } from "react";

interface WebsiteOption {
  id: string;
  url: string;
}

// The pick-and-confirm step. The merchant chooses which of their Asmos websites
// this Shopify store maps to (or creates a fresh one for the store's domain),
// then confirms the link. On success we send them back into the embedded app
// inside the Shopify admin via the returnUrl the API hands back.
export function ConnectForm({
  token,
  shopDomain,
  email,
  websites,
}: {
  token: string;
  shopDomain: string;
  email: string | null;
  websites: WebsiteOption[];
}) {
  // Preselect a website already pointed at this store's domain, if any.
  const preselected = websites.find((w) => w.url === shopDomain)?.id ?? "__new__";
  const [websiteId, setWebsiteId] = useState<string>(preselected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          websiteId: websiteId === "__new__" ? null : websiteId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not connect this store. Please try again.");
        return;
      }
      setDone(true);
      // Hand the merchant back to the app inside the Shopify admin.
      if (data.returnUrl) window.location.href = data.returnUrl;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const radioRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    border: "1px solid #e3e3e3",
    borderRadius: 10,
    marginBottom: 8,
    cursor: "pointer",
    fontSize: 14,
  };

  if (done) {
    return (
      <p style={{ marginTop: 14, fontSize: 14, color: "#1a1a1a" }}>
        Connected. Returning you to Shopify…
      </p>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 14, color: "#4a4a4a", margin: "0 0 4px" }}>
        Link <strong>{shopDomain}</strong> to your Asmos account
        {email ? (
          <>
            {" "}(<strong>{email}</strong>)
          </>
        ) : null}
        .
      </p>
      <p style={{ fontSize: 13, color: "#6d7175", margin: "0 0 16px" }}>
        Your existing popups will become available to this store. Pick which website this store maps to:
      </p>

      <div>
        {websites.map((w) => (
          <label key={w.id} style={radioRow}>
            <input
              type="radio"
              name="website"
              value={w.id}
              checked={websiteId === w.id}
              onChange={() => setWebsiteId(w.id)}
            />
            <span>{w.url}</span>
          </label>
        ))}
        <label style={radioRow}>
          <input
            type="radio"
            name="website"
            value="__new__"
            checked={websiteId === "__new__"}
            onChange={() => setWebsiteId("__new__")}
          />
          <span>Create a new website for {shopDomain}</span>
        </label>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            borderRadius: 10,
            border: "1px solid #e0b3b3",
            background: "#fff4f4",
            padding: 12,
            color: "#8a1f1f",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={confirm}
        disabled={busy}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "11px 16px",
          borderRadius: 10,
          border: "none",
          background: busy ? "#7a7f95" : "#2a2a35",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Connecting…" : "Connect store"}
      </button>
    </div>
  );
}
