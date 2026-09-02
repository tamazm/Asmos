"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProviderWebhookCard, type ProviderCardProps } from "@/components/integrations/ProviderWebhookCard";
import { SyncProviderCard, type SyncCardProps } from "@/components/integrations/SyncProviderCard";
import { RequestIntegrationCard } from "@/components/integrations/RequestIntegrationCard";
import { MessagingProviderCard, type MessagingProviderMeta } from "@/components/integrations/MessagingProviderCard";
import { TestConnectionButton } from "@/components/integrations/TestConnectionButton";
import { EventSelector, EventSummary } from "@/components/integrations/EventSelector";
import { AUTOMATION_EVENT_OPTIONS, eventLabel } from "@/lib/integrations/events";

type IntegrationStatus = "disconnected" | "connecting" | "connected" | "error";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "email" | "automation";
  docsUrl?: string;
  icon: React.ReactNode;
}

const WEBHOOKS_INTEGRATION: Integration = {
  id: "webhooks",
  name: "Webhooks",
  description: "Receive real-time POST notifications for leads, winners, and campaign lifecycle changes.",
  category: "automation",
  icon: (
    <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
      <rect width="40" height="40" rx="8" fill="#6366F1" />
      <path d="M12 28l4-8 4 4 4-6 4 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const CATEGORY_LABELS = {
  email: "Email marketing",
  automation: "Automation",
} as const;

/** Category heading with a plain-language subtitle so merchants know what the group is for. */
function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">{title}</h2>
      <p className="mt-1 text-xs text-[color:var(--color-text-secondary)] opacity-80">{subtitle}</p>
    </div>
  );
}

/** Placeholder shown while a section's connection state is still loading. */
function SkeletonCard() {
  const bar = "rounded bg-[color:var(--color-surface-sunken)]";
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-lg bg-[color:var(--color-surface-sunken)]" />
        <div className="flex-1 space-y-2">
          <div className={`h-3 w-24 ${bar}`} />
          <div className={`h-2.5 w-16 ${bar}`} />
        </div>
        <div className="h-5 w-20 rounded-full bg-[color:var(--color-surface-sunken)]" />
      </div>
      <div className={`h-2.5 w-full ${bar}`} />
      <div className={`h-2.5 w-3/4 ${bar}`} />
      <div className="h-9 w-28 rounded-lg bg-[color:var(--color-surface-sunken)]" />
    </div>
  );
}

/** A grid of skeleton cards, used per-section during initial load. */
function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ── Provider cards (Zapier/Make/n8n/Slack/Discord/Teams) ───────────────────

type ConnState = { provider: string; connected: boolean; url: string | null; subscribedEvents: string[]; maskedSecret: string | null; lastDelivery: { status: string; at: string } | null };

