"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { analyzeStarted } from "@/lib/analytics";

interface HomepageFormProps {
  dark?: boolean;
  inverted?: boolean;
}

export function HomepageForm({ dark = false, inverted = false }: HomepageFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let normalized = url.trim();
    if (!normalized) {
      setError("Enter your store URL to get started");
      return;
    }
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }
    if (!normalized.includes(".")) {
      setError("Enter a valid store URL (e.g. yourstore.com)");
      return;
    }
    try {
      new URL(normalized);
    } catch {
      setError("Enter a valid store URL (e.g. yourstore.com)");
      return;
    }
    setLoading(true);
    analyzeStarted(normalized);
    router.push(`/analyze?url=${encodeURIComponent(normalized)}`);
  }

  /* Style variants */
  const outerBorder = inverted
    ? "border-white/20"
    : dark
    ? "border-white/10"
    : "border-[color:var(--color-border)]";

  const innerBg = inverted
    ? "bg-white/10"
    : dark
    ? "bg-white/8"
    : "bg-[color:var(--color-surface)]";

  const innerShadow = inverted || dark
    ? "inset 0 1px 0 rgba(255,255,255,0.08)"
    : "inset 0 1px 0 rgba(255,255,255,0.9)";

  const inputText = inverted || dark
    ? "text-white placeholder:text-white/40"
    : "text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)]";

  const subText = inverted
    ? "oklch(80% 0.06 258)"
    : dark
    ? "var(--color-hero-muted)"
    : "var(--color-text-secondary)";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className={`input-glow rounded-[1.125rem] border ${outerBorder} p-1 transition-all duration-200`}
        style={{ background: inverted ? "rgba(255,255,255,0.08)" : dark ? "rgba(255,255,255,0.05)" : "var(--color-surface-sunken)" }}>
        <div
          className={`flex flex-col sm:flex-row gap-2 rounded-[0.75rem] ${innerBg} p-1.5`}
          style={{ boxShadow: innerShadow }}
        >
          <div className="flex-1">
            <label htmlFor="store-url" className="sr-only">Your store URL</label>
            <input
              id="store-url"
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (error) setError(null); }}
              onFocus={(e) => e.target.select()}
              placeholder="yourstore.com"
              disabled={loading}
              className={`w-full rounded-[0.5rem] border-0 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-0 h-11 disabled:opacity-50 ${inputText}`}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-wipe shrink-0 rounded-[0.5rem] bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white h-11 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 justify-center transition-transform duration-150 active:scale-[0.97]"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>Analyze my store &rarr;</>
            )}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-left text-xs text-red-400">{error}</p>}
      {!error && (
        <p className="mt-2.5 text-center text-xs" style={{ color: subText }}>
          No account needed &middot; Scan takes ~10 seconds
        </p>
      )}
    </form>
  );
}
