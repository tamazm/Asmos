"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface MessagingProviderMeta {
  id: string;
  name: string;
  description: string;
  docsUrl?: string;
  icon: React.ReactNode;
  configFields: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
}

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

  // templates and rules
  const [templates, setTemplates] = useState<any[]>(view?.templates || []);
  const [rules, setRules] = useState<any[]>(view?.rules || []);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [testRecipient, setTestRecipient] = useState("");

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ config, secrets });
      setExpanded(false);
    } catch (err) {
      alert("Save failed: " + err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (templateId: string) => {
    try {
      const res = await fetch("/api/integrations/messaging/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: meta.id, templateId, testRecipient })
      });
      if (res.ok) {
        alert("Test sent successfully!");
      } else {
        const d = await res.json();
        alert("Failed: " + d.error);
      }
    } catch (err) {
      alert("Error sending test");
    }
  };

  const isConnected = view?.connected;

  return (
    <div className="border rounded-xl p-4 mb-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {meta.icon}
          <div>
            <h3 className="font-semibold">{meta.name}</h3>
            <p className="text-sm text-muted-foreground">
              {meta.description}
              {meta.docsUrl && (
                <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[color:var(--color-primary)] hover:underline">
                  Docs
                </a>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isConnected && (
            <Button variant="outline" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Close" : "Manage Rules"}
            </Button>
          )}
          {!isConnected && (
            <Button variant="default" onClick={() => setExpanded(!expanded)}>
              Connect
            </Button>
          )}
          {isConnected && (
            <Button variant="destructive" onClick={onRemove}>Disconnect</Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-6 border-t pt-4 space-y-4">
          <h4 className="font-medium">Connection Settings</h4>
          {meta.configFields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label>{field.label}</Label>
              <Input
                type={field.isSecret ? "password" : "text"}
                placeholder={field.placeholder}
                value={field.isSecret ? (secrets[field.key] || "") : (config[field.key] || "")}
                onChange={(e) => {
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
              <div className="mt-8 border-t pt-4">
                <h4 className="font-medium mb-2">Templates</h4>
                <div className="space-y-2">
                  {templates.map(t => (
                    <div key={t.id} className="flex justify-between border p-2 rounded">
                      <span>{t.name}</span>
                      <Button size="sm" variant="outline" onClick={() => setEditingTemplate(t)}>Edit</Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={() => setEditingTemplate({ name: "New Template", subject: "", body: "", channel: meta.id === "twilio" ? "sms" : "email" })}>
                    Create Template
                  </Button>
                </div>

                {editingTemplate && (
                  <div className="mt-4 p-4 border rounded bg-muted/50 space-y-4">
                    <h5 className="font-medium">Edit Template</h5>
                    <Input 
                      placeholder="Name" 
                      value={editingTemplate.name} 
                      onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} 
                    />
                    {editingTemplate.channel === "email" && (
                      <Input 
                        placeholder="Subject" 
                        value={editingTemplate.subject} 
                        onChange={e => setEditingTemplate({...editingTemplate, subject: e.target.value})} 
                      />
                    )}
                    <Textarea 
                      placeholder="Body (supports {{lead.name}}, etc)" 
                      value={editingTemplate.body} 
                      onChange={e => setEditingTemplate({...editingTemplate, body: e.target.value})} 
                      rows={5}
                    />
                    <div className="flex gap-2">
                      <Button onClick={async () => {
                        // Very naive save
                        const method = editingTemplate.id ? "PATCH" : "POST";
                        const url = `/api/integrations/messaging/templates?connectionId=${view.id}` + (editingTemplate.id ? `&id=${editingTemplate.id}` : "");
                        const res = await fetch(url, { method, body: JSON.stringify(editingTemplate) });
                        if (res.ok) {
                          setEditingTemplate(null);
                          // caller would refresh
                          alert("Saved template. Please refresh to see changes for now.");
                        }
                      }}>Save Template</Button>
                      <Button variant="ghost" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 border-t pt-4">
                <h4 className="font-medium mb-2">Rules</h4>
                <div className="space-y-2">
                  {rules.map((r, i) => (
                    <div key={i} className="border p-2 rounded">
                      On <strong>{r.event}</strong>, delay <strong>{r.delayMinutes}m</strong>, send template <strong>{templates.find(t=>t.id===r.templateId)?.name || r.templateId}</strong>
                    </div>
                  ))}
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" onClick={() => {
                      const newRule = { event: "lead.captured", delayMinutes: 0, templateId: templates[0]?.id || "" };
                      const newRules = [...rules, newRule];
                      setRules(newRules);
                    }}>Add Rule</Button>
                    <Button onClick={async () => {
                      const res = await fetch(`/api/integrations/messaging/rules?connectionId=${view.id}`, { method: "PUT", body: JSON.stringify(rules) });
                      if (res.ok) alert("Rules saved!");
                    }}>Save Rules</Button>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t pt-4">
                <h4 className="font-medium mb-2">Test Send</h4>
                <div className="flex gap-2">
                  <Input placeholder="Recipient (email/phone)" value={testRecipient} onChange={e => setTestRecipient(e.target.value)} />
                  <Button variant="secondary" onClick={() => handleTestSend(templates[0]?.id)}>Test Send First Template</Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
