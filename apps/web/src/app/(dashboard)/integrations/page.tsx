"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProviderWebhookCard, type ProviderCardProps } from "@/components/integrations/ProviderWebhookCard";
import { SyncProviderCard, type SyncCardProps } from "@/components/integrations/SyncProviderCard";

type IntegrationStatus = "disconnected" | "connecting" | "connected" | "error";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "email" | "automation";
  docsUrl?: string;
  icon: React.ReactNode;
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
import { SyncProviderCard, type SyncCardProps } from "@/components/integrations/SyncProviderCard";

type IntegrationStatus = "disconnected" | "connecting" | "connected" | "error";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "email" | "automation";
  docsUrl?: string;
  icon: React.ReactNode;
}

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

// ── Provider cards (Zapier/Make/n8n/Slack/Discord/Teams) ───────────────────

type ConnState = { provider: string; connected: boolean; url: string | null; subscribedEvents: string[]; lastDelivery: { status: string; at: string } | null };

const PROVIDER_META: Array<Omit<ProviderCardProps, "initialUrl" | "initialEvents" | "initialLastDelivery"> & { group: "Automation" | "Notifications" }> = [
  { provider: "zapier", name: "Zapier", category: "Automation", group: "Automation", docsUrl: "https://zapier.com/help/create/basics/create-webhooks-from-scratch", urlLabel: "Zapier Catch Hook URL", urlPlaceholder: "https://hooks.zapier.com/hooks/catch/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#FF4A00"/><text x="10" y="27" fontSize="18" fontWeight="bold" fill="#fff">Z</text></svg> },
  { provider: "make", name: "Make", category: "Automation", group: "Automation", docsUrl: "https://www.make.com/en/help/tools/webhooks", urlLabel: "Make Custom Webhook URL", urlPlaceholder: "https://hook.eu1.make.com/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#6D00CC"/><text x="8" y="27" fontSize="18" fontWeight="bold" fill="#fff">M</text></svg> },
  { provider: "n8n", name: "n8n", category: "Automation", group: "Automation", docsUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/", urlLabel: "n8n Webhook URL", urlPlaceholder: "https://<your-n8n>/webhook/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#EA4B71"/><text x="9" y="27" fontSize="15" fontWeight="bold" fill="#fff">n8</text></svg> },
  { provider: "slack", name: "Slack", category: "Notifications", group: "Notifications", docsUrl: "https://api.slack.com/messaging/webhooks", urlLabel: "Slack Incoming Webhook URL", urlPlaceholder: "https://hooks.slack.com/services/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#4A154B"/><text x="10" y="27" fontSize="18" fontWeight="bold" fill="#fff">S</text></svg> },
  { provider: "discord", name: "Discord", category: "Notifications", group: "Notifications", docsUrl: "https://support.discord.com/hc/en-us/articles/228383668", urlLabel: "Discord Channel Webhook URL", urlPlaceholder: "https://discord.com/api/webhooks/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#5865F2"/><text x="10" y="27" fontSize="18" fontWeight="bold" fill="#fff">D</text></svg> },
  { provider: "teams", name: "Microsoft Teams", category: "Notifications", group: "Notifications", docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook", urlLabel: "Teams Incoming Webhook URL", urlPlaceholder: "https://outlook.office.com/webhook/...", icon: <svg viewBox="0 0 40 40" width="28" height="28"><rect width="40" height="40" rx="8" fill="#4B53BC"/><text x="10" y="27" fontSize="18" fontWeight="bold" fill="#fff">T</text></svg> },
];

type SyncConnState = { provider: string; connected: boolean; maskedKey: string | null; config: Record<string, string>; subscribedEvents: string[]; lastDelivery: { status: string; at: string } | null };

const SYNC_PROVIDER_META: Array<Omit<SyncCardProps, "initialMaskedKey" | "initialConfig" | "initialEvents" | "initialLastDelivery" | "category"> & { group: "Marketing sync" }> = [
  { 
    provider: "klaviyo", 
    name: "Klaviyo", 
    group: "Marketing sync", 
    docsUrl: "https://developers.klaviyo.com/en/docs/retrieve_api_credentials", 
    keyLabel: "Klaviyo Private API Key", 
    keyPlaceholder: "pk_...", 
    configFields: [{ key: "listId", label: "List ID", placeholder: "e.g. XyzAbc" }],
    icon: <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><rect width="40" height="40" rx="8" fill="#1A1A1A" /><text x="8" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="serif">K</text></svg> 
  },
  { 
    provider: "mailchimp", 
    name: "Mailchimp", 
    group: "Marketing sync", 
    docsUrl: "https://mailchimp.com/help/about-api-keys/", 
    keyLabel: "Mailchimp API Key", 
    keyPlaceholder: "xxxxxxxx-us19", 
    configFields: [{ key: "audienceId", label: "Audience ID", placeholder: "e.g. abc123def4" }],
    icon: <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><rect width="40" height="40" rx="8" fill="#FFE01B" /><text x="9" y="27" fontSize="18" fontWeight="bold" fill="#1A1A1A" fontFamily="serif">M</text></svg> 
  },
  { 
    provider: "hubspot", 
    name: "HubSpot", 
    group: "Marketing sync", 
    docsUrl: "https://knowledge.hubspot.com/integrations/how-do-i-get-my-hubspot-api-key", 
    keyLabel: "HubSpot Private App Token", 
    keyPlaceholder: "pat-...", 
    icon: <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><rect width="40" height="40" rx="8" fill="#FF7A59" /><text x="10" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">H</text></svg> 
  },
];


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

import { MessagingProviderCard, type MessagingProviderMeta } from "@/components/integrations/MessagingProviderCard";

const MESSAGING_PROVIDER_META: MessagingProviderMeta[] = [
  {
    id: "mailgun",
    name: "Mailgun",
    description: "Send automated emails to captured leads based on rules and delays.",
    docsUrl: "https://documentation.mailgun.com/en/latest/api-sending.html#sending",
    icon: (
      <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
        <rect width="40" height="40" rx="8" fill="#F03F35" />
        <text x="10" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">M</text>
      </svg>
    ),
    configFields: [
      { key: "domain", label: "Domain", placeholder: "e.g. mg.example.com" },
      { key: "region", label: "Region", placeholder: "us or eu" },
      { key: "fromAddress", label: "From Address", placeholder: "Acme <noreply@example.com>" },
      { key: "apiKey", label: "API Key", placeholder: "key-...", isSecret: true },
    ]
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "Send automated SMS to captured leads based on rules and delays.",
    docsUrl: "https://www.twilio.com/docs/sms/api/message-resource",
    icon: (
      <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
        <rect width="40" height="40" rx="8" fill="#F22F46" />
        <text x="12" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">T</text>
      </svg>
    ),
    configFields: [
      { key: "fromNumber", label: "From Phone Number", placeholder: "+15551234567" },
      { key: "accountSid", label: "Account SID", placeholder: "AC...", isSecret: true },
      { key: "authToken", label: "Auth Token", placeholder: "...", isSecret: true },
    ]
  }
];

export default function IntegrationsPage() {
  const [views, setViews] = useState<any[]>([]);
  const [syncViews, setSyncViews] = useState<any[]>([]);
  const [messagingViews, setMessagingViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/integrations/webhooks").then((res) => res.json()),
      fetch("/api/integrations/sync").then((res) => res.json()),
      fetch("/api/integrations/messaging").then((res) => res.json())
    ])
      .then(([webhooksData, syncData, messagingData]) => {
        if (!webhooksData.error) setViews(webhooksData);
        if (!syncData.error) setSyncViews(syncData);
        if (!messagingData.error) setMessagingViews(messagingData);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleMessagingSave = async (provider: string, data: any) => {
    const res = await fetch("/api/integrations/messaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...data }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.error);
    }
    const newData = await fetch("/api/integrations/messaging").then((r) => r.json());
    setMessagingViews(newData);
  };

  const handleMessagingRemove = async (provider: string) => {
    await fetch(`/api/integrations/messaging?provider=${provider}`, { method: "DELETE" });
    const newData = await fetch("/api/integrations/messaging").then((r) => r.json());
    setMessagingViews(newData);
  };

  // Rest of the UI...
  // Just putting placeholders since I can't overwrite the whole 600 line file easily in one block without losing everything else
  // To be safe I will just export a simple dummy page wrapper if needed, wait, I can just append to the component.
  const categories = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));

  const [conns, setConns] = useState<ConnState[] | null>(null);
  const [syncConns, setSyncConns] = useState<SyncConnState[] | null>(null);

  useEffect(() => {
    fetch("/api/integrations/connections").then((r) => r.json())
      .then((d: { connections: ConnState[] }) => setConns(d.connections))
      .catch(() => setConns([]));

    fetch("/api/integrations/sync").then((r) => r.json())
      .then((d: { connections: SyncConnState[] }) => setSyncConns(d.connections))
      .catch(() => setSyncConns([]));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Integrations" />
      <p className="text-sm text-[color:var(--color-text-secondary)]">
        Connect Asmos to your marketing stack. Leads and events sync automatically once a connection is active.
      </p>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Marketing sync</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SYNC_PROVIDER_META.map((m) => {
            const c = syncConns?.find((x) => x.provider === m.provider);
            return (
              <SyncProviderCard key={m.provider} {...m}
                category={m.group}
                initialMaskedKey={c?.maskedKey ?? null}
                initialConfig={c?.config ?? {}}
                initialEvents={c?.subscribedEvents ?? []}
                initialLastDelivery={c?.lastDelivery ?? null} />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Messaging</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MESSAGING_PROVIDER_META.map(meta => {
            const view = messagingViews.find(v => v.provider === meta.id);
            return (
              <MessagingProviderCard 
                key={meta.id} 
                meta={meta} 
                view={view} 
                onSave={data => handleMessagingSave(meta.id, data)}
                onRemove={() => handleMessagingRemove(meta.id)}
              />
            );
          })}
        </div>
      </section>

      {(["Automation", "Notifications"] as const).map((group) => (
        <section key={group}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">{group}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDER_META.filter((m) => m.group === group).map((m) => {
              const c = conns?.find((x) => x.provider === m.provider);
              return (
                <ProviderWebhookCard key={m.provider} {...m}
                  initialUrl={c?.url ?? null}
                  initialEvents={c?.subscribedEvents ?? []}
                  initialLastDelivery={c?.lastDelivery ?? null} />
              );
            })}
          </div>
        </section>
      ))}

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
