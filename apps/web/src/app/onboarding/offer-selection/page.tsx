"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// ─── Offer options ────────────────────────────────────────────────────────────

const OFFERS = [
  {
    value: "percent_discount",
    label: "Percentage discount",
    description: "e.g. 10% off first order",
    hasInput: true as const,
    inputSuffix: "%",
    inputPrefix: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2.5" stroke="#165DFF" strokeWidth="1.75" />
        <circle cx="16" cy="16" r="2.5" stroke="#165DFF" strokeWidth="1.75" />
        <path d="M5 19L19 5" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "fixed_discount",
    label: "Fixed discount",
    description: "e.g. $5 off any order",
    hasInput: true as const,
    inputSuffix: "",
    inputPrefix: "$",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "free_shipping",
    label: "Free shipping",
    description: "Remove shipping costs for first-time buyers",
    hasInput: false as const,
    inputSuffix: "",
    inputPrefix: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" stroke="#165DFF" strokeWidth="1.75" strokeLinejoin="round" />
        <circle cx="5.5" cy="18.5" r="2" stroke="#165DFF" strokeWidth="1.75" />
        <circle cx="18.5" cy="18.5" r="2" stroke="#165DFF" strokeWidth="1.75" />
      </svg>
    ),
  },
  {
    value: "free_gift",
    label: "Free gift with purchase",
    description: "Surprise new subscribers with a bonus item",
    hasInput: false as const,
    inputSuffix: "",
    inputPrefix: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="8" width="18" height="4" rx="1" stroke="#165DFF" strokeWidth="1.75" />
        <path d="M5 12v8h14v-8M12 8V20" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8c0-2 1-4 3-4s3 2 1 4M12 8c0-2-1-4-3-4S6 6 8 8" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "giveaway",
    label: "Giveaway entry",
    description: "Run a contest to grow your list fast",
    hasInput: false as const,
    inputSuffix: "",
    inputPrefix: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="#165DFF" strokeWidth="1.75" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "early_access",
    label: "Early access / VIP list",
    description: "Give subscribers first access to launches",
    hasInput: false as const,
    inputSuffix: "",
    inputPrefix: "",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" />
        <rect x="9" y="1" width="6" height="4" rx="1" stroke="#165DFF" strokeWidth="1.75" />
        <path d="M9 12h6M9 16h4" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

type OfferValue = (typeof OFFERS)[number]["value"];

// ─── Icon Well ────────────────────────────────────────────────────────────────

function IconWell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 flex-shrink-0">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-[0.75rem] bg-[color:var(--color-primary-light)]"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OfferSelectionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<OfferValue>("percent_discount");
  const [discountValue, setDiscountValue] = useState("10");

  const activeOffer = OFFERS.find((o) => o.value === selected);

  function handleContinue() {
    try {
      sessionStorage.setItem(
        "asmos_offer_selection",
        JSON.stringify({
          type: selected,
          value: activeOffer?.hasInput ? discountValue : "",
        }),
      );
    } catch {
      // ignore
    }
    router.push("/onboarding/audience-trigger");
  }

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          What will you offer visitors?
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          The incentive is the most important part of any popup.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {OFFERS.map((offer) => {
          const active = selected === offer.value;
          return (
            <div key={offer.value} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelected(offer.value)}
                aria-pressed={active}
                className={cn(
                  "group flex items-center gap-4 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 cursor-pointer",
                  active
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] shadow-sm"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-surface-sunken)]",
                )}
              >
                <IconWell>{offer.icon}</IconWell>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      active
                        ? "text-[color:var(--color-primary)]"
                        : "text-[color:var(--color-text-primary)]",
                    )}
                  >
                    {offer.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)] leading-relaxed">
                    {offer.description}
                  </p>
                </div>
                {/* Selection indicator */}
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2 flex-shrink-0 transition-colors duration-150",
                    active
                      ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]"
                      : "border-[color:var(--color-border)] bg-transparent",
                  )}
                  aria-hidden="true"
                >
                  {active && (
                    <div className="flex items-center justify-center h-full">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>

              {/* Inline discount input */}
              {active && offer.hasInput && (
                <div className="ml-4 flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 animate-page-enter">
                  <label
                    htmlFor="discount-amount"
                    className="text-sm font-medium text-[color:var(--color-text-secondary)] whitespace-nowrap"
                  >
                    Discount amount:
                  </label>
                  {offer.inputPrefix && (
                    <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                      {offer.inputPrefix}
                    </span>
                  )}
                  <input
                    id="discount-amount"
                    type="number"
                    min="1"
                    max={offer.value === "percent_discount" ? "100" : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-20 rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--color-text-primary)] tabular-nums outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                    aria-label="Discount value"
                  />
                  {offer.inputSuffix && (
                    <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                      {offer.inputSuffix}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between gap-3 pt-1">
        <Button href="/onboarding/conversion-goal" variant="secondary">
          Back
        </Button>
        <Button onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
