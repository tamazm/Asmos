"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SetupGuideButton } from "./SetupGuideButton";
import { TestConnectionButton } from "./TestConnectionButton";
import { MERGE_FIELDS } from "@/lib/integrations/mergeFields";
import { IntegrationCardShell } from "./IntegrationCardShell";

const inputCls =
  "w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150";
const labelCls = "text-xs font-medium text-[color:var(--color-text-primary)]";

export interface MessagingProviderMeta {
  id: string;
  name: string;
  description: string;
  docsUrl?: string;
  setupSteps?: string[];
  requiresRestrictedKey?: boolean;
  icon: React.ReactNode;
  configFields: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
}

type Status = { kind: "success" | "error"; msg: string } | null;

export function MessagingProviderCard({
  meta,
  view,
  onSave,
  onRemove
}: {
  meta: MessagingProviderMeta;
  view: any;
  onSave: (data: any) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>(view?.config || {});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  // templates and rules
  const [templates, setTemplates] = useState<any[]>(view?.templates || []);
  const [rules, setRules] = useState<any[]>(view?.rules || []);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testing, setTesting] = useState(false);

  // Twilio only: SMS has no recipient unless a live popup collects a phone
  // number. Surface a warning + one-click fix when none do.
  const isTwilio = meta.id === "twilio";
  const [phoneCoverage, setPhoneCoverage] = useState<"loading" | "none" | "ok">("loading");
  const [addingPhone, setAddingPhone] = useState(false);

  // Inline, auto-clearing status message (replaces blocking alert() dialogs).
  function flash(kind: "success" | "error", msg: string) {
    setStatus({ kind, msg });
    window.setTimeout(() => setStatus((s) => (s && s.msg === msg ? null : s)), 4000);
  }

  useEffect(() => {
    if (!isTwilio || !view?.connected) return;
    let cancelled = false;
    fetch("/api/campaigns/phone-collection")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPhoneCoverage(d.anyCollectsPhone ? "ok" : "none"); })
      // Fail open: a status-check error shouldn't nag the merchant with a false warning.
      .catch(() => { if (!cancelled) setPhoneCoverage("ok"); });
    return () => { cancelled = true; };
  }, [isTwilio, view?.connected]);

  async function addPhoneToPopups() {
    setAddingPhone(true);
    try {
      const res = await fetch("/api/campaigns/phone-collection", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setPhoneCoverage("ok");
        flash("success", d.campaignsChanged > 0 ? "Phone field added to your live popups." : "Your popups already collect phone.");
      } else {
        flash("error", d.error || "Couldn't update your popups.");
      }
    } catch {
      flash("error", "Couldn't update your popups: network error.");
    } finally {
      setAddingPhone(false);
    }
  }

  // ── Template variable picker ───────────────────────────────────────────────
  // Merge fields come from the shared registry (mergeFields.ts) so the picker
  // and the send-time renderer never drift. Clicking a chip inserts the token
  // into whichever field (subject/body) the merchant last focused, at the cursor.
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  function insertVariable(token: string) {
    if (!editingTemplate) return;
    const snippet = `{{${token}}}`;
    const field = activeField === "subject" && editingTemplate.channel === "email" ? "subject" : "body";
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const current = (editingTemplate[field] as string) || "";

    if (el && typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = current.slice(0, start) + snippet + current.slice(end);
      setEditingTemplate({ ...editingTemplate, [field]: next });
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + snippet.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setEditingTemplate({ ...editingTemplate, [field]: current + snippet });
    }
  }

  async function refreshTemplates() {
    if (!view?.id) return;
    try {
      const res = await fetch(`/api/integrations/messaging/templates?connectionId=${view.id}`);
      if (res.ok) setTemplates(await res.json());
    } catch {
      /* leave existing list in place */
    }
  }

  const handleSave = async () => {
    if (needsRestrictedKey && !secrets.apiKeySecret?.trim()) {
      flash("error", "Enter the new Restricted API Key secret to reconnect Twilio.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await onSave({ config, secrets });
      setExpanded(false);
      flash("success", "Connection saved.");
    } catch (err: any) {
      flash("error", err?.message ? `Save failed: ${err.message}` : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (templateId: string) => {
    if (!templateId) {
      flash("error", "Create a template first, then test-send it.");
      return;
    }
    if (!testRecipient.trim()) {
      flash("error", "Enter a recipient email or phone number to test.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/messaging/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: meta.id, templateId, testRecipient })
      });
      if (res.ok) {
        flash("success", "Test message sent.");
      } else {
        const d = await res.json().catch(() => ({}));
        flash("error", `Test failed: ${d.error || res.statusText}`);
      }
    } catch {
      flash("error", "Test failed: network error.");
    } finally {
      setTesting(false);
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      const isEdit = Boolean(editingTemplate.id);
      const url = isEdit
        ? `/api/integrations/messaging/templates?id=${editingTemplate.id}`
        : `/api/integrations/messaging/templates?connectionId=${view.id}`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate),
      });
      if (res.ok) {
        setEditingTemplate(null);
        await refreshTemplates();
        flash("success", isEdit ? "Template updated." : "Template created.");
      } else {
        const d = await res.json().catch(() => ({}));
        flash("error", `Couldn't save template: ${d.error || res.statusText}`);
      }
    } catch {
      flash("error", "Couldn't save template: network error.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const removeTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/integrations/messaging/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await refreshTemplates();
        flash("success", "Template deleted.");
      } else {
        flash("error", "Couldn't delete template.");
      }
    } catch {
      flash("error", "Couldn't delete template: network error.");
    }
  };

  const saveRules = async () => {
    setSavingRules(true);
    try {
      const res = await fetch(`/api/integrations/messaging/rules?connectionId=${view.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      if (res.ok) {
        flash("success", "Rules saved.");
      } else {
        const d = await res.json().catch(() => ({}));
        flash("error", `Couldn't save rules: ${d.error || res.statusText}`);
      }
    } catch {
      flash("error", "Couldn't save rules: network error.");
    } finally {
      setSavingRules(false);
    }
  };

  const isConnected = view?.connected;
  const needsRestrictedKey = Boolean(isConnected && meta.requiresRestrictedKey && view?.authType === "authToken");
  const missingConfig = meta.configFields
    .filter((f) => !f.isSecret)
    .some((f) => !config[f.key]?.trim());
  const hasSomeConfig = Object.values(config).some((v) => typeof v === "string" && v.trim().length > 0);
  const cardStatus = needsRestrictedKey
    ? "key_required"
    : isConnected && missingConfig
      ? "key_required"
      : isConnected
        ? "connected"
        : hasSomeConfig
          ? "key_required"
          : "disconnected";
  const subtitle = meta.id === "twilio" ? "SMS" : "Email";

  return (
    <IntegrationCardShell
      icon={meta.icon}
      name={meta.name}
      subtitle={subtitle}
      status={cardStatus}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      headerAccessory={!expanded && isConnected && !needsRestrictedKey ? <TestConnectionButton provider={meta.id} /> : undefined}
    >
      {(meta.setupSteps || meta.docsUrl) && (
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          {meta.description}
          <SetupGuideButton providerName={meta.name} docsUrl={meta.docsUrl} setupSteps={meta.setupSteps} />
        </p>
      )}

      {status && (
        <div
          role="status"
          className={
            "mt-3 rounded-lg px-3 py-2 text-xs font-medium " +
            (status.kind === "success"
              ? "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]"
              : "bg-red-50 text-red-600")
          }
        >
          {status.msg}
        </div>
      )}

      {isTwilio && isConnected && phoneCoverage === "none" && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <p className="font-semibold">SMS has no one to text</p>
          <p className="mt-0.5">None of your live popups collect a phone number yet, so your Twilio rules won&apos;t send.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button className="h-8 px-3 text-xs" disabled={addingPhone} onClick={addPhoneToPopups}>
              {addingPhone ? "Adding..." : "Add phone to my live popups"}
            </Button>
            <a href="/campaigns/new" className="text-amber-800 underline underline-offset-2 hover:text-amber-900">
              or create a new popup
            </a>
          </div>
        </div>
      )}

      <div className="space-y-4">
          <h4 className="font-medium text-[color:var(--color-text-primary)]">Connection Settings</h4>
          {meta.configFields.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className={labelCls}>{field.label}</label>
              <input
                className={inputCls}
                type={field.isSecret ? "password" : "text"}
                placeholder={field.placeholder}
                value={field.isSecret ? (secrets[field.key] || "") : (config[field.key] || "")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (field.isSecret) {
                    setSecrets({ ...secrets, [field.key]: e.target.value });
                  } else {
                    setConfig({ ...config, [field.key]: e.target.value });
                  }
                }}
              />
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Validating & Saving..." : "Save Connection"}
          </Button>

          {isConnected && (
            <>
              <div className="mt-8 border-t border-[color:var(--color-border)] pt-4">
                <h4 className="font-medium mb-2 text-[color:var(--color-text-primary)]">Templates</h4>
                <div className="space-y-2">
                  {templates.map(t => (
                    <div key={t.id} className="flex justify-between items-center border border-[color:var(--color-border)] p-2 rounded">
                      <span className="text-sm text-[color:var(--color-text-primary)]">{t.name}</span>
                      <div className="flex gap-1">
                        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setEditingTemplate(t)}>Edit</Button>
                        <Button variant="ghost" className="h-8 px-3 text-xs text-red-500 hover:text-red-600" onClick={() => removeTemplate(t.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="secondary" onClick={() => setEditingTemplate({ name: "New Template", subject: "", body: "", channel: meta.id === "twilio" ? "sms" : "email" })}>
                    Create Template
                  </Button>
                </div>

                {editingTemplate && (
                  <div className="mt-4 p-4 border border-[color:var(--color-border)] rounded bg-[color:var(--color-surface-sunken)] space-y-4">
                    <h5 className="font-medium text-[color:var(--color-text-primary)]">Edit Template</h5>
                    <input
                      className={inputCls}
                      placeholder="Name"
                      value={editingTemplate.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    />
                    {editingTemplate.channel === "email" && (
                      <input
                        ref={subjectRef}
                        className={inputCls}
                        placeholder="Subject"
                        value={editingTemplate.subject}
                        onFocus={() => setActiveField("subject")}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                      />
                    )}
                    <textarea
                      ref={bodyRef}
                      className={inputCls}
                      placeholder="Body — click a variable below to personalize, e.g. Hi {{lead.name}}!"
                      value={editingTemplate.body}
                      onFocus={() => setActiveField("body")}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                      rows={5}
                    />

                    <div>
                      <p className="text-xs text-[color:var(--color-text-secondary)] mb-1.5">
                        Insert a variable{editingTemplate.channel === "email" ? ` (into the ${activeField})` : ""} — it&apos;s replaced with each lead&apos;s real value when sent:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {MERGE_FIELDS.map((f) => (
                          <button
                            key={f.token}
                            type="button"
                            onClick={() => insertVariable(f.token)}
                            title={`{{${f.token}}} — e.g. ${f.sample}`}
                            className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-xs text-[color:var(--color-text-primary)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] transition-colors"
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveTemplate} disabled={savingTemplate}>
                        {savingTemplate ? "Saving..." : "Save Template"}
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 border-t border-[color:var(--color-border)] pt-4">
                <h4 className="font-medium mb-2 text-[color:var(--color-text-primary)]">Rules</h4>
                <p className="text-xs text-[color:var(--color-text-secondary)] mb-2">
                  {meta.id === "twilio"
                    ? "Texts send when a shopper submits your popup. SMS only works if the popup collects a phone number."
                    : "Emails send when a shopper submits your popup."}
                </p>
                <div className="space-y-2">
                  {rules.map((r, i) => (
                    <div key={i} className="flex flex-wrap justify-between items-center gap-2 border border-[color:var(--color-border)] p-2 rounded text-sm text-[color:var(--color-text-primary)]">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Event is fixed to "Lead captured" — it is the only event
                            that carries a recipient, so any other event would always
                            skip the send (see messagingRules.executeRule). */}
                        <span>On <strong>Lead captured</strong>, delay</span>
                        <input
                          type="number"
                          min={0}
                          max={10080}
                          className="w-20 rounded border border-[color:var(--color-border)] px-2 py-1 text-sm"
                          value={r.delayMinutes}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const v = Math.max(0, Math.min(10080, Number(e.target.value) || 0));
                            setRules(rules.map((rr, idx) => (idx === i ? { ...rr, delayMinutes: v } : rr)));
                          }}
                        />
                        <span>min, template</span>
                        <select
                          className="rounded border border-[color:var(--color-border)] px-2 py-1 text-sm"
                          value={r.templateId}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            setRules(rules.map((rr, idx) => (idx === i ? { ...rr, templateId: e.target.value } : rr)))
                          }
                        >
                          <option value="">Select template…</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <Button variant="ghost" className="h-8 px-3 text-xs text-red-500 hover:text-red-600" onClick={() => setRules(rules.filter((_, idx) => idx !== i))}>Remove</Button>
                    </div>
                  ))}
                  <div className="flex gap-2 items-center">
                    <Button variant="secondary" onClick={() => {
                      // Only lead.captured is supported for messaging — other events
                      // carry no recipient, so the send would always skip.
                      const newRule = { event: "lead.captured", delayMinutes: 0, templateId: templates[0]?.id || "" };
                      setRules([...rules, newRule]);
                    }}>Add Rule</Button>
                    <Button onClick={saveRules} disabled={savingRules}>
                      {savingRules ? "Saving..." : "Save Rules"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-[color:var(--color-border)] pt-4">
                <h4 className="font-medium mb-2 text-[color:var(--color-text-primary)]">Test Send</h4>
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="Recipient (email/phone)" value={testRecipient} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestRecipient(e.target.value)} />
                  <Button variant="secondary" disabled={testing} onClick={() => handleTestSend(templates[0]?.id)}>
                    {testing ? "Sending..." : "Test Send First Template"}
                  </Button>
                </div>
              </div>
            </>
          )}
      </div>

      {isConnected && (
        <div className="border-t border-[color:var(--color-border)] pt-4">
          <Button variant="secondary" className="text-red-500 hover:text-red-600" onClick={onRemove}>Disconnect</Button>
        </div>
      )}
    </IntegrationCardShell>
  );
}
