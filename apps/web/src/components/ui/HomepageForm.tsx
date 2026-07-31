"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { analyzeStarted } from "@/lib/analytics";

export function HomepageForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let normalized = url.trim();
    if (!normalized || !normalized.includes(".")) {
      setError("Enter a valid store URL");
      return;
    }
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }
    try {
      new URL(normalized);
    } catch {
      setError("Enter a valid store URL");
      return;
    }
    setLoading(true);
    analyzeStarted(normalized);
    router.push(`/analyze?url=${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      {/* Double-Bezel form container */}
      <div className="rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2 rounded-[0.75rem] bg-[color:var(--color-surface)] p-1.5"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}
        >
          <div className="flex-1">
            <label htmlFor="store-url" className="sr-only">
              Your store URL
            </label>
            <input
              id="store-url"
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (error) setError(null); }}
              placeholder="yourstore.com"
              autoFocus
              disabled={loading}
              className="w-full rounded-[0.5rem] border-0 bg-transparent px-3 py-2.5 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:ring-0 h-11 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-[0.5rem] bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97] h-11 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Analyzing...
              </>
            ) : (
              "Analyze my store"
            )}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-left text-xs text-red-500">{error}</p>
      )}
      {!error && (
        <p className="mt-2 text-center text-xs text-[color:var(--color-text-secondary)]">
          No credit card required
        </p>
      )}
    </form>
  );
}
