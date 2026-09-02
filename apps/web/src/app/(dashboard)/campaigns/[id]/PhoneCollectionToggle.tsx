"use client";

import { useState, useTransition } from "react";
import { setPhoneCollectionAction } from "./phoneActions";

/**
 * Per-popup "Collect phone number" toggle. Flips phone collection for every
 * variant of the campaign (updates formFields + re-renders the live HTML via
 * the server action). Optimistic, reverting on failure.
 */
export function PhoneCollectionToggle({
  campaignId,
  initialCollectPhone,
}: {
  campaignId: string;
  initialCollectPhone: boolean;
}) {
  const [on, setOn] = useState(initialCollectPhone);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const res = await setPhoneCollectionAction(campaignId, next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error ?? "Couldn't update. Please try again.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">Collect phone number</p>
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          Adds an optional phone field to this popup — needed for Twilio SMS.{" "}
          {error && <span className="text-red-500">{error}</span>}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Collect phone number"
        disabled={pending}
        onClick={toggle}
        className={
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 " +
          (on ? "bg-[color:var(--color-primary)]" : "bg-[color:var(--color-neutral-badge)]")
        }
      >
        <span
          className={
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
            (on ? "translate-x-5" : "translate-x-1")
          }
        />
      </button>
    </div>
  );
}
