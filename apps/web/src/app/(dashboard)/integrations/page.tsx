"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

type IntegrationStatus = "disconnected" | "connecting" | "connected" | "error";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "email" | "automation";
  docsUrl?: string;
  icon: React.ReactNode;
}

// ── Disabled facade integrations ────────────────────────────────────────────
// Klaviyo, Mailchimp, HubSpot, Zapier: the "Connect" flow genuinely saved an
// API key, but no background job ever read it back out to forward leads -
// so from a merchant's perspective, clicking Connect did nothing. Commented
// out (not deleted) until the sync job exists. See IntegrationCard below,
// still used if any of these come back.
//
// const DISABLED_INTEGRATIONS: Integration[] = [
//   {
//     id: "klaviyo",
//     name: "Klaviyo",
//     description: "Sync captured leads directly into Klaviyo lists and trigger email flows.",
//     category: "email",
//     docsUrl: "https://www.klaviyo.com/",
//     icon: (
//       <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
//         <rect width="40" height="40" rx="8" fill="#1A1A1A" />
//         <text x="8" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="serif">K</text>
//       </svg>
//     ),
//   },
//   {
//     id: "mailchimp",
//     name: "Mailchimp",
//     description: "Add email submissions to Mailchimp audiences automatically.",
//     category: "email",
//     docsUrl: "https://mailchimp.com/",
//     icon: (
//       <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
//         <rect width="40" height="40" rx="8" fill="#FFE01B" />
//         <text x="9" y="27" fontSize="18" fontWeight="bold" fill="#1A1A1A" fontFamily="serif">M</text>
//       </svg>
//     ),
//   },
//   {
//     id: "zapier",
//     name: "Zapier",
//     description: "Connect Asmos to 5000+ apps. Trigger zaps on lead capture events.",
//     category: "automation",
//     docsUrl: "https://zapier.com/",
//     icon: (
//       <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
//         <rect width="40" height="40" rx="8" fill="#FF4A00" />
//         <text x="10" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">Z</text>
//       </svg>
//     ),
//   },
//   {
//     id: "hubspot",
//     name: "HubSpot",
//     description: "Send leads to HubSpot CRM contacts and lists.",
//     category: "email",
//     docsUrl: "https://hubspot.com/",
//     icon: (
//       <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
//         <rect width="40" height="40" rx="8" fill="#FF7A59" />
//         <text x="10" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">H</text>
//       </svg>
//     ),
//   },
// ];

const WEBHOOKS_INTEGRATION: Integration = {
  id: "webhooks",
  name: "Webhooks",
  description: "Receive real-time POST notifications on lead captured and variant winner events.",
  category: "automation",
  icon: (
    <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
      <rect width="40" height="40" rx="8" fill="#6366F1" />
      <path d="M12 28l4-8 4 4 4-6 4 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const INTEGRATIONS: Integration[] = [WEBHOOKS_INTEGRATION];

const CATEGORY_LABELS = {
  email: "Email marketing",
  automation: "Automation",
} as const;

// ── Webhook card (real API) ────────────────────────────────────────────────

function WebhookCard({ integration }: { integration: Integration }) {
  const [status, setStatus] = useState<IntegrationStatus>("disconnected");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [maskedSecret, setMaskedSecret] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load existing config on mount
  useEffect(() => {
    fetch("/api/account/webhook")
      .then((r) => r.json())
      .then((data: { webhookUrl: string | null; webhookSecret: string | null; webhookEnabled: boolean }) => {
        if (data.webhookEnabled && data.webhookUrl) {
          setWebhookUrl(data.webhookUrl);
          setMaskedSecret(data.webhookSecret);
          setStatus("connected");
        }
      })
      .catch(() => {
        // Non-fatal: page still works without pre-loaded state
      });
  }, []);

  async function handleConnect() {
    if (!showInput) {
      setShowInput(true);
      return;
    }
    if (!webhookUrl.trim()) {
      setError("Please enter your webhook endpoint URL.");
      return;
    }
    if (!webhookUrl.trim().startsWith("https://")) {
      setError("Endpoint URL must start with https://");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/webhook", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          webhookSecret: webhookSecret.trim() || undefined,
          webhookEnabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save. Please try again.");
        return;
      }
      setMaskedSecret(data.webhookSecret);
      setStatus("connected");
      setShowInput(false);
      setWebhookSecret(""); // clear plaintext from state
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await fetch("/api/account/webhook", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookEnabled: false }),
      });
    } catch {
      // Best-effort; flip UI state regardless
    } finally {
      setSaving(false);
    }
    setStatus("disconnected");
    setWebhookUrl("");
    setWebhookSecret("");
    setMaskedSecret(null);
    setShowInput(false);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0">{integration.icon}</div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{integration.name}</p>
            <p className="text-xs text-[color:var(--color-text-secondary)]">{CATEGORY_LABELS[integration.category]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "connected" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-bg)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
              Connected
            </span>
          )}
          {status !== "connected" && (
            <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-text-secondary)]">
              Not connected
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{integration.description}</p>

      {/* Show saved URL when connected and not editing */}
      {status === "connected" && !showInput && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">Endpoint URL</p>
          <p className="break-all font-mono text-xs text-[color:var(--color-text-primary)]">{webhookUrl}</p>
          {maskedSecret && (
            <>
              <p className="mt-1 text-xs font-medium text-[color:var(--color-text-secondary)]">Signing secret</p>
              <p className="font-mono text-xs text-[color:var(--color-text-primary)]">{maskedSecret}</p>
            </>
          )}
        </div>
      )}

      {showInput && status !== "connected" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[color:var(--color-text-primary)]">
              Endpoint URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-endpoint.com/webhook"
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[color:var(--color-text-primary)]">
              Signing secret <span className="text-[color:var(--color-text-secondary)] font-normal">(optional)</span>
            </label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Used to verify HMAC-SHA256 signature"
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 font-mono"
            />
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              We sign every request with <code className="font-mono">X-Asmos-Signature: sha256=&lt;hmac&gt;</code> when a secret is set.
            </p>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        {status !== "connected" ? (
          <button
            onClick={handleConnect}
            disabled={saving}
            className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white transition-colors duration-150 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : showInput ? "Save connection" : "Connect"}
          </button>
        ) : (
          <>
            <button
              onClick={() => { setShowInput(true); setStatus("disconnected"); }}
              disabled={saving}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)] transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              Edit
            </button>
            <button
              onClick={handleDisconnect}
              disabled={saving}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-red-500 hover:border-red-200 transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              {saving ? "Disconnecting..." : "Disconnect"}
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
    </div>
  );
}

