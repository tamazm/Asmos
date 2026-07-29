"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { analyzeStarted } from "@/lib/analytics";

export function HomepageForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let normalized = url.trim();
    if (!normalized) {
      setError("Please enter your store URL.");
      return;
    }
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }
    try {
      new URL(normalized);
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    analyzeStarted(normalized);
    router.push(`/analyze?url=${encodeURIComponent(normalized)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl mx-auto animate-page-enter-delay-2"
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="store-url" className="sr-only">
            Your store URL
          </label>
          <input
            id="store-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourstore.com"
            autoFocus
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 shadow-sm h-12"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98] h-12 whitespace-nowrap shadow-sm"
        >
          Analyze my store
        </button>
      </div>
      {error && (
        <p className="mt-2 text-left text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}
