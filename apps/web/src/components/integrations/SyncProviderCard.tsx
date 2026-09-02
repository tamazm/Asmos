"use client";

import { useState } from "react";
import { SetupGuideButton } from "./SetupGuideButton";
import { TestConnectionButton } from "./TestConnectionButton";
import { EventSelector, EventSummary } from "./EventSelector";
import { LEAD_EVENT_OPTIONS } from "@/lib/integrations/events";
import { IntegrationCardShell, StatusBadge } from "./IntegrationCardShell";

export interface SyncCardProps {
  provider: string;
  name: string;
  category: string;
  group: string;
  docsUrl?: string;
  setupGuide?: { url: string; steps: string[] };
  authMode?: "apiKey" | "oauth";
  oauthUrl?: string;
  icon: React.ReactNode;
  keyLabel?: string;
  keyPlaceholder?: string;
  configFields?: Array<{ key: string; label: string; placeholder: string }>;
  initialMaskedKey: string | null;
  initialAuthType?: "apiKey" | "oauth" | null;
  initialConfig: Record<string, string>;
  initialEvents: string[];
  initialLastDelivery: { status: string; at: string } | null;
}

export function SyncProviderCard(props: SyncCardProps) {
  const [apiKey, setApiKey] = useState("");
  const [config, setConfig] = useState<Record<string, string>>(props.initialConfig || {});

  const [connected, setConnected] = useState(Boolean(props.initialMaskedKey));
  const [maskedKey, setMaskedKey] = useState<string | null>(props.initialMaskedKey);
  const [events, setEvents] = useState<string[]>(() => {
    const supported = props.initialEvents?.filter((event) => LEAD_EVENT_OPTIONS.some((option) => option.id === event)) ?? [];
    return supported.length ? supported : ["lead.captured"];
  });

  // Consider required config fields incomplete if any are blank. When connected
  // but missing required fields (e.g. Mailchimp Audience ID after OAuth), we
  // open into the edit form instead of the collapsed summary.
  const missingRequiredConfig = (props.configFields ?? []).some(
    (field) => !props.initialConfig?.[field.key]?.trim(),
  );
  const [editing, setEditing] = useState(Boolean(props.initialMaskedKey) && missingRequiredConfig);
  // Cards start collapsed; auto-open only when connected-but-incomplete so the
  // merchant sees the field they still need to fill.
  const [expanded, setExpanded] = useState(Boolean(props.initialMaskedKey) && missingRequiredConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDelivery, setLastDelivery] = useState(props.initialLastDelivery);
  const authMode = props.authMode ?? "apiKey";
  const needsOAuth = authMode === "oauth" && props.initialAuthType === "apiKey";
  const oauthSetup = authMode === "oauth" && (!connected || needsOAuth);

  function toggleEvent(id: string) {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function handleConfigChange(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (oauthSetup) { setError(`Connect ${props.name} before saving.`); return; }
    if (authMode !== "oauth" && !connected && !apiKey.trim()) { setError("API key is required."); return; }
    if (events.length === 0) { setError("Select at least one event."); return; }

    if (props.configFields) {
      for (const field of props.configFields) {
        if (!config[field.key]?.trim()) { setError(`${field.label} is required.`); return; }
      }
    }

    setSaving(true); setError(null);
    try {
      const payload: any = { provider: props.provider, subscribedEvents: events };
      if (authMode !== "oauth" && apiKey.trim()) payload.apiKey = apiKey.trim();
      if (Object.keys(config).length > 0) payload.config = config;

      const res = await fetch("/api/integrations/sync", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }

      const updated = data.connections?.find((c: any) => c.provider === props.provider);
      if (updated?.lastDelivery) setLastDelivery(updated.lastDelivery);
      if (updated?.maskedKey) setMaskedKey(updated.maskedKey);

      setApiKey("");
      setConnected(true);
      setEditing(false);
      setExpanded(false); // collapse back to the tidy connected row
    } catch { setError("Network error."); } finally { setSaving(false); }
  }

  async function disconnect() {
    setSaving(true);
    try {
      await fetch("/api/integrations/sync", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: props.provider }),
      });
    } catch { /* best effort */ } finally { setSaving(false); }
    setConnected(false); setApiKey(""); setConfig({}); setMaskedKey(null); setEditing(false); setError(null); setExpanded(false);
  }

  const showForm = (editing || !connected) && !oauthSetup;
  const status: "connected" | "key_required" | "reconnect" | "disconnected" = needsOAuth
    ? "reconnect"
    : connected && missingRequiredConfig
      ? "key_required"
      : connected
        ? "connected"
        : Object.keys(config).length > 0
          ? "key_required"
          : "disconnected";

  const labelCls = "text-xs font-medium text-[color:var(--color-text-primary)] mb-1 block";
  const inputCls = "w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]";

  return (
    <IntegrationCardShell
      icon={props.icon}
      name={props.name}
      subtitle={props.category}
      status={status}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
    >
      {/* Fields / connect prompt */}
      {oauthSetup && (
        <p className="text-xs leading-relaxed text-[color:var(--color-text-secondary)]">
          Connect securely through {props.name}. You will not need to paste an account-wide API key into Asmos.
        </p>
      )}

      {connected && !editing && !oauthSetup && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs text-[color:var(--color-text-primary)]">API Key: {maskedKey}</p>
          {props.configFields?.map((f) => (
            <p key={f.key} className="text-xs text-[color:var(--color-text-primary)]">
              {f.label}: <span className="font-mono">{config[f.key]}</span>
            </p>
          ))}
          {lastDelivery && (
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Last delivery: {lastDelivery.status} · {new Date(lastDelivery.at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-3">
          {authMode !== "oauth" && (
            <div>
              <label className={labelCls}>{props.keyLabel}</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={props.keyPlaceholder} className={inputCls} />
              {connected && <p className="text-xs text-[color:var(--color-text-secondary)] mt-1">Leave blank to keep existing key.</p>}
            </div>
          )}
          {props.configFields?.map((field) => (
            <div key={field.key}>
              <label className={labelCls}>{field.label}</label>
              <input type="text" value={config[field.key] || ""} onChange={(e) => handleConfigChange(field.key, e.target.value)} placeholder={field.placeholder} className={inputCls} />
            </div>
          ))}
        </div>
      )}

      {/* Events — pushed to the bottom, separated from the fields above */}
      <div className="mt-1 border-t border-[color:var(--color-border)] pt-4">
        {showForm ? (
          <EventSelector options={LEAD_EVENT_OPTIONS} selected={events} onToggle={toggleEvent} />
        ) : (
          <EventSummary events={events} eventLabel={(event) => LEAD_EVENT_OPTIONS.find((o) => o.id === event)?.label} />
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {oauthSetup ? (
          <a href={props.oauthUrl} className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white">
            Connect {props.name}
          </a>
        ) : showForm ? (
          <button onClick={save} disabled={saving} className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white disabled:opacity-50 cursor-pointer">
            {saving ? "Saving..." : "Save connection"}
          </button>
        ) : (
          <>
            {!needsOAuth && <TestConnectionButton provider={props.provider} />}
            <button onClick={() => setEditing(true)} disabled={saving} className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)] cursor-pointer disabled:opacity-50">Edit</button>
            <button onClick={disconnect} disabled={saving} className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-red-500 hover:border-red-200 cursor-pointer disabled:opacity-50">
              {saving ? "..." : "Disconnect"}
            </button>
          </>
        )}
        {props.setupGuide ? (
          <SetupGuideButton providerName={props.name} docsUrl={props.setupGuide.url} setupSteps={props.setupGuide.steps} />
        ) : props.docsUrl ? (
          <a href={props.docsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[color:var(--color-primary)] hover:underline">Docs</a>
        ) : null}
      </div>
    </IntegrationCardShell>
  );
}
