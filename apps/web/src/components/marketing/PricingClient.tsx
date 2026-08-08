"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  getBracketForTraffic,
  annualPrice,
  sliderPositionToTraffic,
  trafficToSliderPosition,
  formatVisitors,
} from "@/lib/pricing";
import { CTA } from "@/lib/site";

export function PricingClient() {
  const [sliderPos, setSliderPos] = useState(trafficToSliderPosition(100_000));
  const [annual, setAnnual] = useState(false);

  const traffic = useMemo(() => sliderPositionToTraffic(sliderPos), [sliderPos]);
  const bracket = useMemo(() => getBracketForTraffic(traffic), [traffic]);
  const isCustom = bracket === null;

  const price = (monthly: number) => (annual ? annualPrice(monthly) : monthly);

  return (
    <div>
      {/* Billing toggle — flex-wrap + shrink-0 on the switch so this never
          clips on narrow screens; it drops to two lines instead of cutting
          off "Annual" mid-word. */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 text-center">
        <span className={`shrink-0 whitespace-nowrap text-sm font-medium ${!annual ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]"}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((a) => !a)}
          className="relative h-7 w-[52px] shrink-0 rounded-full bg-[color:var(--color-border)] transition-colors duration-200 data-[on=true]:bg-[color:var(--color-primary)]"
          data-on={annual}
        >
          <span
            className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: annual ? "translateX(28px)" : "translateX(4px)" }}
          />
        </button>
        <span className={`shrink-0 whitespace-nowrap text-sm font-medium ${annual ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]"}`}>
          Annual <span className="text-[color:var(--color-primary)]">— Save 20%</span>
        </span>
      </div>

      {/* Traffic slider */}
      <div className="mx-auto max-w-xl rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-6 mb-10">
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="traffic-slider" className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">
            Average Monthly Website Traffic
          </label>
          <span className="text-sm font-bold tabular-nums text-[color:var(--color-primary)]">
            {isCustom ? `${formatVisitors(traffic)}+` : formatVisitors(traffic)} visitors/mo
          </span>
        </div>
        <p className="mb-4 text-xs text-[color:var(--color-text-secondary)]">Move the slider to match your average monthly visitors.</p>
        <input
          id="traffic-slider"
          type="range"
          min={0}
          max={1000}
          value={sliderPos}
          onChange={(e) => setSliderPos(Number(e.target.value))}
          className="w-full accent-[color:var(--color-primary)]"
          aria-label="Average monthly website traffic"
        />
        <div className="mt-1 flex justify-between text-[10px] text-[color:var(--color-text-secondary)]">
          <span>10K</span>
          <span>100K</span>
          <span>500K</span>
          <span>1M+</span>
        </div>
      </div>

      {/* Pricing cards */}
      {isCustom ? (
        <div className="mx-auto max-w-md">
          <div className="rounded-[1.375rem] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-1.5 shadow-lg">
            <div className="rounded-[1rem] bg-[color:var(--color-surface)] p-8 text-center" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">Custom</p>
              <p className="mb-3 text-3xl font-bold tracking-tight text-[color:var(--color-text-primary)]">Custom Pricing</p>
              <p className="mb-6 text-sm text-[color:var(--color-text-secondary)]">
                For stores with more than 1M monthly visitors or custom traffic, testing, integration, or support requirements.
              </p>
              <Link href={CTA.secondary.href} className="block w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
                {CTA.secondary.label}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Left card: base plan */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-7 flex flex-col">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">{bracket!.tier}</p>
            <div className="mb-1 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">${price(bracket!.price!)}</span>
              <span className="text-sm text-[color:var(--color-text-secondary)]">/ mo{annual ? " billed annually" : ""}</span>
            </div>
            <p className="mb-6 text-xs text-[color:var(--color-text-secondary)]">Everything you need to run Asmos autonomously.</p>
            <ul className="space-y-2.5 mb-7 flex-1">
              {bracket!.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[color:var(--color-text-secondary)]">
                  <span className="mt-0.5 text-[color:var(--color-primary)] text-xs font-bold">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href={CTA.primary.href} className="block w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-center text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.97]">
              {CTA.primary.label}
            </Link>
          </div>

          {/* Right card: Managed Success add-on, or Custom for Scale tier */}
          {bracket!.managedIncluded ? (
            <div className="rounded-[1.375rem] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-1.5 shadow-lg">
              <div className="flex h-full flex-col rounded-[1rem] bg-[color:var(--color-surface)] p-7" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">Need something custom?</p>
                <p className="mb-4 text-lg font-bold tracking-tight text-[color:var(--color-text-primary)]">Talk to sales</p>
                <p className="mb-6 text-xs text-[color:var(--color-text-secondary)] flex-1">
                  For larger teams requiring additional traffic, integrations, testing capacity, SLAs, or custom onboarding.
                </p>
                <Link href={CTA.secondary.href} className="block w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
                  {CTA.secondary.label}
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.375rem] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-1.5 shadow-lg">
              <div className="flex h-full flex-col rounded-[1rem] bg-[color:var(--color-surface)] p-7" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}>
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">{bracket!.tier} + Managed Success</p>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-[color:var(--color-primary)] px-2 py-0.5 text-[9px] font-semibold text-white">Hands-On Support</span>
                </div>
                <div className="mb-1 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
                    ${price(bracket!.price! + (bracket!.managedAddOn ?? 0))}
                  </span>
                  <span className="text-sm text-[color:var(--color-text-secondary)]">/ mo{annual ? " billed annually" : ""}</span>
                </div>
                <p className="mb-6 text-xs text-[color:var(--color-text-secondary)]">Everything in {bracket!.tier}, plus hands-on support from the Asmos team.</p>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {[...bracket!.features.filter((f) => !f.startsWith("Automatic Onboarding")), "White-Glove Onboarding", "Dedicated Customer Success Manager", "Hands-On Setup & Support"].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[color:var(--color-text-secondary)]">
                      <span className="mt-0.5 text-[color:var(--color-primary)] text-xs font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={CTA.primary.href} className="block w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
                  {CTA.primary.label}
                </Link>
                <Link href={CTA.secondary.href} className="mt-2.5 block text-center text-xs font-medium text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)]">
                  {CTA.secondary.label}
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
