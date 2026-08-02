"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type WebsiteRow = {
  id: string;
  url: string;
  installVerified: boolean;
};

export function WebsiteManagement({ websites }: { websites: WebsiteRow[] }) {
  const router = useRouter();
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [snippetForId, setSnippetForId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function snippetFor(url: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${origin}/widget.js" data-site="${url}" async></script>`;
  }

  async function handleAdd() {
    if (!newUrl.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not add website");
      }
      setNewUrl("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleCheck(id: string) {
    setCheckingId(id);
    try {
      await fetch(`/api/websites/${id}/verify`, { method: "POST" });
      router.refresh();
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <h2 className="text-sm font-medium text-[color:var(--color-text-primary)]">
        Website management
      </h2>

      <div className="flex flex-col gap-2">
        {websites.length === 0 && (
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            No websites connected yet.
          </p>
        )}
        {websites.map((site) => (
          <div
            key={site.id}
            className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-border)] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[color:var(--color-text-primary)]">
                {site.url}
              </span>
              <div className="flex items-center gap-3">
                <Badge variant={site.installVerified ? "success" : "neutral"}>
                  {site.installVerified ? "Installed" : "Not detected"}
                </Badge>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setSnippetForId(snippetForId === site.id ? null : site.id)
                  }
                >
                  {snippetForId === site.id ? "Hide snippet" : "Get snippet"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => window.open(`/store-preview?site=${encodeURIComponent(site.url)}`, '_blank')}
                >
                  Preview how it looks
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleCheck(site.id)}
                  className={checkingId === site.id ? "opacity-60" : ""}
                >
                  {checkingId === site.id ? "Checking…" : "Check install"}
                </Button>
              </div>
            </div>
            {snippetForId === site.id && (
              <pre className="overflow-x-auto rounded-lg bg-[color:var(--color-surface-sunken)] p-3 text-xs text-[color:var(--color-text-primary)]">
                {snippetFor(site.url)}
              </pre>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
            Add another website
          </label>
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://anotherstore.com"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
          />
        </div>
        <Button onClick={handleAdd} className={adding ? "opacity-60" : ""}>
          {adding ? "Adding…" : "Add site"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
