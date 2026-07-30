"use client";

import { useState } from "react";

type ReportCardProps = {
  title: string;
  description: string;
  downloadUrl: string;
  filename: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function ReportCard({
  title,
  description,
  downloadUrl,
  filename,
  disabled,
  disabledReason,
}: ReportCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{title}</p>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{description}</p>
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <div className="mt-auto">
        <button
          onClick={handleDownload}
          disabled={busy || disabled}
          title={disabled ? disabledReason : undefined}
          className="flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12v1.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {busy ? "Downloading..." : "Download CSV"}
        </button>
      </div>
    </div>
  );
}
