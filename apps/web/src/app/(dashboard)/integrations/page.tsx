"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { IntegrationCard, type IntegrationStatus } from "@/components/integrations/IntegrationCard";
import { IntegrationConfigModal } from "@/components/integrations/IntegrationConfigModal";
import { RequestIntegrationCard } from "@/components/integrations/RequestIntegrationCard";
import { computeProviderStatus } from "@/lib/integrations/providerStatus";

// ── Icons ──────────────────────────────────────────────────────────────────

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

const CUSTOM_WEBHOOK_ICON = (
  <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
    <rect width="40" height="40" rx="8" fill="#6366F1" />
    <path d="M12 28l4-8 4 4 4-6 4 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SHOPIFY_ICON = <LogoIcon provider="shopify" name="Shopify" />;

// ── Types ──────────────────────────────────────────────────────────────────

type CategoryId = "all" | "store" | "marketing" | "messaging" | "automation" | "notifications";

interface ProviderBaseMeta {
  id: string;
  name: string;
  category: "Stores" | "Marketing" | "Messaging" | "Automation" | "Notifications";
  categoryId: CategoryId;
  description: string;
  icon: React.ReactNode;
  docsUrl?: string;
  setupSteps?: string[];
  setupGuide?: { url: string; steps: string[] };
}

interface ShopifyMeta extends ProviderBaseMeta {
  type: "shopify";
  directInstallUrl: string;
}

interface SyncMeta extends ProviderBaseMeta {
  type: "sync";
  authMode?: "apiKey" | "oauth";
  oauthUrl?: string;
  keyLabel?: string;
  keyPlaceholder?: string;
  configFields?: Array<{ key: string; label: string; placeholder: string }>;
}

interface WebhookMeta extends ProviderBaseMeta {
  type: "webhook";
  urlLabel: string;
  urlPlaceholder: string;
  supportsSigning?: boolean;
}

interface CustomWebhookMeta extends ProviderBaseMeta {
  type: "custom-webhook";
}

interface MessagingMeta extends ProviderBaseMeta {
  type: "messaging";
  requiresRestrictedKey?: boolean;
  configFields: Array<{ key: string; label: string; placeholder: string; isSecret?: boolean }>;
}

type ProviderDefinition = ShopifyMeta | SyncMeta | WebhookMeta | CustomWebhookMeta | MessagingMeta;

// ── Providers Catalog ──────────────────────────────────────────────────────

const SYNC_PROVIDERS: SyncMeta[] = [
  {
    id: "klaviyo",
    name: "Klaviyo",
    category: "Marketing",
    categoryId: "marketing",
    type: "sync",
    description: "Sync captured leads automatically into Klaviyo lists and segments.",
    docsUrl: "https://developers.klaviyo.com/en/docs/retrieve_api_credentials",
    setupGuide: {
      url: "https://developers.klaviyo.com/en/docs/retrieve_api_credentials",
      steps: [
        "Log in to Klaviyo and click your account name (bottom-left), then 'Settings'.",
        "Open 'API keys', click 'Create Private API Key', and select Lists: read/write, Profiles: write, Subscriptions: write, and Events: write.",
        "For List ID, go to 'Audience' → 'Lists & Segments', open your list, and copy the List ID under its title.",
        "Paste the API key and List ID into the fields and save.",
      ],
    },
    keyLabel: "Klaviyo Private API Key",
    keyPlaceholder: "pk_...",
    configFields: [{ key: "listId", label: "List ID", placeholder: "e.g. XyzAbc" }],
    icon: <LogoIcon provider="klaviyo" name="Klaviyo" />,
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "Marketing",
    categoryId: "marketing",
    type: "sync",
    authMode: "oauth",
    oauthUrl: "/api/integrations/mailchimp/authorize",
    description: "Add leads to your Mailchimp audiences automatically via secure OAuth.",
    docsUrl: "https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/",
    setupGuide: {
      url: "https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/",
      steps: [
        "Click 'Authorize Mailchimp via OAuth' and grant permissions. Asmos uses OAuth so you don't need account-wide keys.",
        "For Audience ID, open 'Audience' → 'Settings' → 'Audience name and defaults' and copy the Audience ID.",
        "Enter your Audience ID and save your connection.",
      ],
    },
    configFields: [{ key: "audienceId", label: "Audience ID", placeholder: "e.g. abc123def4" }],
    icon: <LogoIcon provider="mailchimp" name="Mailchimp" />,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "Marketing",
    categoryId: "marketing",
    type: "sync",
    description: "Sync captured leads into HubSpot CRM contacts with full form attribution.",
    docsUrl: "https://knowledge.hubspot.com/integrations/how-do-i-get-my-hubspot-api-key",
    setupGuide: {
      url: "https://knowledge.hubspot.com/integrations/how-do-i-get-my-hubspot-api-key",
      steps: [
        "In HubSpot, go to Settings (gear icon) → 'Integrations' → 'Private Apps'.",
        "Click 'Create a private app' and under 'Scopes', tick CRM contacts read and write permissions.",
        "Click 'Create app', copy the access token (starts with pat-), and paste it below.",
      ],
    },
    keyLabel: "HubSpot Private App Token",
    keyPlaceholder: "pat-...",
    icon: <LogoIcon provider="hubspot" name="HubSpot" />,
  },
  {
    id: "omnisend",
    name: "Omnisend",
    category: "Marketing",
    categoryId: "marketing",
    type: "sync",
    description: "Push leads directly into your Omnisend ecommerce email & SMS automation flows.",
    docsUrl: "https://api-docs.omnisend.com/reference/intro",
    setupGuide: {
      url: "https://api-docs.omnisend.com/reference/intro",
      steps: [
        "Log in to Omnisend and open 'Store settings' → 'Integrations & API' → 'API keys'.",
        "Click 'Create API key', name it 'Asmos', and copy the generated key.",
        "Paste the key below and save. New leads become subscribed contacts tagged 'asmos'.",
      ],
    },
    keyLabel: "Omnisend API Key",
    keyPlaceholder: "e.g. 6543ab...",
    icon: <LogoIcon provider="omnisend" name="Omnisend" />,
  },
  {
    id: "brevo",
    name: "Brevo",
    category: "Marketing",
    categoryId: "marketing",
    type: "sync",
    description: "Sync leads into Brevo (Sendinblue) contact lists for automated email marketing.",
    docsUrl: "https://developers.brevo.com/docs/getting-started",
    setupGuide: {
      url: "https://developers.brevo.com/docs/getting-started",
      steps: [
        "Log in to Brevo, click your account menu → 'SMTP & API' → 'API Keys' tab.",
        "Click 'Generate a new API key' (starts with xkeysib-) and copy it.",
        "Under 'Contacts' → 'Lists', copy the numeric List ID you want to sync into.",
        "Paste the API key and List ID below and save.",
      ],
    },
    keyLabel: "Brevo API Key",
    keyPlaceholder: "xkeysib-...",
    configFields: [{ key: "listId", label: "List ID", placeholder: "e.g. 3" }],
    icon: <LogoIcon provider="brevo" name="Brevo" />,
  },
  {
    id: "mailerlite",
    name: "MailerLite",
    category: "Marketing",
    categoryId: "marketing",
    type: "sync",
    description: "Add new leads directly to your MailerLite subscriber lists upon form completion.",
    docsUrl: "https://developers.mailerlite.com/docs",
    setupGuide: {
      url: "https://developers.mailerlite.com/docs",
      steps: [
        "Log in to MailerLite and navigate to 'Integrations'.",
        "Find 'MailerLite API', click 'Use', then 'Generate new token'.",
        "Name the token, copy it, and paste it below.",
      ],
    },
    keyLabel: "MailerLite API Key",
    keyPlaceholder: "eyJ0eXAi...",
    icon: <LogoIcon provider="mailerlite" name="MailerLite" />,
  },
  {
    id: "drip",
    name: "Drip",
    category: "Marketing",
    categoryId: "marketing",
    type: "sync",
    description: "Sync leads into Drip for smart ecommerce marketing automation and segmentation.",
    docsUrl: "https://developer.drip.com/",
    setupGuide: {
      url: "https://developer.drip.com/",
      steps: [
        "In Drip, click your user menu → 'Settings' → 'User Settings' to copy your API token.",
        "Under 'Settings' → 'Account' → 'General info', copy your numeric Account ID.",
        "Paste the token and Account ID below and save.",
      ],
    },
    keyLabel: "Drip API Token",
    keyPlaceholder: "e.g. 1a2b3c...",
    configFields: [{ key: "accountId", label: "Account ID", placeholder: "e.g. 1234567" }],
    icon: <LogoIcon provider="drip" name="Drip" />,
  },
];

const MESSAGING_PROVIDERS: MessagingMeta[] = [
  {
    id: "mailgun",
    name: "Mailgun",
    category: "Messaging",
    categoryId: "messaging",
    type: "messaging",
    description: "Send automated, personalized transactional emails to new leads with dynamic templates.",
    docsUrl: "https://documentation.mailgun.com/en/latest/api-sending.html#sending",
    setupSteps: [
      "In Mailgun, go to 'Send' → 'Domains' and copy your sending domain (e.g. mg.yourdomain.com).",
      "Enter the region ('us' or 'eu') and your From Address (e.g. Acme <hello@mg.yourdomain.com>).",
      "In your profile menu → 'API Security', create or copy a Sending API key.",
      "Paste your credentials and save to begin sending emails.",
    ],
    icon: <LogoIcon provider="mailgun" name="Mailgun" />,
    configFields: [
      { key: "domain", label: "Domain", placeholder: "e.g. mg.example.com" },
      { key: "region", label: "Region", placeholder: "us or eu" },
      { key: "fromAddress", label: "From Address", placeholder: "Acme <noreply@example.com>" },
      { key: "apiKey", label: "API Key", placeholder: "key-...", isSecret: true },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "Messaging",
    categoryId: "messaging",
    type: "messaging",
    requiresRestrictedKey: true,
    description: "Send automated SMS text messages to captured leads with instant or delayed triggers.",
    docsUrl: "https://www.twilio.com/docs/sms/api/message-resource",
    setupSteps: [
      "In Twilio Console, open 'Account Security' and create a Restricted API Key with messaging permissions.",
      "Copy your Account SID, the Restricted API Key SID, and secret.",
      "Under 'Phone Numbers' → 'Active numbers', copy your sending phone number (e.g. +15551234567).",
      "Paste your credentials below. If your popups don't collect phone numbers yet, you can add the field with one click.",
    ],
    icon: <LogoIcon provider="twilio" name="Twilio" />,
    configFields: [
      { key: "fromNumber", label: "From Phone Number", placeholder: "+15551234567" },
      { key: "accountSid", label: "Account SID", placeholder: "AC..." },
      { key: "apiKeySid", label: "Restricted API Key SID", placeholder: "SK..." },
      { key: "apiKeySecret", label: "Restricted API Key Secret", placeholder: "...", isSecret: true },
    ],
  },
];

const AUTOMATION_PROVIDERS: (WebhookMeta | CustomWebhookMeta)[] = [
  {
    id: "zapier",
    name: "Zapier",
    category: "Automation",
    categoryId: "automation",
    type: "webhook",
    supportsSigning: true,
    description: "Trigger Zaps and connect to 5,000+ apps when leads are captured or tests conclude.",
    docsUrl: "https://zapier.com/help/create/basics/create-webhooks-from-scratch",
    setupSteps: [
      "In Zapier, click 'Create' → 'Zaps' to start a new Zap.",
      "For trigger, choose 'Webhooks by Zapier' and select the 'Catch Hook' event.",
      "Copy the 'Custom Webhook URL' provided by Zapier (starts with https://hooks.zapier.com/).",
      "Paste it into the endpoint URL field below and save.",
    ],
    urlLabel: "Zapier Catch Hook URL",
    urlPlaceholder: "https://hooks.zapier.com/hooks/catch/...",
    icon: <LogoIcon provider="zapier" name="Zapier" />,
  },
  {
    id: "make",
    name: "Make",
    category: "Automation",
    categoryId: "automation",
    type: "webhook",
    supportsSigning: true,
    description: "Run automated multi-step scenarios in Make when leads are captured in Asmos.",
    docsUrl: "https://www.make.com/en/help/tools/webhooks",
    setupSteps: [
      "In Make, open or create a scenario.",
      "Add a module, search for 'Webhooks', and choose 'Custom webhook'.",
      "Click Add, give it a name, save, and copy the generated address.",
      "Paste it into the endpoint URL field below and save.",
    ],
    urlLabel: "Make Custom Webhook URL",
    urlPlaceholder: "https://hook.eu1.make.com/...",
    icon: <LogoIcon provider="make" name="Make" />,
  },
  {
    id: "n8n",
    name: "n8n",
    category: "Automation",
    categoryId: "automation",
    type: "webhook",
    supportsSigning: true,
    description: "Send lead and campaign webhook payloads to self-hosted or cloud n8n workflows.",
    docsUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
    setupSteps: [
      "In n8n, open your workflow and add a new 'Webhook' node.",
      "Set the method to POST, then copy the 'Production URL'.",
      "Activate the workflow and paste the URL below.",
    ],
    urlLabel: "n8n Webhook URL",
    urlPlaceholder: "https://<your-n8n>/webhook/...",
    icon: <LogoIcon provider="n8n" name="n8n" />,
  },
  {
    id: "googlesheets",
    name: "Google Sheets",
    category: "Automation",
    categoryId: "automation",
    type: "webhook",
    description: "Automatically append new leads and conversion data into your Google spreadsheet.",
    docsUrl: "https://developers.google.com/apps-script/guides/web",
    setupSteps: [
      "Create a Google Sheet, then open 'Extensions' → 'Apps Script'.",
      "Delete any starter code and paste this script:\nfunction doPost(e){\n  var s = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();\n  var d = JSON.parse(e.postData.contents);\n  if (d.event !== 'lead.captured') {\n    return ContentService.createTextOutput('ok');\n  }\n  var l = (d.payload && d.payload.lead) || {};\n  s.appendRow([\n    new Date(),\n    l.email || '',\n    l.name || '',\n    l.phone || '',\n    (d.payload && d.payload.campaign_name) || ''\n  ]);\n  return ContentService.createTextOutput('ok');\n}",
      "Click 'Deploy' → 'New deployment'. For type choose 'Web app'. Set 'Execute as: Me' and 'Who has access: Anyone', then click 'Deploy' and authorize access.",
      "Copy the 'Web app' URL it shows (it ends in /exec).",
      "Paste that URL into the Webhook URL field below and click Save. Keep only 'Lead captured' selected.",
    ],
    urlLabel: "Apps Script Web App URL",
    urlPlaceholder: "https://script.google.com/macros/s/.../exec",
    icon: <LogoIcon provider="googlesheets" name="Google Sheets" />,
  },
  {
    id: "webhooks",
    name: "Custom Webhooks",
    category: "Automation",
    categoryId: "automation",
    type: "custom-webhook",
    description: "Receive real-time signed HTTP POST notifications for leads, winners, and lifecycle changes.",
    icon: CUSTOM_WEBHOOK_ICON,
  },
];

const NOTIFICATION_PROVIDERS: WebhookMeta[] = [
  {
    id: "slack",
    name: "Slack",
    category: "Notifications",
    categoryId: "notifications",
    type: "webhook",
    description: "Get instant notifications in your team Slack channels on leads and winning variants.",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    setupSteps: [
      "Go to api.slack.com/apps and create a new app 'From scratch'.",
      "Under 'Incoming Webhooks', toggle the switch On and click 'Add New Webhook to Workspace'.",
      "Select your alert channel, click Allow, and copy the Webhook URL (starts with https://hooks.slack.com/).",
      "Paste the URL below and save.",
    ],
    urlLabel: "Slack Incoming Webhook URL",
    urlPlaceholder: "https://hooks.slack.com/services/...",
    icon: <LogoIcon provider="slack" name="Slack" />,
  },
  {
    id: "discord",
    name: "Discord",
    category: "Notifications",
    categoryId: "notifications",
    type: "webhook",
    description: "Post real-time event updates and conversion alerts to your Discord channels.",
    docsUrl: "https://support.discord.com/hc/en-us/articles/228383668",
    setupSteps: [
      "In Discord, open channel settings (gear icon) for the alert channel.",
      "Go to 'Integrations' → 'Webhooks' and click 'New Webhook'.",
      "Copy the Webhook URL and paste it below.",
    ],
    urlLabel: "Discord Channel Webhook URL",
    urlPlaceholder: "https://discord.com/api/webhooks/...",
    icon: <LogoIcon provider="discord" name="Discord" />,
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    category: "Notifications",
    categoryId: "notifications",
    type: "webhook",
    description: "Send channel messages in Microsoft Teams on new leads and campaign updates.",
    docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
    setupSteps: [
      "In Teams, find the channel for alerts and click '...' → 'Workflows'.",
      "Choose 'Post to a channel when a webhook request is received'.",
      "Complete the setup and copy the web address created for you.",
      "Paste the URL below and save.",
    ],
    urlLabel: "Teams Incoming Webhook URL",
    urlPlaceholder: "https://outlook.office.com/webhook/...",
    icon: <LogoIcon provider="teams" name="Microsoft Teams" />,
  },
];

const SHOPIFY_DIRECT_INSTALL_URL =
  "https://admin.shopify.com/?organization_id=232604728&no_redirect=true&redirect=/oauth/redirect_from_developer_dashboard?client_id%3De5b2175bf18f463fec0d6062e12e4c3c";

const SHOPIFY_PROVIDER: ShopifyMeta = {
  id: "shopify",
  type: "shopify",
  name: "Shopify",
  category: "Stores",
  categoryId: "store",
  description:
    "Core store integration for automatic discount code generation, customer cart & checkout tracking, and theme popups.",
  icon: SHOPIFY_ICON,
  docsUrl: "https://help.shopify.com/en/manual/apps",
  directInstallUrl: SHOPIFY_DIRECT_INSTALL_URL,
  setupSteps: [
    "Install the Asmos app to your Shopify store via your developer dashboard or enter your store domain.",
    "Approve the required permissions to sync discounts and customer conversion events.",
    "Activate the Asmos theme app embed in your Shopify Theme Editor.",
  ],
  setupGuide: {
    url: "https://admin.shopify.com",
    steps: [
      "Click 'Install on Shopify' to open your store's authorization screen.",
      "Select your store and approve the Asmos application.",
      "Enable the app embed in Online Store > Themes > Customize > App Embeds.",
    ],
  },
};

const ALL_PROVIDERS: ProviderDefinition[] = [
  SHOPIFY_PROVIDER,
  ...SYNC_PROVIDERS,
  ...MESSAGING_PROVIDERS,
  ...AUTOMATION_PROVIDERS,
  ...NOTIFICATION_PROVIDERS,
];

// ── Categories List ────────────────────────────────────────────────────────

const CATEGORIES: { id: CategoryId; label: string; count: number }[] = [
  { id: "all", label: "All", count: ALL_PROVIDERS.length },
  { id: "store", label: "Stores", count: 1 },
  { id: "marketing", label: "Marketing", count: SYNC_PROVIDERS.length },
  { id: "messaging", label: "Messaging", count: MESSAGING_PROVIDERS.length },
  { id: "automation", label: "Automation", count: AUTOMATION_PROVIDERS.length },
  { id: "notifications", label: "Notifications", count: NOTIFICATION_PROVIDERS.length },
];

// ── Main Page Component ────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyConnected, setOnlyConnected] = useState(false);
  const [activeModalProviderId, setActiveModalProviderId] = useState<string | null>(null);

  // Connection data states
  const [shopifyConn, setShopifyConn] = useState<{
    connected: boolean;
    shop: {
      id: string;
      shopDomain: string;
      installedAt: string;
      linkedAt: string | null;
      websiteId?: string | null;
    } | null;
  } | null>(null);
  const [syncConns, setSyncConns] = useState<any[] | null>(null);
  const [webhookConns, setWebhookConns] = useState<any[] | null>(null);
  const [messagingViews, setMessagingViews] = useState<any[]>([]);
  const [customWebhookView, setCustomWebhookView] = useState<{
    webhookUrl: string | null;
    webhookSecret: string | null;
    webhookEnabled: boolean;
    subscribedEvents?: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    return err ? decodeURIComponent(err) : null;
  });

  // Fetch connections on mount independently so a failure in one never blocks the others
  useEffect(() => {
    let mounted = true;

    fetch("/api/integrations/shopify")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setShopifyConn(d);
      })
      .catch(() => {
        if (mounted) setShopifyConn({ connected: false, shop: null });
      });

    fetch("/api/integrations/connections")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setWebhookConns(d.connections || []);
      })
      .catch(() => {
        if (mounted) setWebhookConns([]);
      });

    fetch("/api/integrations/sync")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setSyncConns(d.connections || []);
      })
      .catch(() => {
        if (mounted) setSyncConns([]);
      });

    fetch("/api/integrations/messaging")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setMessagingViews(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (mounted) setMessagingViews([]);
      });

    fetch("/api/account/webhook")
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setCustomWebhookView(d);
      })
      .catch(() => {
        if (mounted) setCustomWebhookView(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleDisconnectShopify = async () => {
    const res = await fetch("/api/integrations/shopify", { method: "DELETE" });
    if (!res.ok) throw new Error("Could not disconnect Shopify store.");
    setShopifyConn({ connected: false, shop: null });
  };

  const handleConnectShopifyDomain = async (domain: string) => {
    const res = await fetch("/api/integrations/shopify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopDomain: domain }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(d.error || "Could not connect store.");
    }
    if (d.connected && d.shop) {
      setShopifyConn({ connected: true, shop: d.shop });
      return { connected: true };
    }
    return { connected: false, installUrl: d.installUrl, message: d.message };
  };

  const handleSaveSync = async (provider: string, payload: any) => {
    const res = await fetch("/api/integrations/sync", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...payload }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to save sync connection.");
    }
    const updated = await fetch("/api/integrations/sync").then((r) => r.json());
    setSyncConns(updated.connections || []);
  };

  const handleDisconnectSync = async (provider: string) => {
    await fetch("/api/integrations/sync", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const updated = await fetch("/api/integrations/sync").then((r) => r.json());
    setSyncConns(updated.connections || []);
  };

  const handleSaveWebhook = async (provider: string, payload: any) => {
    const res = await fetch("/api/integrations/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...payload }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to save webhook connection.");
    }
    const updated = await fetch("/api/integrations/connections").then((r) => r.json());
    setWebhookConns(updated.connections || []);
  };

  const handleDisconnectWebhook = async (provider: string) => {
    await fetch("/api/integrations/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const updated = await fetch("/api/integrations/connections").then((r) => r.json());
    setWebhookConns(updated.connections || []);
  };

  const handleSaveCustomWebhook = async (payload: any) => {
    const res = await fetch("/api/account/webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to save custom webhook.");
    }
    const updated = await fetch("/api/account/webhook").then((r) => r.json());
    setCustomWebhookView(updated);
  };

  const handleDisconnectCustomWebhook = async () => {
    await fetch("/api/account/webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookEnabled: false }),
    });
    const updated = await fetch("/api/account/webhook").then((r) => r.json());
    setCustomWebhookView(updated);
  };

  const handleSaveMessaging = async (provider: string, data: any) => {
    const res = await fetch("/api/integrations/messaging", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...data }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to save messaging connection.");
    }
    const updated = await fetch("/api/integrations/messaging").then((r) => r.json());
    setMessagingViews(updated || []);
  };

  const handleDisconnectMessaging = async (provider: string) => {
    await fetch(`/api/integrations/messaging?provider=${provider}`, { method: "DELETE" });
    const updated = await fetch("/api/integrations/messaging").then((r) => r.json());
    setMessagingViews(updated || []);
  };

  // ── Compute Status for Any Provider ───────────────────────────────────────

  const getProviderStatus = useCallback(
    (meta: ProviderDefinition) =>
      computeProviderStatus({
        meta,
        syncConns,
        webhookConns,
        messagingViews,
        customWebhookView,
        shopifyConn,
      }),
    [syncConns, webhookConns, messagingViews, customWebhookView, shopifyConn]
  );

  // Active total connected count
  const totalConnectedCount = useMemo(() => {
    let count = 0;
    for (const provider of ALL_PROVIDERS) {
      if (getProviderStatus(provider).status !== "disconnected") {
        count++;
      }
    }
    return count;
  }, [getProviderStatus]);

  // ── Filtered Providers ────────────────────────────────────────────────────

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_PROVIDERS.filter((p) => {
      // Category filter
      if (selectedCategory !== "all" && p.categoryId !== selectedCategory) {
        return false;
      }
      // "Connected only" filter
      if (onlyConnected) {
        const { status } = getProviderStatus(p);
        if (status === "disconnected") return false;
      }
      // Text search
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchCategory = p.category.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchId = p.id.toLowerCase().includes(q);
        if (!matchName && !matchCategory && !matchDesc && !matchId) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCategory, searchQuery, onlyConnected, getProviderStatus]);

  // Active provider for modal
  const activeModalProvider = useMemo(() => {
    if (!activeModalProviderId) return null;
    return ALL_PROVIDERS.find((p) => p.id === activeModalProviderId) || null;
  }, [activeModalProviderId]);

  return (
    <div className="flex flex-col gap-7">
      {/* ── Page Header ────────────────────────────────────────── */}
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-[color:var(--color-border)] pb-5">
        <div>
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
                Integrations
              </h1>
              {totalConnectedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--color-success)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
                  {totalConnectedCount} Active
                </span>
              )}
            </div>

            {/* Mobile Privacy Policy Button */}
            <a
              href="https://asmos.io/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="sm:hidden inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-1 text-[11px] text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-text-primary)]"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Privacy Policy
            </a>
          </div>

          <p className="mt-1 text-xs text-[color:var(--color-text-secondary)] sm:text-sm">
            Connect Asmos to your marketing tools, messaging channels, and workflow automations.
          </p>
        </div>

        {/* Desktop Privacy Policy Button */}
        <a
          href="https://asmos.io/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-text-primary)]"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Privacy Policy
        </a>
      </div>

      {/* Error Alert Banner */}
      {pageError && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-red-600">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{pageError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageError(null)}
            className="ml-4 font-semibold text-red-600 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Toolbar: Category Filters & Search ─────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Category Pill Tabs */}
        <div
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap"
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-[color:var(--color-primary)] text-white shadow-xs font-semibold"
                    : "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)] hover:text-[color:var(--color-text-primary)]"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-[color:var(--color-neutral-badge)] text-[color:var(--color-text-secondary)]"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Toolbar Controls: Connected Filter & Search */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          {/* Connected Only Toggle */}
          <button
            type="button"
            onClick={() => setOnlyConnected((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border h-9 px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer ${
              onlyConnected
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs"
                : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:border-[color:var(--color-border-hover)]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full transition-colors ${
                onlyConnected
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-[color:var(--color-text-secondary)]/40"
              }`}
            />
            Connected only
          </button>

          {/* Search Input */}
          <div className="relative flex-1 min-w-0 lg:w-64 lg:flex-initial">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-secondary)] pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search integrations..."
              className="w-full h-9 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] pl-9 pr-8 text-xs text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-secondary)]/60 focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Integrations Grid ──────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-xs animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[color:var(--color-surface-sunken)]" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-24 rounded bg-[color:var(--color-surface-sunken)]" />
                  <div className="h-2.5 w-16 rounded bg-[color:var(--color-surface-sunken)]" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-[color:var(--color-surface-sunken)]" />
              <div className="h-3 w-3/4 rounded bg-[color:var(--color-surface-sunken)]" />
            </div>
          ))}
        </div>
      ) : filteredProviders.length === 0 ? (
        /* Empty Search / Filter State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)] mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">No integrations found</h3>
          <p className="mt-1 max-w-sm text-xs text-[color:var(--color-text-secondary)]">
            {searchQuery
              ? `We couldn't find any integrations matching "${searchQuery}".`
              : "No integrations match your current filter settings."}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setOnlyConnected(false);
              }}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : selectedCategory === "all" && !searchQuery && !onlyConnected ? (
        /* Categorized Sections when viewing All */
        <div className="space-y-8">
          {/* Section: Stores */}
          <section>
            <div className="mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
                  Stores
                </h2>
                <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-secondary)]">
                  1
                </span>
              </div>
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                Connect your Shopify store to power automatic coupon generation, real-time checkout tracking, and theme popups.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(() => {
                const info = getProviderStatus(SHOPIFY_PROVIDER);
                return (
                  <IntegrationCard
                    key={SHOPIFY_PROVIDER.id}
                    id={SHOPIFY_PROVIDER.id}
                    name={SHOPIFY_PROVIDER.name}
                    category={SHOPIFY_PROVIDER.category}
                    description={SHOPIFY_PROVIDER.description}
                    icon={SHOPIFY_PROVIDER.icon}
                    status={info.status}
                    activeEventsCount={info.activeEventsCount}
                    lastDelivery={info.lastDelivery}
                    onClick={() => setActiveModalProviderId(SHOPIFY_PROVIDER.id)}
                  />
                );
              })()}
            </div>
          </section>

          {/* Section: Marketing */}
          <section>
            <div className="mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
                  Marketing Sync
                </h2>
                <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-secondary)]">
                  {SYNC_PROVIDERS.length}
                </span>
              </div>
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                Sync captured leads directly into the email and CRM systems you sell with.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SYNC_PROVIDERS.map((provider) => {
                const info = getProviderStatus(provider);
                return (
                  <IntegrationCard
                    key={provider.id}
                    id={provider.id}
                    name={provider.name}
                    category={provider.category}
                    description={provider.description}
                    icon={provider.icon}
                    status={info.status}
                    activeEventsCount={info.activeEventsCount}
                    lastDelivery={info.lastDelivery}
                    onClick={() => setActiveModalProviderId(provider.id)}
                  />
                );
              })}
            </div>
          </section>

          {/* Section: Messaging */}
          <section>
            <div className="mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
                  Direct Messaging
                </h2>
                <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-secondary)]">
                  {MESSAGING_PROVIDERS.length}
                </span>
              </div>
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                Automatically send transactional emails or SMS text messages the moment a lead converts.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MESSAGING_PROVIDERS.map((provider) => {
                const info = getProviderStatus(provider);
                return (
                  <IntegrationCard
                    key={provider.id}
                    id={provider.id}
                    name={provider.name}
                    category={provider.category}
                    description={provider.description}
                    icon={provider.icon}
                    status={info.status}
                    activeEventsCount={info.activeEventsCount}
                    lastDelivery={info.lastDelivery}
                    onClick={() => setActiveModalProviderId(provider.id)}
                  />
                );
              })}
            </div>
          </section>

          {/* Section: Automation */}
          <section>
            <div className="mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
                  Automation & Workflows
                </h2>
                <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-secondary)]">
                  {AUTOMATION_PROVIDERS.length}
                </span>
              </div>
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                Pipe leads and winner events into Zapier, Make, n8n, Google Sheets, or custom endpoints.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AUTOMATION_PROVIDERS.map((provider) => {
                const info = getProviderStatus(provider);
                return (
                  <IntegrationCard
                    key={provider.id}
                    id={provider.id}
                    name={provider.name}
                    category={provider.category}
                    description={provider.description}
                    icon={provider.icon}
                    status={info.status}
                    activeEventsCount={info.activeEventsCount}
                    lastDelivery={info.lastDelivery}
                    onClick={() => setActiveModalProviderId(provider.id)}
                  />
                );
              })}
            </div>
          </section>

          {/* Section: Notifications */}
          <section>
            <div className="mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[color:var(--color-text-primary)]">
                  Team Notifications
                </h2>
                <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-secondary)]">
                  {NOTIFICATION_PROVIDERS.length}
                </span>
              </div>
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                Send real-time alerts into Slack, Discord, or Microsoft Teams whenever a lead converts.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {NOTIFICATION_PROVIDERS.map((provider) => {
                const info = getProviderStatus(provider);
                return (
                  <IntegrationCard
                    key={provider.id}
                    id={provider.id}
                    name={provider.name}
                    category={provider.category}
                    description={provider.description}
                    icon={provider.icon}
                    status={info.status}
                    activeEventsCount={info.activeEventsCount}
                    lastDelivery={info.lastDelivery}
                    onClick={() => setActiveModalProviderId(provider.id)}
                  />
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        /* Uniform Grid when filtered or searched */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProviders.map((provider) => {
            const info = getProviderStatus(provider);
            return (
              <IntegrationCard
                key={provider.id}
                id={provider.id}
                name={provider.name}
                category={provider.category}
                description={provider.description}
                icon={provider.icon}
                status={info.status}
                activeEventsCount={info.activeEventsCount}
                lastDelivery={info.lastDelivery}
                onClick={() => setActiveModalProviderId(provider.id)}
              />
            );
          })}
        </div>
      )}

      {/* ── Request an Integration Footer Banner ───────────────── */}
      <div className="pt-2">
        <RequestIntegrationCard prefilledText={searchQuery ? searchQuery : ""} />
      </div>

      {/* ── Focused Configuration Modal ────────────────────────── */}
      {activeModalProvider && (() => {
        const info = getProviderStatus(activeModalProvider);
        const p = activeModalProvider;

        return (
          <IntegrationConfigModal
            key={activeModalProvider.id}
            open={Boolean(activeModalProvider)}
            onClose={() => setActiveModalProviderId(null)}
            type={p.type}
            providerId={p.id}
            name={p.name}
            category={p.category}
            description={p.description}
            icon={p.icon}
            docsUrl={p.docsUrl}
            setupSteps={p.setupSteps}
            setupGuide={p.setupGuide}
            isConnected={info.status === "connected"}
            isKeyRequired={info.status === "key_required"}
            isReconnect={info.status === "reconnect"}
            lastDelivery={info.lastDelivery}
            syncData={
              p.type === "sync"
                ? {
                    authMode: p.authMode,
                    oauthUrl: p.oauthUrl,
                    keyLabel: p.keyLabel,
                    keyPlaceholder: p.keyPlaceholder,
                    configFields: p.configFields,
                    initialMaskedKey: info.conn?.maskedKey ?? null,
                    initialConfig: info.conn?.config ?? {},
                    initialEvents: info.conn?.subscribedEvents ?? [],
                    onSave: (payload) => handleSaveSync(p.id, payload),
                    onDisconnect: () => handleDisconnectSync(p.id),
                  }
                : undefined
            }
            webhookData={
              p.type === "webhook"
                ? {
                    urlLabel: p.urlLabel,
                    urlPlaceholder: p.urlPlaceholder,
                    supportsSigning: p.supportsSigning,
                    initialUrl: info.conn?.url ?? null,
                    initialEvents: info.conn?.subscribedEvents ?? [],
                    initialMaskedSecret: info.conn?.maskedSecret ?? null,
                    onSave: (payload) => handleSaveWebhook(p.id, payload),
                    onDisconnect: () => handleDisconnectWebhook(p.id),
                  }
                : undefined
            }
            customWebhookData={
              p.type === "custom-webhook"
                ? {
                    initialUrl: customWebhookView?.webhookUrl ?? null,
                    initialEvents: customWebhookView?.subscribedEvents ?? [],
                    initialMaskedSecret: customWebhookView?.webhookSecret ?? null,
                    onSave: handleSaveCustomWebhook,
                    onDisconnect: handleDisconnectCustomWebhook,
                  }
                : undefined
            }
            messagingData={
              p.type === "messaging"
                ? {
                    view: info.conn,
                    meta: {
                      configFields: p.configFields,
                      requiresRestrictedKey: p.requiresRestrictedKey,
                    },
                    onSave: (data) => handleSaveMessaging(p.id, data),
                    onDisconnect: () => handleDisconnectMessaging(p.id),
                  }
                : undefined
            }
            shopifyData={
              p.type === "shopify"
                ? {
                    connectedShopDomain: shopifyConn?.shop?.shopDomain || null,
                    installedAt: shopifyConn?.shop?.installedAt || null,
                    linkedAt: shopifyConn?.shop?.linkedAt || null,
                    directInstallUrl: p.directInstallUrl,
                    onDisconnect: handleDisconnectShopify,
                    onConnectDomain: handleConnectShopifyDomain,
                  }
                : undefined
            }
          />
        );
      })()}
    </div>
  );
}
