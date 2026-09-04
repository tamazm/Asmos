"use client";

import { useEffect } from "react";
import { logSystemError } from "@/app/actions/logError";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the page error to the database via server action
    logSystemError(`Page Error: ${error.message}`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[color:var(--color-text-primary)]">Something went wrong</h2>
      <p className="text-sm text-[color:var(--color-text-secondary)] max-w-md">
        An unexpected error occurred while rendering this page. The system administrator has been notified.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-[color:var(--color-text-secondary)] opacity-70">
          Error ID: {error.digest}
        </p>
      )}
      <button
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-[color:var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