// ── Generic facade card (Klaviyo, Mailchimp, etc.) ─────────────────────────
// The API key is genuinely saved (PATCH /api/account/integrations) and
// survives reloads. What doesn't exist yet is a background job that reads
// this key back out and actually pushes leads to the provider - hence the
// "sync is still manual" note rather than claiming full automation.

function IntegrationCard({ integration }: { integration: Integration }) {
  const [status, setStatus] = useState<IntegrationStatus>("disconnected");
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing connection state on mount.
  useEffect(() => {
    fetch("/api/account/integrations")
      .then((r) => r.json())
      .then((data: { integrations: Record<string, { connected: boolean; maskedKey: string | null }> }) => {
        const entry = data.integrations?.[integration.id];
        if (entry?.connected) {
          setStatus("connected");
          setMaskedKey(entry.maskedKey);
        }
      })
      .catch(() => {
        // Non-fatal: card still works, just starts from "not connected"
      });
  }, [integration.id]);

  async function handleConnect() {
    if (!showInput) {
      setShowInput(true);
      return;
    }
    if (!apiKey.trim()) {
      setError("Please enter your API key.");
      return;
    }
    setStatus("connecting");
    setError(null);
    try {
      const res = await fetch("/api/account/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId: integration.id, apiKey: apiKey.trim(), connected: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save. Please try again.");
        setStatus("disconnected");
        return;
      }
      setMaskedKey(data.maskedKey);
      setStatus("connected");
      setShowInput(false);
      setApiKey(""); // clear plaintext from state
    } catch {
      setError("Network error. Please try again.");
      setStatus("disconnected");
    }
  }

  async function handleDisconnect() {
    setStatus("disconnected");
    setMaskedKey(null);
    setApiKey("");
    setShowInput(false);
    setError(null);
    try {
      await fetch("/api/account/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId: integration.id, connected: false }),
      });
    } catch {
      // Best-effort; UI already reflects disconnected
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0">{integration.icon}</div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{integration.name}</p>
            <p className="text-xs text-[color:var(--color-text-secondary)]">{CATEGORY_LABELS[integration.category]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "connected" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-bg)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
              Connected
            </span>
          )}
          {status === "disconnected" && (
            <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-text-secondary)]">
              Not connected
            </span>
          )}
          {status === "connecting" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-primary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-primary)]" style={{ animation: "pulse 1s ease-in-out infinite" }} />
              Connecting...
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{integration.description}</p>

      {/* Automatic lead-forwarding isn't built yet - the key is genuinely
          saved, but nothing reads it back out to push leads to the provider. */}
      <p className="text-xs text-[color:var(--color-text-secondary)] italic">
        {status === "connected"
          ? "Key saved. Automatic lead sync is still being built - export leads manually or use Webhooks + Zapier for now."
          : "Automatic lead sync is still being built. Use Webhooks + Zapier in the meantime."}
      </p>

      {status === "connected" && !showInput && maskedKey && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">API key</p>
          <p className="font-mono text-xs text-[color:var(--color-text-primary)]">{maskedKey}</p>
        </div>
      )}

      {showInput && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[color:var(--color-text-primary)]">
            {status === "connected" ? "New API key" : "API key"}
          </label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key here"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 font-mono"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        {status !== "connected" ? (
          <button
            onClick={handleConnect}
            disabled={status === "connecting"}
            className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white transition-colors duration-150 disabled:opacity-50 cursor-pointer"
          >
            {status === "connecting" ? "Connecting..." : showInput ? "Save connection" : "Connect"}
          </button>
        ) : showInput ? (
          <>
            <button
              onClick={handleConnect}
              className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white transition-colors duration-150 cursor-pointer"
            >
              Save new key
            </button>
            <button
              onClick={() => { setShowInput(false); setApiKey(""); setError(null); }}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)] transition-colors duration-150 cursor-pointer"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowInput(true)}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)] transition-colors duration-150 cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={handleDisconnect}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-red-500 hover:border-red-200 transition-colors duration-150 cursor-pointer"
            >
              Disconnect
            </button>
          </>
        )}
        {integration.docsUrl && (
          <a
            href={integration.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[color:var(--color-primary)] hover:underline"
          >
            Docs
          </a>
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const categories = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Integrations" />
      <p className="text-sm text-[color:var(--color-text-secondary)]">
        Connect Asmos to your marketing stack. Leads and events sync automatically once a connection is active.
      </p>

      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">
            {CATEGORY_LABELS[cat]}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.filter((i) => i.category === cat).map((integration) => {
              if (integration.id === "webhooks") {
                return <WebhookCard key={integration.id} integration={integration} />;
              }
              return <IntegrationCard key={integration.id} integration={integration} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
