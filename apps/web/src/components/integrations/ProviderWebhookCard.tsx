"use client";

import { useState } from "react";
import { SetupGuideButton } from "./SetupGuideButton";
import { TestConnectionButton } from "./TestConnectionButton";
import { AUTOMATION_EVENT_OPTIONS, eventLabel } from "@/lib/integrations/events";

export interface ProviderCardProps {
  provider: string;
  name: string;
  category: string;
  group: string;
  docsUrl?: string;
  setupSteps?: string[];
  icon: React.ReactNode;
  urlLabel: string;
  urlPlaceholder: string;
  /** When true, show an optional HMAC signing-secret field (e.g. Zapier/Make/n8n). */
  supportsSigning?: boolean;
  initialUrl: string | null;
  initialEvents: string[];
  initialMaskedSecret?: string | null;
  initialLastDelivery: { status: string; at: string } | null;
}

export function ProviderWebhookCard(props: ProviderCardProps) {
  const [url, setUrl] = useState(props.initialUrl ?? "");
  const [connected, setConnected] = useState(Boolean(props.initialUrl));
  const [events, setEvents] = useState<string[]>(
    props.initialEvents.length ? props.initialEvents : AUTOMATION_EVENT_OPTIONS.map((option) => option.id),
  );
  const [signingSecret, setSigningSecret] = useState("");
  const [maskedSecret, setMaskedSecret] = useState<string | null>(props.initialMaskedSecret ?? null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastDelivery = props.initialLastDelivery;

  function toggleEvent(id: string) {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function save() {
    if (!url.trim().startsWith("https://")) { setError("URL must start with https://"); return; }
    if (events.length === 0) { setError("Select at least one event."); return; }
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = { provider: props.provider, url: url.trim(), subscribedEvents: events };
      // Only send the secret when the user typed a new one — an empty field on
      // an already-connected card must not silently wipe the saved secret.
      if (props.supportsSigning && signingSecret.trim()) body.signingSecret = signingSecret.trim();
      const res = await fetch("/api/integrations/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
      const view = data.connections?.find((c: { provider: string; maskedSecret: string | null }) => c.provider === props.provider);
      if (view) setMaskedSecret(view.maskedSecret ?? null);
      setSigningSecret("");
      setConnected(true); setEditing(false);
    } catch { setError("Network error."); } finally { setSaving(false); }
  }

  async function disconnect() {
    setSaving(true);
    try {
      await fetch("/api/integrations/connections", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: props.provider }),
      });
    } catch { /* best effort */ } finally { setSaving(false); }
    setConnected(false); setUrl(""); setSigningSecret(""); setMaskedSecret(null); setEditing(false); setError(null);
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
          <p className="break-all font-mono text-xs text-[color:var(--color-text-primary)]">{url}</p>
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            Fires on: {events.map(eventLabel).join(", ")}
          </p>
          {props.supportsSigning && (
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Signing: {maskedSecret ? <span className="font-mono">{maskedSecret}</span> : "unsigned"}
            </p>
          )}
          {lastDelivery && (
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Last delivery: {lastDelivery.status} · {new Date(lastDelivery.at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {showForm && (
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-[color:var(--color-text-primary)]">{props.urlLabel}</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={props.urlPlaceholder}
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]" />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[color:var(--color-text-primary)]">Send on</span>
            {AUTOMATION_EVENT_OPTIONS.map((o) => (
              <label key={o.id} className="flex items-start gap-2 text-xs text-[color:var(--color-text-secondary)]">
                <input type="checkbox" checked={events.includes(o.id)} onChange={() => toggleEvent(o.id)} />
                <span>
                  <span className="block text-[color:var(--color-text-primary)]">{o.label}</span>
                  <span className="block text-[11px] leading-relaxed">{o.description}</span>
                </span>
              </label>
            ))}
          </div>
          {props.supportsSigning && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[color:var(--color-text-primary)]">
                Signing secret <span className="font-normal text-[color:var(--color-text-secondary)]">(optional)</span>
              </label>
              <input type="password" value={signingSecret} onChange={(e) => setSigningSecret(e.target.value)}
                placeholder={maskedSecret ? `${maskedSecret} — type to replace` : "Verify requests came from Asmos"}
                className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]" />
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                If set, Asmos signs each request with <code className="font-mono">X-Asmos-Signature: sha256=&lt;hmac&gt;</code> so your workflow can verify it.
              </p>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2">
        {showForm ? (
          <button onClick={save} disabled={saving}
            className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white disabled:opacity-50 cursor-pointer">
            {saving ? "Saving..." : "Save connection"}
          </button>
        ) : (
          <>
            <TestConnectionButton provider={props.provider} />
            <button onClick={() => setEditing(true)} disabled={saving}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)] cursor-pointer disabled:opacity-50">Edit</button>
            <button onClick={disconnect} disabled={saving}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:text-red-500 hover:border-red-200 cursor-pointer disabled:opacity-50">
              {saving ? "..." : "Disconnect"}</button>
          </>
        )}
        {props.docsUrl && !props.setupSteps && (
          <a href={props.docsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[color:var(--color-primary)] hover:underline">Docs</a>
        )}
        {props.setupSteps && (
          <SetupGuideButton providerName={props.name} docsUrl={props.docsUrl} setupSteps={props.setupSteps} />
        )}
      </div>
    </div>
  );
}
