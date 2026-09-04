"use client";

import { useState } from "react";
import { runScrapeBatch } from "./actions";

export function ScrapeForm() {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleRun() {
    setRunning(true);
    setStatus(null);
    try {
      const result = await runScrapeBatch(text);
      if (result.ok) {
        setStatus({ ok: true, message: `Queued ${result.count} site${result.count === 1 ? "" : "s"}. Refresh this page in a few minutes to see results.` });
        setText("");
      } else {
        setStatus({ ok: false, message: result.error });
      }
    } catch {
      setStatus({ ok: false, message: "Request failed. Try again." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Run a new scrape</h2>
      <p className="text-xs text-[color:var(--color-text-secondary)]">
        One site per line - just the URL. Industry is auto-detected from the page&apos;s own title, meta
        description and popup copy, so you don&apos;t need to type it in (add <code>, industry</code> after a URL
        only if you want to override the guess). Runs in the background (Inngest) - this page won&apos;t update
        live, so refresh it after a few minutes to see new rows land.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"https://example.com\nhttps://another-store.com"}
        rows={6}
        disabled={running}
        className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-2 text-sm font-mono text-[color:var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] disabled:opacity-60"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRun}
          disabled={running || !text.trim()}
          className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
        >
          {running ? "Queuing…" : "Run Scrape"}
        </button>
        {status && (
          <span className={`text-xs ${status.ok ? "text-[color:var(--color-success)]" : "text-red-600"}`}>
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
