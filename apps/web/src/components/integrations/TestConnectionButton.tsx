"use client";

import { useState } from "react";

type Result = { kind: "success" | "error"; message: string } | null;

export function TestConnectionButton({ provider }: { provider: string }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function testConnection() {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResult({ kind: "error", message: data.error ?? "Connection test failed." });
        return;
      }
      setResult({ kind: "success", message: data.message ?? "Connection test passed." });
    } catch {
      setResult({ kind: "error", message: "Connection test failed: network error." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={testConnection}
        disabled={testing}
        className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {testing ? "Testing..." : "Test connection"}
      </button>
      {result && (
        <span
          role="status"
          className={result.kind === "success" ? "text-xs text-[color:var(--color-success)]" : "text-xs text-red-600"}
        >
          {result.message}
        </span>
      )}
    </div>
  );
}
