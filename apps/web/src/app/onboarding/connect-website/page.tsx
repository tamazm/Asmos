"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { normalizeHost } from "@/lib/host";

export default function ConnectWebsitePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<script src="${origin}/widget.js" data-site="${
    url ? normalizeHost(url) : "your-site.com"
  }" async></script>`;

  async function handleContinue() {
    if (!url.trim()) {
      router.push("/onboarding/verify");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save website");
      }
      router.push("/onboarding/verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
          Connect your website
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Enter your site URL, then add the snippet below to your site (or
          your CMS's custom scripts section).
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Website URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourstore.com"
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Install snippet
        </label>
        <pre className="overflow-x-auto rounded-lg bg-[color:var(--color-surface-sunken)] p-3 text-xs text-[color:var(--color-text-primary)]">
          {snippet}
        </pre>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-between">
        <Button href="/onboarding" variant="secondary">
          Back
        </Button>
        <Button onClick={handleContinue} className={saving ? "opacity-60" : ""}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
