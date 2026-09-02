"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TestConnectionButton } from "./TestConnectionButton";
import { EventSelector } from "./EventSelector";
import { LEAD_EVENT_OPTIONS, AUTOMATION_EVENT_OPTIONS } from "@/lib/integrations/events";
import { MERGE_FIELDS } from "@/lib/integrations/mergeFields";

export type ModalType = "sync" | "webhook" | "custom-webhook" | "messaging" | "shopify";

const RAW_APPS_SCRIPT =
  'function doPost(e){var s=SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();var d=JSON.parse(e.postData.contents);if(d.event!==\'lead.captured\'){return ContentService.createTextOutput(\'ok\');}var l=(d.payload&&d.payload.lead)||{};s.appendRow([new Date(),l.email||\'\',l.name||\'\',l.phone||\'\',(d.payload&&d.payload.campaign_name)||\'\']);return ContentService.createTextOutput(\'ok\');}';

const FORMATTED_APPS_SCRIPT = `function doPost(e) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var d = JSON.parse(e.postData.contents);
  if (d.event !== 'lead.captured') {
    return ContentService.createTextOutput('ok');
  }
  var l = (d.payload && d.payload.lead) || {};
  s.appendRow([
    new Date(),
    l.email || '',
    l.name || '',
    l.phone || '',
    (d.payload && d.payload.campaign_name) || ''
  ]);
  return ContentService.createTextOutput('ok');
}`;

function CodeSnippetBox({ code, rawCode }: { code: string; rawCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2.5 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)] px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-[color:var(--color-text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Google Apps Script
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-primary)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] transition-all cursor-pointer shadow-xs"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-emerald-600 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed text-[color:var(--color-text-primary)] select-all whitespace-pre">
          {code}
        </pre>
      </div>
    </div>
  );
}

export interface IntegrationConfigModalProps {
  open: boolean;
  onClose: () => void;
  type: ModalType;
  providerId: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  docsUrl?: string;
  setupSteps?: string[];
  setupGuide?: { url: string; steps: string[] };
  // Connection states
  isConnected: boolean;
  isKeyRequired?: boolean;
  isReconnect?: boolean;
  lastDelivery?: { status: string; at: string } | null;
  // Specific data for Sync
  syncData?: {
    authMode?: "apiKey" | "oauth";
    oauthUrl?: string;
    keyLabel?: string;
    keyPlaceholder?: string;
    configFields?: Array<{ key: string; label: string; placeholder: string }>;
    initialMaskedKey: string | null;
    initialConfig: Record<string, string>;
    initialEvents: string[];
    onSave: (payload: { apiKey?: string; config?: Record<string, string>; subscribedEvents: string[] }) => Promise<void>;
    onDisconnect: () => Promise<void>;
  };
  // Specific data for Webhook
  webhookData?: {
    urlLabel: string;
    urlPlaceholder: string;
    supportsSigning?: boolean;
    initialUrl: string | null;
    initialEvents: string[];
    initialMaskedSecret?: string | null;
    onSave: (payload: { url: string; signingSecret?: string; subscribedEvents: string[] }) => Promise<void>;
    onDisconnect: () => Promise<void>;
  };
  // Specific data for Custom Webhook
  customWebhookData?: {
    initialUrl: string | null;
    initialEvents: string[];
    initialMaskedSecret?: string | null;
    onSave: (payload: { webhookUrl: string; webhookSecret?: string; subscribedEvents: string[] }) => Promise<void>;
    onDisconnect: () => Promise<void>;
  };
  // Specific data for Messaging (Mailgun / Twilio)
  messagingData?: {
    view: any;
    meta: {
      configFields: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
      requiresRestrictedKey?: boolean;
    };
    onSave: (data: { config: Record<string, string>; secrets: Record<string, string> }) => Promise<void>;
    onDisconnect: () => Promise<void>;
  };
  // Specific data for Shopify
  shopifyData?: {
    connectedShopDomain: string | null;
    installedAt: string | null;
    linkedAt: string | null;
    directInstallUrl: string;
    onDisconnect: () => Promise<void>;
    onConnectDomain?: (domain: string) => Promise<{ connected: boolean; installUrl?: string; message?: string }>;
  };
}

