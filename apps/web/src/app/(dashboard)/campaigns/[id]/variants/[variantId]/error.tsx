"use client";

import Link from "next/link";

export default function VariantDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-surface-sunken)]">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            stroke="#9CA3AF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="mb-1 text-lg font-semibold text-[color:var(--color-text-primary)]">
        Something went wrong
      </h1>
      <p className="mb-6 max-w-sm text-sm text-[color:var(--color-text-secondary)]">
        {error.message ?? "An unexpected error occurred while loading this variant."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.98]"
        >
          Try again
        </button>
        <Link
          href="/campaigns"
          className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] transition-colors duration-150 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.98]"
        >
          Back to campaigns
        </Link>
      </div>
    </div>
  );
}
