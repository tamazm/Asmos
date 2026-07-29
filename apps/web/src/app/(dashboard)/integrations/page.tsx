"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

type IntegrationStatus = "disconnected" | "connecting" | "connected" | "error";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "email" | "ecommerce" | "automation";
  docsUrl?: string;
  icon: React.ReactNode;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "klaviyo",
    name: "Klaviyo",
    description: "Sync captured leads directly into Klaviyo lists and trigger email flows.",
    category: "email",
    docsUrl: "https://www.klaviyo.com/",
    icon: (
      <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
        <rect width="40" height="40" rx="8" fill="#1A1A1A" />
        <text x="8" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="serif">K</text>
      </svg>
    ),
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Add email submissions to Mailchimp audiences automatically.",
    category: "email",
    docsUrl: "https://mailchimp.com/",
    icon: (
      <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
        <rect width="40" height="40" rx="8" fill="#FFE01B" />
        <text x="9" y="27" fontSize="18" fontWeight="bold" fill="#1A1A1A" fontFamily="serif">M</text>
      </svg>
    ),
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Pull product catalog data and sync discount codes with Shopify.",
    category: "ecommerce",
    docsUrl: "https://shopify.com/",
    icon: (
      <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
        <rect width="40" height="40" rx="8" fill="#96BF48" />
        <text x="12" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="serif">S</text>
      </svg>
    ),
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect Asmos to 5000+ apps. Trigger zaps on lead capture events.",
    category: "automation",
    docsUrl: "https://zapier.com/",
    icon: (
      <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
        <rect width="40" height="40" rx="8" fill="#FF4A00" />
        <text x="10" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">Z</text>
      </svg>
    ),
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Send leads to HubSpot CRM contacts and lists.",
    category: "email",
    docsUrl: "https://hubspot.com/",
    icon: (
      <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
        <rect width="40" height="40" rx="8" fill="#FF7A59" />
        <text x="10" y="27" fontSize="18" fontWeight="bold" fill="white" fontFamily="sans-serif">H</text>
      </svg>
    ),
  },
  {
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
  },
];

const CATEGORY_LABELS = {
  email: "Email marketing",
  ecommerce: "Ecommerce",
  automation: "Automation",
} as const;

function IntegrationCard({ integration }: { integration: Integration }) {
  const [status, setStatus] = useState<IntegrationStatus>("disconnected");
  const [apiKey, setApiKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConnect() {
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
    // Simulated async connect
    setTimeout(() => {
      setStatus("connected");
      setShowInput(false);
    }, 1200);
  }

  function handleDisconnect() {
    setStatus("disconnected");
    setApiKey("");
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

      {showInput && status !== "connected" && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[color:var(--color-text-primary)]">
            {integration.id === "webhooks" ? "Endpoint URL" : "API key"}
          </label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={integration.id === "webhooks" ? "https://your-endpoint.com/webhook" : "Paste your API key here"}
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
        ) : (
          <button
            onClick={handleDisconnect}
            className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-red-500 hover:border-red-200 transition-colors duration-150 cursor-pointer"
          >
            Disconnect
          </button>
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
            {INTEGRATIONS.filter((i) => i.category === cat).map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