export function IntegrationConfigModal({
  open,
  onClose,
  type,
  providerId,
  name,
  category,
  description,
  icon,
  docsUrl,
  setupSteps,
  setupGuide,
  isConnected,
  isKeyRequired,
  isReconnect,
  lastDelivery,
  syncData,
  webhookData,
  customWebhookData,
  messagingData,
  shopifyData,
}: IntegrationConfigModalProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync Form State initialized directly from props
  const [syncApiKey, setSyncApiKey] = useState("");
  const [syncConfig, setSyncConfig] = useState<Record<string, string>>(() => syncData?.initialConfig || {});
  const [useApiKeyAuth, setUseApiKeyAuth] = useState(false);
  const [syncEvents, setSyncEvents] = useState<string[]>(() => {
    const supported = syncData?.initialEvents?.filter((ev) => LEAD_EVENT_OPTIONS.some((o) => o.id === ev)) ?? [];
    return supported.length ? supported : ["lead.captured"];
  });

  // Webhook Form State initialized directly from props
  const [webhookUrl, setWebhookUrl] = useState(() => webhookData?.initialUrl || "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(() =>
    webhookData?.initialEvents?.length ? webhookData?.initialEvents : AUTOMATION_EVENT_OPTIONS.map((o) => o.id)
  );

  // Custom Webhook Form State initialized directly from props
  const [customUrl, setCustomUrl] = useState(() => customWebhookData?.initialUrl || "");
  const [customSecret, setCustomSecret] = useState("");
  const [customEvents, setCustomEvents] = useState<string[]>(() =>
    customWebhookData?.initialEvents?.length ? customWebhookData?.initialEvents : AUTOMATION_EVENT_OPTIONS.map((o) => o.id)
  );

  // Messaging Form State initialized directly from props
  const [messagingTab, setMessagingTab] = useState<"credentials" | "templates" | "rules" | "test">("credentials");
  const [messagingConfig, setMessagingConfig] = useState<Record<string, string>>(() => messagingData?.view?.config || {});
  const [messagingSecrets, setMessagingSecrets] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<any[]>(() => messagingData?.view?.templates || []);
  const [rules, setRules] = useState<any[]>(() => messagingData?.view?.rules || []);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testingSend, setTestingSend] = useState(false);
  const [phoneCoverage, setPhoneCoverage] = useState<"loading" | "none" | "ok">("loading");
  const [addingPhone, setAddingPhone] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const [shopifyDomainInput, setShopifyDomainInput] = useState("");

  // Twilio phone coverage effect
  useEffect(() => {
    if (providerId === "twilio" && isConnected) {
      let cancelled = false;
      fetch("/api/campaigns/phone-collection")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setPhoneCoverage(d.anyCollectsPhone ? "ok" : "none");
        })
        .catch(() => {
          if (!cancelled) setPhoneCoverage("ok");
        });
      return () => {
        cancelled = true;
      };
    }
  }, [providerId, isConnected]);

  const stepsList = setupSteps || setupGuide?.steps;
  const documentationUrl = docsUrl || setupGuide?.url;

  // ────────────────── Save Handlers ──────────────────
  async function handleSaveSync() {
    if (!syncData) return;
    const isOAuth = syncData.authMode === "oauth" && !useApiKeyAuth;
    if (!isOAuth && !isConnected && !syncApiKey.trim()) {
      setError("API key is required.");
      return;
    }
    if (syncEvents.length === 0) {
      setError("Please select at least one event.");
      return;
    }
    if (syncData.configFields) {
      for (const field of syncData.configFields) {
        if (!syncConfig[field.key]?.trim()) {
          setError(`${field.label} is required.`);
          return;
        }
      }
    }

    setSaving(true);
    setError(null);
    try {
      await syncData.onSave({
        apiKey: syncApiKey.trim() || undefined,
        config: Object.keys(syncConfig).length > 0 ? syncConfig : undefined,
        subscribedEvents: syncEvents,
      });
      setSuccess("Connection saved successfully.");
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Failed to save connection.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveWebhook() {
    if (!webhookData) return;
    if (!webhookUrl.trim().startsWith("https://")) {
      setError("Endpoint URL must begin with https://");
      return;
    }
    if (webhookEvents.length === 0) {
      setError("Please select at least one event.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await webhookData.onSave({
        url: webhookUrl.trim(),
        signingSecret: webhookSecret.trim() || undefined,
        subscribedEvents: webhookEvents,
      });
      setSuccess("Webhook endpoint saved successfully.");
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Failed to save webhook.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCustomWebhook() {
    if (!customWebhookData) return;
    if (!customUrl.trim()) {
      setError("Please enter your webhook endpoint URL.");
      return;
    }
    if (!customUrl.trim().startsWith("https://")) {
      setError("Endpoint URL must begin with https://");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await customWebhookData.onSave({
        webhookUrl: customUrl.trim(),
        webhookSecret: customSecret.trim() || undefined,
        subscribedEvents: customEvents,
      });
      setSuccess("Webhook connection saved successfully.");
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Failed to save webhook.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMessaging() {
    if (!messagingData) return;
    if (isReconnect && !messagingSecrets.apiKeySecret?.trim()) {
      setError("Enter the new Restricted API Key secret to reconnect Twilio.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await messagingData.onSave({
        config: messagingConfig,
        secrets: messagingSecrets,
      });
      setSuccess("Connection credentials saved successfully.");
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save connection.");
    } finally {
      setSaving(false);
    }
  }

  // ────────────────── Disconnect Handlers ──────────────────
  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      if (type === "shopify" && shopifyData) {
        await shopifyData.onDisconnect();
      } else if (type === "sync" && syncData) {
        await syncData.onDisconnect();
      } else if (type === "webhook" && webhookData) {
        await webhookData.onDisconnect();
      } else if (type === "custom-webhook" && customWebhookData) {
        await customWebhookData.onDisconnect();
      } else if (type === "messaging" && messagingData) {
        await messagingData.onDisconnect();
      }
      setConfirmDisconnect(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  }

  // Messaging sub-helpers
  async function refreshTemplates() {
    if (!messagingData?.view?.id) return;
    try {
      const res = await fetch(`/api/integrations/messaging/templates?connectionId=${messagingData.view.id}`);
      if (res.ok) setTemplates(await res.json());
    } catch {
      // ignore
    }
  }

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

  async function handleSaveTemplate() {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    try {
      const isEdit = Boolean(editingTemplate.id);
      const url = isEdit
        ? `/api/integrations/messaging/templates?id=${editingTemplate.id}`
        : `/api/integrations/messaging/templates?connectionId=${messagingData?.view?.id}`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate),
      });
      if (res.ok) {
        setEditingTemplate(null);
        await refreshTemplates();
        setSuccess(isEdit ? "Template updated." : "Template created.");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(`Couldn't save template: ${d.error || res.statusText}`);
      }
    } catch {
      setError("Couldn't save template: network error.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleRemoveTemplate(id: string) {
    try {
      const res = await fetch(`/api/integrations/messaging/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await refreshTemplates();
        setSuccess("Template deleted.");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Couldn't delete template.");
      }
    } catch {
      setError("Couldn't delete template: network error.");
    }
  }

  async function handleSaveRules() {
    if (!messagingData?.view?.id) return;
    setSavingRules(true);
    try {
      const res = await fetch(`/api/integrations/messaging/rules?connectionId=${messagingData.view.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      if (res.ok) {
        setSuccess("Automation rules saved.");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(`Couldn't save rules: ${d.error || res.statusText}`);
      }
    } catch {
      setError("Couldn't save rules: network error.");
    } finally {
      setSavingRules(false);
    }
  }

  async function handleTestSend(templateId?: string) {
    const targetId = templateId || templates[0]?.id;
    if (!targetId) {
      setError("Create or select a template first before sending a test.");
      return;
    }
    if (!testRecipient.trim()) {
      setError("Enter a recipient email or phone number to test.");
      return;
    }
    setTestingSend(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/messaging/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, templateId: targetId, testRecipient }),
      });
      if (res.ok) {
        setSuccess("Test message successfully sent.");
        setTimeout(() => setSuccess(null), 4000);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(`Test failed: ${d.error || res.statusText}`);
      }
    } catch {
      setError("Test send failed: network error.");
    } finally {
      setTestingSend(false);
    }
  }

  async function addPhoneToPopups() {
    setAddingPhone(true);
    try {
      const res = await fetch("/api/campaigns/phone-collection", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setPhoneCoverage("ok");
        setSuccess(d.campaignsChanged > 0 ? "Phone field added to your live popups." : "Your popups already collect phone.");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(d.error || "Couldn't update your popups.");
      }
    } catch {
      setError("Couldn't update your popups: network error.");
    } finally {
      setAddingPhone(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-2.5 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors placeholder:text-[color:var(--color-text-secondary)]/60 focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20";
  const labelCls = "block text-xs font-semibold text-[color:var(--color-text-primary)] mb-1.5";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--color-surface-sunken)] p-1">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[color:var(--color-text-primary)]">{name}</span>
              <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-text-secondary)]">
                {category}
              </span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-bg)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-success)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] animate-pulse" />
                  Connected
                </span>
              ) : isKeyRequired ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Key required
                </span>
              ) : isReconnect ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Reconnect
                </span>
              ) : (
                <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-text-secondary)]">
                  Not connected
                </span>
              )}
            </div>
            <p className="text-xs font-normal text-[color:var(--color-text-secondary)] line-clamp-1">{description}</p>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-6">
        {/* Status / Alert Banner */}
        {error && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-bold text-red-500 hover:text-red-700">
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-800">
            {success}
          </div>
        )}
        {isKeyRequired && !error && !success && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              Additional credentials or configuration keys are required before this integration can be active. Please complete the required fields below.
            </span>
          </div>
        )}

        {/* Setup Guide Collapsible Banner */}
        {stepsList && stepsList.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface)] transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--color-primary)]">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                {showGuide ? "Hide connection instructions" : "How to connect & get credentials"}
              </span>
              <span className="text-[11px] font-medium text-[color:var(--color-primary)]">
                {showGuide ? "Collapse" : "View steps"}
              </span>
            </button>
            {showGuide && (
              <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                <ol className="list-decimal pl-5 space-y-3 text-xs leading-relaxed text-[color:var(--color-text-secondary)]">
                  {stepsList.map((step, idx) => {
                    const isAppsScriptStep = step.includes("doPost");
                    if (isAppsScriptStep) {
                      return (
                        <li key={idx} className="space-y-1.5">
                          <p className="text-xs font-medium text-[color:var(--color-text-primary)]">
                            Delete any starter code in Apps Script and paste this script:
                          </p>
                          <CodeSnippetBox code={FORMATTED_APPS_SCRIPT} rawCode={RAW_APPS_SCRIPT} />
                        </li>
                      );
                    }
                    return <li key={idx}>{step}</li>;
                  })}
                </ol>
                {documentationUrl && (
                  <div className="mt-3 pt-3 border-t border-[color:var(--color-border)]/60">
                    <a
                      href={documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-primary)] hover:underline"
                    >
                      Open {name} official documentation
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ────────────── SHOPIFY PROVIDER FORM ────────────── */}
        {type === "shopify" && shopifyData && (
          <div className="space-y-4">
            {isConnected && shopifyData.connectedShopDomain ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Connected Store
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-sm font-bold text-[color:var(--color-text-primary)]">
                      {shopifyData.connectedShopDomain}
                    </p>
                    {shopifyData.installedAt && (
                      <p className="mt-1 text-[11px] text-[color:var(--color-text-secondary)]">
                        Connected on {new Date(shopifyData.installedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </p>
                    )}
                  </div>
                  <a
                    href="/shopify-admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-primary)] hover:border-[color:var(--color-primary)] transition-all shadow-xs"
                  >
                    Open Embedded Admin
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-emerald-500/20 pt-3 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[color:var(--color-text-secondary)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Automatic discount sync</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[color:var(--color-text-secondary)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Storefront theme popups</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[color:var(--color-text-secondary)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Checkout & order revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[color:var(--color-text-secondary)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Live lead attribution</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1-Click Install Card */}
                <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#95BF47]/15">
                    <svg viewBox="0 0 40 40" width="22" height="22" fill="none">
                      <rect width="40" height="40" rx="8" fill="#95BF47" />
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M26.7 13.5c-.1-.7-.7-1.2-1.4-1.2-.2 0-.4 0-.6.1-.2-.7-.6-1.5-1.2-2.1-.9-.8-2-1.2-3.2-1.2-2.6 0-4.4 2.1-4.7 5.1l-2.4.8c-.7.2-1.2.9-1.2 1.6l1.2 13.6c.1.9.8 1.6 1.7 1.6h9c.9 0 1.6-.7 1.7-1.6l1.2-15.1c0-.4-.1-.7-.3-1zm-6.2-3c1.7 0 2.9 1.4 3 3.5l-6 1.9c.4-2.8 1.8-5.4 3-5.4zm-1.1 19.3l-5.6-1.5.8-9 4.8 1.5v9zm1.8 0v-8.7l5.2 1.6-.8 7.1h-4.4z"
                        fill="white"
                      />
                    </svg>
                  </div>
                  <h4 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                    Install via Shopify Developer Dashboard
                  </h4>
                  <p className="mt-1 text-xs text-[color:var(--color-text-secondary)] max-w-md mx-auto mb-4">
                    Install Asmos directly onto your development or merchant store using your partner organization access.
                  </p>
                  <a
                    href={shopifyData.directInstallUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#008060] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#006e52] shadow-xs"
                  >
                    Install App on Shopify
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>

                {/* Or connect by store domain */}
                <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                  <label className="block text-xs font-semibold text-[color:var(--color-text-primary)] mb-1">
                    Or connect with your store URL
                  </label>
                  <p className="text-[11px] text-[color:var(--color-text-secondary)] mb-3">
                    Enter your .myshopify.com domain to begin standard OAuth authorization.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const cleaned = shopifyDomainInput.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
                      if (!cleaned) return;
                      setSaving(true);
                      setError(null);
                      try {
                        if (shopifyData.onConnectDomain) {
                          const res = await shopifyData.onConnectDomain(cleaned);
                          if (res.connected) {
                            setSuccess("Shopify store connected successfully!");
                            setTimeout(() => setSuccess(null), 3000);
                            return;
                          } else if (res.installUrl) {
                            window.location.href = res.installUrl;
                            return;
                          }
                        }
                        window.location.href = `/api/shopify/install?shop=${encodeURIComponent(cleaned)}`;
                      } catch (err) {
                        setError((err as Error).message || "Could not detect or connect store.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={shopifyDomainInput}
                      onChange={(e) => setShopifyDomainInput(e.target.value)}
                      placeholder="your-store.myshopify.com"
                      disabled={saving}
                      className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1.5 text-xs text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-tertiary)] focus:border-[color:var(--color-primary)] focus:outline-none"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={saving || !shopifyDomainInput.trim()}
                      className="text-xs h-8 whitespace-nowrap"
                    >
                      {saving ? "Connecting…" : "Connect Store"}
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────────────── SYNC PROVIDER FORM ────────────── */}
        {type === "sync" && syncData && (
          <div className="space-y-4">
            {syncData.authMode === "oauth" && !useApiKeyAuth ? (
              <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4 text-center">
                <p className="text-xs text-[color:var(--color-text-secondary)] mb-3">
                  {isConnected
                    ? `${name} is authorized via OAuth. You can reconnect or update your configuration below.`
                    : isKeyRequired && syncData.initialMaskedKey
                    ? `${name} is authorized via OAuth, but additional required configuration keys are needed below.`
                    : `Connect securely through ${name}. You will not need to paste an account-wide API key into Asmos.`}
                </p>
                <div className="flex flex-col items-center gap-2">
                  <a
                    href={syncData.oauthUrl}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[color:var(--color-primary-dark)]"
                  >
                    {isConnected || (isKeyRequired && syncData.initialMaskedKey)
                      ? `Reconnect ${name}`
                      : `Authorize ${name} via OAuth`}
                  </a>
                  <button
                    type="button"
                    onClick={() => setUseApiKeyAuth(true)}
                    className="text-[11px] text-[color:var(--color-primary)] hover:underline mt-1 cursor-pointer"
                  >
                    Or connect with an API key instead
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {syncData.authMode === "oauth" && (
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[color:var(--color-text-primary)]">
                      Connect via API Key
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseApiKeyAuth(false)}
                      className="text-[11px] text-[color:var(--color-primary)] hover:underline cursor-pointer"
                    >
                      Switch to OAuth
                    </button>
                  </div>
                )}
                <label className={labelCls}>
                  {syncData.keyLabel || "API Key"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={syncApiKey}
                  onChange={(e) => setSyncApiKey(e.target.value)}
                  placeholder={
                    isConnected && syncData.initialMaskedKey
                      ? `Existing: ${syncData.initialMaskedKey} (leave blank to keep)`
                      : syncData.keyPlaceholder || "Enter API Key"
                  }
                  className={inputCls}
                />
                {isConnected && syncData.initialMaskedKey && (
                  <p className="mt-1 text-[11px] text-[color:var(--color-text-secondary)]">
                    Current active key: <code className="font-mono">{syncData.initialMaskedKey}</code>. Leave blank to retain existing key.
                  </p>
                )}
              </div>
            )}

            {syncData.configFields?.map((field) => (
              <div key={field.key}>
                <label className={labelCls}>
                  {field.label} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={syncConfig[field.key] || ""}
                  onChange={(e) => setSyncConfig({ ...syncConfig, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className={inputCls}
                />
              </div>
            ))}

            <div className="pt-2 border-t border-[color:var(--color-border)]">
              <label className={labelCls}>Subscribed Events</label>
              <EventSelector
                options={LEAD_EVENT_OPTIONS}
                selected={syncEvents}
                onToggle={(id) =>
                  setSyncEvents((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]))
                }
              />
            </div>
          </div>
        )}

        {/* ────────────── WEBHOOK PROVIDER FORM ────────────── */}
        {type === "webhook" && webhookData && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>
                {webhookData.urlLabel} <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder={webhookData.urlPlaceholder}
                className={inputCls}
              />
            </div>

            {webhookData.supportsSigning && (
              <div>
                <label className={labelCls}>
                  HMAC Signing Secret <span className="text-[color:var(--color-text-secondary)] font-normal">(optional)</span>
                </label>
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={
                    isConnected && webhookData.initialMaskedSecret
                      ? `Existing: ${webhookData.initialMaskedSecret} (leave blank to keep)`
                      : "Optional signing secret for request verification"
                  }
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-[color:var(--color-text-secondary)]">
                  When configured, requests are signed with <code className="font-mono">X-Asmos-Signature: sha256=&lt;hmac&gt;</code>.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-[color:var(--color-border)]">
              <label className={labelCls}>Subscribed Events</label>
              <EventSelector
                options={AUTOMATION_EVENT_OPTIONS}
                selected={webhookEvents}
                onToggle={(id) =>
                  setWebhookEvents((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]))
                }
              />
            </div>
          </div>
        )}

        {/* ────────────── CUSTOM WEBHOOK FORM ────────────── */}
        {type === "custom-webhook" && customWebhookData && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>
                Webhook Endpoint URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://your-server.com/api/asmos-webhook"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                Signing Secret <span className="text-[color:var(--color-text-secondary)] font-normal">(optional)</span>
              </label>
              <input
                type="password"
                value={customSecret}
                onChange={(e) => setCustomSecret(e.target.value)}
                placeholder={
                  isConnected && customWebhookData.initialMaskedSecret
                    ? `Existing: ${customWebhookData.initialMaskedSecret} (leave blank to keep)`
                    : "Used to compute HMAC-SHA256 signature"
                }
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-[color:var(--color-text-secondary)]">
                We sign each payload with <code className="font-mono">X-Asmos-Signature: sha256=&lt;hmac&gt;</code> when set.
              </p>
            </div>

            <div className="pt-2 border-t border-[color:var(--color-border)]">
              <label className={labelCls}>Subscribed Events</label>
              <EventSelector
                options={AUTOMATION_EVENT_OPTIONS}
                selected={customEvents}
                onToggle={(id) =>
                  setCustomEvents((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]))
                }
              />
            </div>
          </div>
        )}

        {/* ────────────── MESSAGING PROVIDER FORM ────────────── */}
        {type === "messaging" && messagingData && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex border-b border-[color:var(--color-border)]">
              {(["credentials", "templates", "rules", "test"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMessagingTab(tab)}
                  className={`border-b-2 px-4 py-2 text-xs font-semibold capitalize transition-colors ${
                    messagingTab === tab
                      ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
                      : "border-transparent text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
                  }`}
                >
                  {tab === "credentials"
                    ? "Credentials"
                    : tab === "templates"
                    ? `Templates (${templates.length})`
                    : tab === "rules"
                    ? `Rules & Delays (${rules.length})`
                    : "Test Send"}
                </button>
              ))}
            </div>

            {/* TAB: Credentials */}
            {messagingTab === "credentials" && (
              <div className="space-y-3 pt-2">
                {providerId === "twilio" && isConnected && phoneCoverage === "none" && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-800">
                    <p className="font-semibold">SMS has no recipient phone numbers</p>
                    <p className="mt-1">
                      None of your live popups collect a phone number yet, so your Twilio SMS rules cannot reach users.
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <Button className="h-8 px-3 text-xs" disabled={addingPhone} onClick={addPhoneToPopups}>
                        {addingPhone ? "Adding..." : "Add phone field to live popups"}
                      </Button>
                    </div>
                  </div>
                )}

                {messagingData.meta.configFields.map((field) => (
                  <div key={field.key}>
                    <label className={labelCls}>{field.label}</label>
                    <input
                      type={field.isSecret ? "password" : "text"}
                      value={field.isSecret ? messagingSecrets[field.key] || "" : messagingConfig[field.key] || ""}
                      onChange={(e) => {
                        if (field.isSecret) {
                          setMessagingSecrets({ ...messagingSecrets, [field.key]: e.target.value });
                        } else {
                          setMessagingConfig({ ...messagingConfig, [field.key]: e.target.value });
                        }
                      }}
                      placeholder={field.placeholder}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Templates */}
            {messagingTab === "templates" && (
              <div className="space-y-4 pt-2">
                {!editingTemplate ? (
                  <>
                    <div className="space-y-2">
                      {templates.length === 0 ? (
                        <p className="text-xs text-[color:var(--color-text-secondary)] italic">
                          No templates created yet. Create one below to send automated messages.
                        </p>
                      ) : (
                        templates.map((tmpl) => (
                          <div
                            key={tmpl.id}
                            className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-xs"
                          >
                            <span className="font-semibold text-[color:var(--color-text-primary)]">{tmpl.name}</span>
                            <div className="flex items-center gap-1.5">
                              <Button variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => setEditingTemplate(tmpl)}>
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                                onClick={() => handleRemoveTemplate(tmpl.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() =>
                        setEditingTemplate({
                          name: "New Template",
                          subject: "",
                          body: "",
                          channel: providerId === "twilio" ? "sms" : "email",
                        })
                      }
                    >
                      + Create New Template
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4">
                    <h5 className="text-xs font-bold text-[color:var(--color-text-primary)]">
                      {editingTemplate.id ? "Edit Template" : "New Template"}
                    </h5>
                    <div>
                      <label className={labelCls}>Template Name</label>
                      <input
                        className={inputCls}
                        placeholder="e.g. Welcome Discount"
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      />
                    </div>
                    {editingTemplate.channel === "email" && (
                      <div>
                        <label className={labelCls}>Email Subject</label>
                        <input
                          ref={subjectRef}
                          className={inputCls}
                          placeholder="Your discount code is inside!"
                          value={editingTemplate.subject || ""}
                          onFocus={() => setActiveField("subject")}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>Message Body</label>
                      <textarea
                        ref={bodyRef}
                        rows={4}
                        className={inputCls}
                        placeholder="Hi {{lead.name}}, thank you for signing up! Here is your reward: {{reward.code}}"
                        value={editingTemplate.body || ""}
                        onFocus={() => setActiveField("body")}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] font-medium text-[color:var(--color-text-secondary)] mb-1.5">
                        Click a variable to insert:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {MERGE_FIELDS.map((f) => (
                          <button
                            key={f.token}
                            type="button"
                            onClick={() => insertVariable(f.token)}
                            className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[11px] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] transition-colors"
                          >
                            +{f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button className="h-8 px-3 text-xs" onClick={handleSaveTemplate} disabled={savingTemplate}>
                        {savingTemplate ? "Saving..." : "Save Template"}
                      </Button>
                      <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setEditingTemplate(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Rules & Delays */}
            {messagingTab === "rules" && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-[color:var(--color-text-secondary)]">
                  Trigger automated messages when leads convert on your popups.
                </p>
                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span>On <strong>Lead captured</strong>, wait</span>
                      <input
                        type="number"
                        min={0}
                        max={10080}
                        value={rule.delayMinutes}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(10080, Number(e.target.value) || 0));
                          setRules(rules.map((r, i) => (i === idx ? { ...r, delayMinutes: v } : r)));
                        }}
                        className="w-16 rounded border border-[color:var(--color-border)] px-2 py-1 text-center font-mono text-xs"
                      />
                      <span>min, send</span>
                      <select
                        value={rule.templateId}
                        onChange={(e) =>
                          setRules(rules.map((r, i) => (i === idx ? { ...r, templateId: e.target.value } : r)))
                        }
                        className="rounded border border-[color:var(--color-border)] px-2 py-1 text-xs"
                      >
                        <option value="">Select template…</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      variant="ghost"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    onClick={() =>
                      setRules([
                        ...rules,
                        { event: "lead.captured", delayMinutes: 0, templateId: templates[0]?.id || "" },
                      ])
                    }
                  >
                    + Add Rule
                  </Button>
                  <Button className="h-8 px-3 text-xs" onClick={handleSaveRules} disabled={savingRules}>
                    {savingRules ? "Saving rules..." : "Save Rules"}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB: Test Send */}
            {messagingTab === "test" && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-[color:var(--color-text-secondary)]">
                  Verify message delivery with sample lead and reward data.
                </p>
                <div>
                  <label className={labelCls}>Recipient {providerId === "twilio" ? "Phone Number" : "Email"}</label>
                  <input
                    type="text"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder={providerId === "twilio" ? "+15551234567" : "you@example.com"}
                    className={inputCls}
                  />
                </div>
                <Button
                  className="h-8 px-4 text-xs"
                  disabled={testingSend}
                  onClick={() => handleTestSend()}
                >
                  {testingSend ? "Sending test..." : "Send Test Message"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="flex flex-col-reverse gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        {/* Utilities: Test Connection & Disconnect */}
        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--color-border)]/60 pt-2.5 sm:border-0 sm:pt-0 sm:justify-start">
          {(isConnected || isKeyRequired || isReconnect) && (
            <div className="flex items-center gap-2">
              {isConnected && <TestConnectionButton provider={providerId} size="sm" />}
              {confirmDisconnect ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    className="h-8 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 whitespace-nowrap"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? "Disconnecting..." : "Confirm"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    className="text-xs text-[color:var(--color-text-secondary)] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="h-8 px-2 text-xs text-[color:var(--color-text-secondary)] hover:text-red-600 cursor-pointer whitespace-nowrap"
                  onClick={() => setConfirmDisconnect(true)}
                >
                  Disconnect
                </Button>
              )}
            </div>
          )}
          {lastDelivery && (
            <span className="text-[11px] text-[color:var(--color-text-secondary)]">
              Last sync: {lastDelivery.status}
            </span>
          )}
        </div>

        {/* Primary Actions: Close & Save Connection */}
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
          <Button variant="secondary" className="h-9 px-4 text-xs justify-center whitespace-nowrap" onClick={onClose}>
            {type === "shopify" && isConnected ? "Done" : "Close"}
          </Button>
          {type !== "shopify" && (
            <Button
              className="h-9 px-4 text-xs justify-center font-medium whitespace-nowrap"
              disabled={saving}
              onClick={() => {
                if (type === "sync") handleSaveSync();
                else if (type === "webhook") handleSaveWebhook();
                else if (type === "custom-webhook") handleSaveCustomWebhook();
                else if (type === "messaging") handleSaveMessaging();
              }}
            >
              {saving ? "Saving..." : "Save Connection"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
