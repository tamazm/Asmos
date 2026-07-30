"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-6 px-6 text-center"
      aria-live="assertive"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-10 shadow-sm max-w-md w-full">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-primary-light)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#165DFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-[color:var(--color-text-primary)]">
            Reports could not load
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            An error occurred while loading the reports page. You can try again or return to the
            dashboard.
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-[color:var(--color-text-secondary)] font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 w-full justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-[color:var(--color-primary)] px-4 h-10 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 h-10 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors duration-150 active:scale-[0.98]"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