// Actual brand logos (optimized webp in /public/integrations), replacing the
// old colored letter tiles. Rendered in a fixed 28px box; object-contain keeps
// both full-bleed color tiles and transparent marks looking right.
function LogoIcon({ provider, name }: { provider: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/integrations/${provider}.webp`}
      alt={`${name} logo`}
      width={28}
      height={28}
      className="h-7 w-7 rounded-md object-contain"
      loading="lazy"
    />
  );
}

const PROVIDER_META: Array<Omit<ProviderCardProps, "initialUrl" | "initialEvents" | "initialMaskedSecret" | "initialLastDelivery"> & { group: "Automation" | "Notifications" }> = [
  { provider: "zapier", name: "Zapier", category: "Automation", group: "Automation", supportsSigning: true, docsUrl: "https://zapier.com/help/create/basics/create-webhooks-from-scratch", setupSteps: [
      "Log in to Zapier and click Create, then Zaps to start a new Zap.",
      "For the trigger, search for and choose 'Webhooks by Zapier', then pick the 'Catch Hook' event.",
      "Zapier shows a 'Custom Webhook URL' that starts with https://hooks.zapier.com/ — click Copy.",
      "Paste it into the field above and click Save.",
    ], urlLabel: "Zapier Catch Hook URL", urlPlaceholder: "https://hooks.zapier.com/hooks/catch/...", icon: <LogoIcon provider="zapier" name="Zapier" /> },
  { provider: "make", name: "Make", category: "Automation", group: "Automation", supportsSigning: true, docsUrl: "https://www.make.com/en/help/tools/webhooks", setupSteps: [
      "Log in to Make and open (or create) the scenario you want to trigger.",
      "Add a module, search for 'Webhooks', then choose 'Custom webhook'.",
      "Click Add, give it a name and click Save — Make shows a web address; click 'Copy address to clipboard'.",
      "Paste it into the field above and click Save.",
    ], urlLabel: "Make Custom Webhook URL", urlPlaceholder: "https://hook.eu1.make.com/...", icon: <LogoIcon provider="make" name="Make" /> },
  { provider: "n8n", name: "n8n", category: "Automation", group: "Automation", supportsSigning: true, docsUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/", setupSteps: [
      "In n8n, open the workflow you want to run and add a new 'Webhook' node.",
      "Set the method to POST, then copy the 'Production URL' shown on the node.",
      "Click Save and turn the workflow Active so the web address stays live.",
      "Paste the web address into the field above and click Save.",
    ], urlLabel: "n8n Webhook URL", urlPlaceholder: "https://<your-n8n>/webhook/...", icon: <LogoIcon provider="n8n" name="n8n" /> },
  { provider: "googlesheets", name: "Google Sheets", category: "Automation", group: "Automation", docsUrl: "https://developers.google.com/apps-script/guides/web", setupSteps: [
      "Create a Google Sheet, then open 'Extensions' → 'Apps Script'.",
      "Delete any starter code and paste this, then click Save: function doPost(e){var s=SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();var d=JSON.parse(e.postData.contents);if(d.event!=='lead.captured'){return ContentService.createTextOutput('ok');}var l=(d.payload&&d.payload.lead)||{};s.appendRow([new Date(),l.email||'',l.name||'',l.phone||'',(d.payload&&d.payload.campaign_name)||'']);return ContentService.createTextOutput('ok');}",
      "Click 'Deploy' → 'New deployment'. For type choose 'Web app'. Set 'Execute as: Me' and 'Who has access: Anyone', then click 'Deploy' and authorize.",
      "Copy the 'Web app' URL it shows (it ends in /exec).",
      "Paste that URL into the field above and click Save. Keep only 'Lead captured' selected so the sheet fills with leads.",
    ], urlLabel: "Apps Script Web App URL", urlPlaceholder: "https://script.google.com/macros/s/.../exec", icon: <LogoIcon provider="googlesheets" name="Google Sheets" /> },
  { provider: "slack", name: "Slack", category: "Notifications", group: "Notifications", docsUrl: "https://api.slack.com/messaging/webhooks", setupSteps: [
      "Go to api.slack.com/apps and click 'Create New App' (choose 'From scratch'), then pick your workspace.",
      "In the app's left menu, open 'Incoming Webhooks' and switch the toggle On.",
      "Click 'Add New Webhook to Workspace', choose the channel for alerts, and click Allow.",
      "Copy the Webhook URL Slack gives you (it starts with https://hooks.slack.com/).",
      "Paste it into the field above and click Save.",
    ], urlLabel: "Slack Incoming Webhook URL", urlPlaceholder: "https://hooks.slack.com/services/...", icon: <LogoIcon provider="slack" name="Slack" /> },
  { provider: "discord", name: "Discord", category: "Notifications", group: "Notifications", docsUrl: "https://support.discord.com/hc/en-us/articles/228383668", setupSteps: [
      "In Discord, open the channel where you want alerts and click the gear icon ('Edit Channel').",
      "Go to 'Integrations', then 'Webhooks', and click 'New Webhook'.",
      "Give it a name, then click 'Copy Webhook URL'.",
      "Paste it into the field above and click Save.",
    ], urlLabel: "Discord Channel Webhook URL", urlPlaceholder: "https://discord.com/api/webhooks/...", icon: <LogoIcon provider="discord" name="Discord" /> },
  { provider: "teams", name: "Microsoft Teams", category: "Notifications", group: "Notifications", docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook", setupSteps: [
      "In Teams, find the channel where you want alerts and click the '...' menu next to its name.",
      "Choose 'Workflows' and pick the 'Post to a channel when a webhook request is received' template.",
      "Follow the prompts to add it, then copy the web address (URL) it creates for you.",
      "Paste it into the field above and click Save.",
    ], urlLabel: "Teams Incoming Webhook URL", urlPlaceholder: "https://outlook.office.com/webhook/...", icon: <LogoIcon provider="teams" name="Microsoft Teams" /> },
];

type SyncConnState = { provider: string; connected: boolean; maskedKey: string | null; authType: "apiKey" | "oauth" | null; config: Record<string, string>; subscribedEvents: string[]; lastDelivery: { status: string; at: string } | null };

const SYNC_PROVIDER_META: Array<Omit<SyncCardProps, "initialMaskedKey" | "initialConfig" | "initialEvents" | "initialLastDelivery" | "category"> & { group: "Marketing sync" }> = [
  {
    provider: "klaviyo",
    name: "Klaviyo",
    group: "Marketing sync",
    docsUrl: "https://developers.klaviyo.com/en/docs/retrieve_api_credentials",
    setupGuide: {
      url: "https://developers.klaviyo.com/en/docs/retrieve_api_credentials",
      steps: [
        "Log in to Klaviyo and click your account name (bottom-left), then 'Settings'.",
        "Open the 'API keys' tab, click 'Create Private API Key', choose 'Custom Key', and select only Lists: read, Lists: write, Profiles: write, Subscriptions: write, and Events: write. Do not use Full Access. Then copy the key (it starts with pk_).",
        "For the List ID, go to 'Audience' → 'Lists & Segments', open the list you want, and copy the List ID shown under its name.",
        "Paste the API key and List ID into the fields above and click Save connection.",
      ],
    },
    keyLabel: "Klaviyo Private API Key",
    keyPlaceholder: "pk_...",
    configFields: [{ key: "listId", label: "List ID", placeholder: "e.g. XyzAbc" }],
    icon: <LogoIcon provider="klaviyo" name="Klaviyo" />
  },
  {
    provider: "mailchimp",
    name: "Mailchimp",
    group: "Marketing sync",
    authMode: "oauth",
    oauthUrl: "/api/integrations/mailchimp/authorize",
    docsUrl: "https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/",
    setupGuide: {
      url: "https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/",
      steps: [
        "Click 'Connect Mailchimp' and authorize Asmos in Mailchimp. Asmos uses OAuth, so you do not need to paste an account-wide API key.",
        "For the Audience ID, go to 'Audience' → 'Audience dashboard' → 'Settings' → 'Audience name and defaults' and copy the 'Audience ID'.",
        "After authorization, click Edit on this card, enter the Audience ID, and click Save connection.",
      ],
    },
    configFields: [{ key: "audienceId", label: "Audience ID", placeholder: "e.g. abc123def4" }],
    icon: <LogoIcon provider="mailchimp" name="Mailchimp" />
  },
  {
    provider: "hubspot",
    name: "HubSpot",
    group: "Marketing sync",
    docsUrl: "https://knowledge.hubspot.com/integrations/how-do-i-get-my-hubspot-api-key",
    setupGuide: {
      url: "https://knowledge.hubspot.com/integrations/how-do-i-get-my-hubspot-api-key",
      steps: [
        "In HubSpot, click the gear icon (Settings), then in the left menu go to 'Integrations' → 'Private Apps'.",
        "Click 'Create a private app', give it a name, and open the 'Scopes' tab.",
        "Tick the CRM contacts read and write permissions, then click 'Create app' and confirm.",
        "Copy the access token it shows (it starts with pat-).",
        "Paste it into the field above and click Save connection.",
      ],
    },
    keyLabel: "HubSpot Private App Token",
    keyPlaceholder: "pat-...",
    icon: <LogoIcon provider="hubspot" name="HubSpot" />
  },
  {
    provider: "omnisend",
    name: "Omnisend",
    group: "Marketing sync",
    docsUrl: "https://api-docs.omnisend.com/reference/intro",
    setupGuide: {
      url: "https://api-docs.omnisend.com/reference/intro",
      steps: [
        "Log in to Omnisend and open 'Store settings' → 'Integrations & API' → 'API keys'.",
        "Click 'Create API key', give it a name, and copy the key it shows.",
        "Paste the API key into the field above and click Save connection. New leads become subscribed contacts tagged 'asmos'.",
      ],
    },
    keyLabel: "Omnisend API Key",
    keyPlaceholder: "e.g. 6543ab...",
    icon: <LogoIcon provider="omnisend" name="Omnisend" />
  },
  {
    provider: "brevo",
    name: "Brevo",
    group: "Marketing sync",
    docsUrl: "https://developers.brevo.com/docs/getting-started",
    setupGuide: {
      url: "https://developers.brevo.com/docs/getting-started",
      steps: [
        "Log in to Brevo, click your account name (top-right), then 'SMTP & API' → the 'API Keys' tab.",
        "Click 'Generate a new API key', name it, and copy it (it starts with xkeysib-).",
        "For the List ID, go to 'Contacts' → 'Lists' and copy the numeric ID shown next to the list you want.",
        "Paste the API key and List ID into the fields above and click Save connection.",
      ],
    },
    keyLabel: "Brevo API Key",
    keyPlaceholder: "xkeysib-...",
    configFields: [{ key: "listId", label: "List ID", placeholder: "e.g. 3" }],
    icon: <LogoIcon provider="brevo" name="Brevo" />
  },
  {
    provider: "mailerlite",
    name: "MailerLite",
    group: "Marketing sync",
    docsUrl: "https://developers.mailerlite.com/docs",
    setupGuide: {
      url: "https://developers.mailerlite.com/docs",
      steps: [
        "Log in to MailerLite and open 'Integrations' from the top menu.",
        "Find 'MailerLite API', click 'Use', then 'Generate new token'.",
        "Name the token and copy it.",
        "Paste it into the field above and click Save connection. New leads are added to your subscribers.",
      ],
    },
    keyLabel: "MailerLite API Key",
    keyPlaceholder: "eyJ0eXAi...",
    icon: <LogoIcon provider="mailerlite" name="MailerLite" />
  },
  {
    provider: "drip",
    name: "Drip",
    group: "Marketing sync",
    docsUrl: "https://developer.drip.com/",
    setupGuide: {
      url: "https://developer.drip.com/",
      steps: [
        "Log in to Drip, click the user menu (top-right) → 'Settings' → 'User Settings', and copy your API token.",
        "For the Account ID, go to 'Settings' → 'Account' → 'General info' and copy the numeric Account ID.",
        "Paste the token and Account ID into the fields above and click Save connection. New leads are tagged 'Asmos'.",
      ],
    },
    keyLabel: "Drip API Token",
    keyPlaceholder: "e.g. 1a2b3c...",
    configFields: [{ key: "accountId", label: "Account ID", placeholder: "e.g. 1234567" }],
    icon: <LogoIcon provider="drip" name="Drip" />
  },
];


// ── Webhook card (real API) ────────────────────────────────────────────────

function WebhookCard({ integration }: { integration: Integration }) {
  const [status, setStatus] = useState<IntegrationStatus>("disconnected");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [maskedSecret, setMaskedSecret] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>(AUTOMATION_EVENT_OPTIONS.map((event) => event.id));
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load existing config on mount
  useEffect(() => {
    fetch("/api/account/webhook")
      .then((r) => r.json())
      .then((data: { webhookUrl: string | null; webhookSecret: string | null; webhookEnabled: boolean; subscribedEvents?: string[] }) => {
        if (data.webhookEnabled && data.webhookUrl) {
          setWebhookUrl(data.webhookUrl);
          setMaskedSecret(data.webhookSecret);
          setEvents(data.subscribedEvents?.length ? data.subscribedEvents : AUTOMATION_EVENT_OPTIONS.map((event) => event.id));
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
          subscribedEvents: events,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save. Please try again.");
        return;
      }
      setMaskedSecret(data.webhookSecret);
      setEvents(data.subscribedEvents?.length ? data.subscribedEvents : events);
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
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-sm sm:p-5">
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
          <EventSummary events={events} eventLabel={eventLabel} />
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
          <EventSelector
            options={AUTOMATION_EVENT_OPTIONS}
            selected={events}
            onToggle={(id) => setEvents((current) => current.includes(id) ? current.filter((eventId) => eventId !== id) : [...current, id])}
          />
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

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[color:var(--color-border)] pt-3">
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
            <TestConnectionButton provider={integration.id} />
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

// ── Page ──────────────────────────────────────────────────────────────────

const MESSAGING_PROVIDER_META: MessagingProviderMeta[] = [
  {
    id: "mailgun",
    name: "Mailgun",
    description: "Send automated emails to captured leads based on rules and delays.",
    docsUrl: "https://documentation.mailgun.com/en/latest/api-sending.html#sending",
    setupSteps: [
      "Log in to Mailgun and open 'Send' → 'Domains'; copy your sending domain (it looks like mg.example.com).",
      "Note the region shown next to that domain — type 'us' or 'eu' in the Region field.",
      "For the From Address, use a sender at your domain, like Acme <noreply@mg.example.com>.",
      "Get your API key from the profile menu → 'API Keys' (or 'API security') and copy the sending key.",
      "Paste the domain, region, from address, and API key into the fields above and click Save Connection.",
    ],
    icon: <LogoIcon provider="mailgun" name="Mailgun" />,
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
    requiresRestrictedKey: true,
    docsUrl: "https://www.twilio.com/docs/sms/api/message-resource",
    setupSteps: [
      "Log in to the Twilio Console at console.twilio.com.",
      "Open Account Security and create a Restricted API Key. Allow only the permission to create messages, then copy the Key SID and secret.",
      "Go to 'Phone Numbers' → 'Manage' → 'Active numbers' and copy the number you'll text from (in +15551234567 format).",
      "Paste the Account SID, Restricted API Key SID, secret, and sending number into the fields above and click Save Connection.",
    ],
    icon: <LogoIcon provider="twilio" name="Twilio" />,
    configFields: [
      { key: "fromNumber", label: "From Phone Number", placeholder: "+15551234567" },
      { key: "accountSid", label: "Account SID", placeholder: "AC..." },
      { key: "apiKeySid", label: "Restricted API Key SID", placeholder: "SK..." },
      { key: "apiKeySecret", label: "Restricted API Key Secret", placeholder: "...", isSecret: true },
    ]
  }
];

export default function IntegrationsPage() {
  const [messagingViews, setMessagingViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved messaging (Mailgun/Twilio) connection state. Independent and
    // resilient: a failure must not block the rest of the page from rendering.
    fetch("/api/integrations/messaging")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMessagingViews(data);
      })
      .catch(() => {
        // Non-fatal: cards still render, just starting from "not connected".
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
      <p className="-mt-5 text-xs text-[color:var(--color-text-secondary)]">
        See how integration data and credentials are handled in our{" "}
        <a
          href="https://asmos.io/privacy-policy"
          className="text-[color:var(--color-primary)] underline underline-offset-2 hover:text-[color:var(--color-primary-dark)]"
        >
          Privacy Policy
        </a>
        .
      </p>

      {/* 1. Marketing — the priority for ecommerce: get leads into the tools that actually sell. */}
      <section>
        <SectionHeading title="Marketing" subtitle="Send captured leads straight into the email & CRM tools you sell with." />
        {syncConns === null ? (
          <SkeletonGrid count={SYNC_PROVIDER_META.length} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SYNC_PROVIDER_META.map((m) => {
              const c = syncConns?.find((x) => x.provider === m.provider);
              return (
                <SyncProviderCard key={m.provider} {...m}
                  category={m.group}
                  initialMaskedKey={c?.maskedKey ?? null}
                  initialAuthType={c?.authType ?? null}
                  initialConfig={c?.config ?? {}}
                  initialEvents={c?.subscribedEvents ?? []}
                  initialLastDelivery={c?.lastDelivery ?? null} />
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Messaging — reach the lead directly. */}
      <section>
        <SectionHeading title="Messaging" subtitle="Automatically email or text a lead the moment they convert." />
        {loading ? (
          <SkeletonGrid count={MESSAGING_PROVIDER_META.length} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MESSAGING_PROVIDER_META.map((meta) => {
              const view = messagingViews.find((v) => v.provider === meta.id);
              return (
                <MessagingProviderCard
                  key={meta.id}
                  meta={meta}
                  view={view}
                  onSave={(data) => handleMessagingSave(meta.id, data)}
                  onRemove={() => handleMessagingRemove(meta.id)}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Automation — pipe events anywhere, including your own endpoint. */}
      <section>
        <SectionHeading title="Automation" subtitle="Pipe lead & winner events into any workflow tool — or your own endpoint." />
        {conns === null ? (
          <SkeletonGrid count={PROVIDER_META.filter((m) => m.group === "Automation").length + 1} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDER_META.filter((m) => m.group === "Automation").map((m) => {
              const c = conns?.find((x) => x.provider === m.provider);
              return (
                <ProviderWebhookCard key={m.provider} {...m}
                  initialUrl={c?.url ?? null}
                  initialEvents={c?.subscribedEvents ?? []}
                  initialMaskedSecret={c?.maskedSecret ?? null}
                  initialLastDelivery={c?.lastDelivery ?? null} />
              );
            })}
            <WebhookCard integration={WEBHOOKS_INTEGRATION} />
          </div>
        )}
      </section>

      {/* 4. Notifications — team alerts. */}
      <section>
        <SectionHeading title="Notifications" subtitle="Get a ping in your team chat on every new lead and test winner." />
        {conns === null ? (
          <SkeletonGrid count={PROVIDER_META.filter((m) => m.group === "Notifications").length} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDER_META.filter((m) => m.group === "Notifications").map((m) => {
              const c = conns?.find((x) => x.provider === m.provider);
              return (
                <ProviderWebhookCard key={m.provider} {...m}
                  initialUrl={c?.url ?? null}
                  initialEvents={c?.subscribedEvents ?? []}
                  initialMaskedSecret={c?.maskedSecret ?? null}
                  initialLastDelivery={c?.lastDelivery ?? null} />
              );
            })}
          </div>
        )}
      </section>

      {/* Request an integration we don't offer yet — sent to superadmins. */}
      <section>
        <RequestIntegrationCard />
      </section>
    </div>
  );
}
