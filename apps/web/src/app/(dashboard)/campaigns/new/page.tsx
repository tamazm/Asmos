"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { GeneratedCampaign } from "@/lib/campaignGeneration";

const EXAMPLE_PROMPTS = [
  "Get more email signups for my skincare brand with a fun, low-pressure incentive",
  "Reduce cart abandonment on my Shopify store with an exit-intent discount",
  "Grow my SaaS trial signups with a straightforward lead capture form",
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<GeneratedCampaign | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function publish() {
    if (!campaign) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaign),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Publish failed");
      }
      router.push("/campaigns");
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPublishing(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed");
      }
      const { campaign: generated } = await res.json();
      setCampaign(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function updateCampaign(patch: Partial<GeneratedCampaign>) {
    setCampaign((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  if (!campaign) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="New Campaign" backHref="/campaigns" backLabel="Back to Pop-ups" />

        <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
          <label className="text-sm font-medium text-[color:var(--color-text-primary)]">
            Describe what you want this campaign to do
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="e.g. Get more email signups for my skincare brand with a fun, low-pressure incentive"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />

          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-xs text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
              >
                {example}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div>
            <Button onClick={generate} className={loading ? "opacity-60" : ""}>
              {loading ? "Generating…" : "Generate Campaign"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Review & Publish"
        backHref="/campaigns"
        backLabel="Back to Pop-ups"
        actions={<Badge variant="neutral">{campaign.type}</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
              Campaign name
            </label>
            <input
              value={campaign.name}
              onChange={(e) => updateCampaign({ name: e.target.value })}
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
              Headline
            </label>
            <input
              value={campaign.design.headline}
              onChange={(e) =>
                updateCampaign({ design: { ...campaign.design, headline: e.target.value } })
              }
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
              Body text
            </label>
            <textarea
              value={campaign.design.body}
              onChange={(e) =>
                updateCampaign({ design: { ...campaign.design, body: e.target.value } })
              }
              rows={2}
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
              CTA button text
            </label>
            <input
              value={campaign.design.ctaText}
              onChange={(e) =>
                updateCampaign({ design: { ...campaign.design, ctaText: e.target.value } })
              }
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
              Brand color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={campaign.design.primaryColor}
                onChange={(e) =>
                  updateCampaign({ design: { ...campaign.design, primaryColor: e.target.value } })
                }
                className="h-9 w-9 cursor-pointer rounded border border-[color:var(--color-border)]"
              />
              <span className="text-sm text-[color:var(--color-text-secondary)]">
                {campaign.design.primaryColor}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-[color:var(--color-text-primary)]">
              Rewards
            </p>
            <ul className="flex flex-col gap-2">
              {campaign.rewards.map((reward, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm"
                >
                  <span>{reward.label}</span>
                  <span className="text-[color:var(--color-text-secondary)]">
                    {reward.type} · weight {reward.weight}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: campaign.design.primaryColor }}
          >
            <h2 className="text-lg font-semibold" style={{ color: campaign.design.primaryColor }}>
              {campaign.design.headline}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
              {campaign.design.body}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {campaign.formFields.map((field) => (
                <input
                  key={field}
                  disabled
                  placeholder={field}
                  className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm"
                />
              ))}
            </div>
            <button
              type="button"
              disabled
              className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: campaign.design.primaryColor }}
            >
              {campaign.design.ctaText}
            </button>
          </div>

          {publishError && <p className="text-sm text-red-500">{publishError}</p>}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCampaign(null)}>
              Regenerate
            </Button>
            <Button onClick={publish} className={publishing ? "opacity-60" : ""}>
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
