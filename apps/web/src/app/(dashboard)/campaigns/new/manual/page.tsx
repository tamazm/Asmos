"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { campaignCreated } from "@/lib/analytics";

export default function ManualCampaignWizard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !url.trim()) {
      setError("Please fill out all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: "FORM",
          domain: url.trim(), // API will use this to auto-create Website if missing
          // No AI spec, so it skips the generation limit check and creates an empty campaign
          generationContext: { storeUrl: url.trim() }
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create campaign");
      }

      const created = await res.json();
      campaignCreated({
        campaignId: created.campaign.id,
        campaignType: "FORM",
        name: created.campaign.name,
      });

      // Redirect directly to the campaign page where they can add variants manually
      router.push(`/campaigns/${created.campaign.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-xl mx-auto py-10">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push("/campaigns/new")}
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm text-[color:var(--color-text-secondary)]">Manual Setup</span>
        </div>
        <h1 className="text-2xl font-bold text-[color:var(--color-text-primary)]">Manual Campaign</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Create an empty campaign and build your variants from scratch.
        </p>
      </div>

      <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
        <div className="rounded-[1rem] bg-[color:var(--color-surface)] p-6 flex flex-col gap-5">
          <div>
            <label htmlFor="campaign-name" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
              Campaign Name
            </label>
            <input
              id="campaign-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Winter Sale 2026"
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="store-url" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
              Target Store URL
            </label>
            <input
              id="store-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourstore.com"
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-3 py-2">{error}</p>
          )}

          <button
            onClick={create}
            disabled={loading}
            className="w-full rounded-lg bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white transition-[background-color,transform] hover:bg-[color:var(--color-primary-dark)] active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {loading ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}
