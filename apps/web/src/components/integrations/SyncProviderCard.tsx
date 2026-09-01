"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SetupGuideButton } from "./SetupGuideButton";

export interface SyncCardProps {
  provider: string;
  name: string;
  category: string;
  group: string;
  docsUrl?: string;
  setupGuide?: { url: string; steps: string[] };
  icon: React.ReactNode;
  keyLabel: string;
  keyPlaceholder: string;
  configFields?: Array<{ key: string; label: string; placeholder: string }>;
  initialMaskedKey: string | null;
  initialConfig: Record<string, string>;
  initialEvents: string[];
  initialLastDelivery: { status: string; at: string } | null;
}

const EVENT_OPTIONS = [
  { id: "lead.captured", label: "Lead captured" },
  { id: "variant.winner_declared", label: "Winner declared" },
];

export function SyncProviderCard(props: SyncCardProps) {
  const [apiKey, setApiKey] = useState("");
  const [config, setConfig] = useState<Record<string, string>>(props.initialConfig || {});
  
  const [connected, setConnected] = useState(Boolean(props.initialMaskedKey));
  const [maskedKey, setMaskedKey] = useState<string | null>(props.initialMaskedKey);
  const [events, setEvents] = useState<string[]>(
    props.initialEvents?.length ? props.initialEvents : ["lead.captured"],
  );
  
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDelivery, setLastDelivery] = useState(props.initialLastDelivery);

  function toggleEvent(id: string) {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function handleConfigChange(key: string, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!connected && !apiKey.trim()) { setError("API key is required."); return; }
    if (events.length === 0) { setError("Select at least one event."); return; }
    
    // Check config fields
    if (props.configFields) {
      for (const field of props.configFields) {
        if (!config[field.key]?.trim()) {
          setError(`${field.label} is required.`);
          return;
        }
      }
    }

    setSaving(true); setError(null);
    try {
      const payload: any = { provider: props.provider, subscribedEvents: events };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
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
      
      setApiKey(""); // clear plain text input
      setConnected(true); 
      setEditing(false);
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
    setConnected(false); setApiKey(""); setConfig({}); setMaskedKey(null); setEditing(false); setError(null);
  }

  const showForm = editing || !connected;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0">{props.icon}</div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{props.name}</p>
            <p className="text-xs text-[color:var(--color-text-secondary)]">{props.category}</p>
          </div>
        </div>
        <span className={connected
          ? "inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-bg)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-success)]"
          : "rounded-full bg-[color:var(--color-neutral-badge)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-text-secondary)]"}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {connected && !editing && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs text-[color:var(--color-text-primary)]">
            API Key: {maskedKey}
          </p>
          {props.configFields?.map(f => (
            <p key={f.key} className="text-xs text-[color:var(--color-text-primary)]">
              {f.label}: <span className="font-mono">{config[f.key]}</span>
            </p>
          ))}
          <p className="text-xs text-[color:var(--color-text-secondary)] mt-1">
            Fires on: {events.map((e) => EVENT_OPTIONS.find((o) => o.id === e)?.label).filter(Boolean).join(", ")}
          </p>
          {lastDelivery && (
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Last delivery: {lastDelivery.status} · {new Date(lastDelivery.at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-[color:var(--color-text-primary)] mb-1 block">{props.keyLabel}</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={props.keyPlaceholder}
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]" />
            {connected && <p className="text-xs text-[color:var(--color-text-secondary)] mt-1">Leave blank to keep existing key.</p>}
          </div>
          
          {props.configFields?.map(field => (
            <div key={field.key}>
              <label className="text-xs font-medium text-[color:var(--color-text-primary)] mb-1 block">{field.label}</label>
              <input type="text" value={config[field.key] || ""} onChange={(e) => handleConfigChange(field.key, e.target.value)} placeholder={field.placeholder}
                className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]" />
            </div>
          ))}
          
          <div className="flex flex-col gap-1.5 mt-2">
            <span className="text-xs font-medium text-[color:var(--color-text-primary)]">Send on</span>
            {EVENT_OPTIONS.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-xs text-[color:var(--color-text-secondary)]">
                <input type="checkbox" checked={events.includes(o.id)} onChange={() => toggleEvent(o.id)} />
                {o.label}
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      <div className="flex items-center gap-2">
        {showForm ? (
          <button onClick={save} disabled={saving}
            className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white disabled:opacity-50 cursor-pointer">
            {saving ? "Saving..." : "Save connection"}
          </button>
        ) : (
          <>
            <button onClick={() => setEditing(true)} disabled={saving}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)] cursor-pointer disabled:opacity-50">Edit</button>
            <button onClick={disconnect} disabled={saving}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-red-500 hover:border-red-200 cursor-pointer disabled:opacity-50">
              {saving ? "..." : "Disconnect"}</button>
          </>
        )}
        {props.setupGuide ? (
          <SetupGuideButton providerName={props.name} docsUrl={props.setupGuide.url} setupSteps={props.setupGuide.steps} />
        ) : props.docsUrl ? (
          <a href={props.docsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[color:var(--color-primary)] hover:underline">Docs</a>
        ) : null}
      </div>
    </div>
  );
}
