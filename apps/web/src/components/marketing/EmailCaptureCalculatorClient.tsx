"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ESTIMATED_CURRENT_CVR, ESTIMATED_SUBSCRIBER_TO_CUSTOMER_CVR } from "@/lib/benchmarks";
import { computeEmailCaptureOpportunity, formatCurrency, formatNumber } from "@/lib/calculators";
import { CTA } from "@/lib/site";

export function EmailCaptureCalculatorClient() {
  const [monthlyVisitors, setMonthlyVisitors] = useState(100_000);
  const [currentCVRInput, setCurrentCVRInput] = useState(2.8);
  const [cvrUnknown, setCvrUnknown] = useState(false);
  const [aov, setAov] = useState(85);
  const [subCVRInput, setSubCVRInput] = useState(3);
  const [subCVRUnknown, setSubCVRUnknown] = useState(false);
  const [targetCVRInput, setTargetCVRInput] = useState(4.5);
  const [showTooltip, setShowTooltip] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const [leadEmail, setLeadEmail] = useState("");
  const [leadStoreUrl, setLeadStoreUrl] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  const currentCVR = cvrUnknown ? ESTIMATED_CURRENT_CVR : currentCVRInput;
  const subCVR = subCVRUnknown ? ESTIMATED_SUBSCRIBER_TO_CUSTOMER_CVR : subCVRInput;
  const targetCVR = Math.max(targetCVRInput, 0);

  const result = useMemo(
    () => computeEmailCaptureOpportunity({ monthlyVisitors, currentCVR, benchmarkCVR: targetCVR, subscriberToCustomerCVR: subCVR, aov }),
    [monthlyVisitors, currentCVR, targetCVR, subCVR, aov],
  );

  const currentSubscribers = Math.round(monthlyVisitors * (currentCVR / 100));
  const currentCustomers = Math.round(currentSubscribers * (subCVR / 100));
  const currentRevenue = Math.round(currentCustomers * aov);
  const targetSubscribers = Math.round(monthlyVisitors * (targetCVR / 100));
  const targetCustomers = Math.round(targetSubscribers * (subCVR / 100));
  const targetRevenue = Math.round(targetCustomers * aov);

  async function handleSendReport(e: React.FormEvent) {
    e.preventDefault();
    setLeadStatus("loading");
    try {
      const res = await fetch("/api/tools/email-capture-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: leadEmail,
          storeUrl: leadStoreUrl || null,
          inputs: { monthlyVisitors, currentCVR, aov, subscriberToCustomerCVR: subCVR, targetCVR },
          result,
        }),
      });
      if (!res.ok) throw new Error();
      setLeadStatus("sent");
    } catch {
      setLeadStatus("error");
    }
  }

  return (
    <div>
      {/* Inputs */}
      <div className="mx-auto max-w-2xl rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:p-7 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Monthly Website Visitors</label>
            <input
              type="number"
              min={0}
              value={monthlyVisitors}
              onChange={(e) => setMonthlyVisitors(Math.max(0, Number(e.target.value)))}
              className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Average Order Value (USD)</label>
            <input
              type="number"
              min={0}
              value={aov}
              onChange={(e) => setAov(Math.max(0, Number(e.target.value)))}
              className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-[color:var(--color-text-secondary)]">Current Email Capture Rate (%)</label>
            </div>
            <input
              type="number"
              step={0.1}
              min={0}
              max={100}
              disabled={cvrUnknown}
              value={cvrUnknown ? ESTIMATED_CURRENT_CVR : currentCVRInput}
              onChange={(e) => setCurrentCVRInput(Number(e.target.value))}
              className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50"
            />
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[color:var(--color-text-secondary)]">
              <input type="checkbox" checked={cvrUnknown} onChange={(e) => setCvrUnknown(e.target.checked)} />
              I don&apos;t know my capture rate (use {ESTIMATED_CURRENT_CVR}% illustrative estimate)
            </label>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]" title="The capture rate you'd like to model reaching. This is a goal you set, not an industry claim.">
              Target Capture Rate (%)
            </label>
            <input
              type="number"
              step={0.1}
              min={0}
              max={100}
              value={targetCVRInput}
              onChange={(e) => setTargetCVRInput(Number(e.target.value))}
              className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] text-[color:var(--color-text-secondary)]">The rate you want to model reaching — set your own goal.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]" title="The percentage of newly captured email subscribers who eventually make a purchase.">
              Email Subscriber → Customer Conversion Rate (%)
            </label>
            <input
              type="number"
              step={0.1}
              min={0}
              max={100}
              disabled={subCVRUnknown}
              value={subCVRUnknown ? ESTIMATED_SUBSCRIBER_TO_CUSTOMER_CVR : subCVRInput}
              onChange={(e) => setSubCVRInput(Number(e.target.value))}
              className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50"
            />
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[color:var(--color-text-secondary)]">
              <input type="checkbox" checked={subCVRUnknown} onChange={(e) => setSubCVRUnknown(e.target.checked)} />
              I don&apos;t know this (use {ESTIMATED_SUBSCRIBER_TO_CUSTOMER_CVR}% illustrative estimate)
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCalculated(true)}
          className="mt-6 w-full rounded-full bg-[color:var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
        >
          Calculate Revenue Opportunity
        </button>
      </div>

      {calculated && (
        <div className="mx-auto max-w-4xl mt-10 space-y-10">
          {/* Main result */}
          {result.isAboveBenchmark ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-[color:var(--color-text-primary)]">You&apos;re already at or above your target capture rate.</p>
              <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">Try raising the target above to explore additional optimization potential.</p>
            </div>
          ) : (
            <div className="text-center relative">
              <p className="text-4xl sm:text-5xl font-bold tracking-tight text-[color:var(--color-primary)] tabular-nums">
                +{formatCurrency(result.additionalAnnualRevenue)} / year
              </p>
              <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] max-w-md mx-auto">
                Estimated additional revenue if your email capture rate increased from {currentCVR}% to your {targetCVR}% target. At your current traffic, that&apos;s approximately {formatNumber(result.additionalSubscribers)} additional subscribers per month.
              </p>
              <button
                type="button"
                onClick={() => setShowTooltip((s) => !s)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-primary)] underline underline-offset-2"
              >
                ⓘ How is this calculated?
              </button>
              {showTooltip && (
                <div className="mx-auto mt-4 max-w-md rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-5 text-left text-xs text-[color:var(--color-text-secondary)] space-y-1.5">
                  <p className="mb-2 font-semibold text-[color:var(--color-text-primary)]">How we calculate your revenue opportunity</p>
                  <p>Monthly Visitors: {formatNumber(monthlyVisitors)}</p>
                  <p>Current CVR: {currentCVR}%</p>
                  <p>Target CVR: {targetCVR}%</p>
                  <p>Additional Subscribers: {formatNumber(monthlyVisitors)} × ({targetCVR}% − {currentCVR}%) = {formatNumber(result.additionalSubscribers)}</p>
                  <p>Subscriber → Customer CVR: {subCVR}%</p>
                  <p>Additional Customers: {formatNumber(result.additionalSubscribers)} × {subCVR}% = {formatNumber(result.additionalCustomers)}</p>
                  <p>AOV: {formatCurrency(aov)}</p>
                  <p>Additional Monthly Revenue: {formatNumber(result.additionalCustomers)} × {formatCurrency(aov)} = {formatCurrency(result.additionalMonthlyRevenue)}</p>
                  <p>Additional Annual Revenue: {formatCurrency(result.additionalMonthlyRevenue)} × 12 = {formatCurrency(result.additionalAnnualRevenue)}</p>
                  <p className="pt-2 font-medium text-[color:var(--color-text-primary)]">This is an estimate, not a revenue guarantee. Actual performance varies by store and customer behavior.</p>
                </div>
              )}
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Additional Subscribers / Month", value: `+${formatNumber(result.additionalSubscribers)}` },
              { label: "Additional Customers / Month", value: `+${formatNumber(result.additionalCustomers)}` },
              { label: "Additional Revenue / Month", value: `+${formatCurrency(result.additionalMonthlyRevenue)}` },
              { label: "Additional Revenue / Year", value: `+${formatCurrency(result.additionalAnnualRevenue)}` },
            ].map((k) => (
              <div key={k.label} className="hover-float rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-center">
                <p className="text-lg font-bold tabular-nums text-[color:var(--color-text-primary)]">{k.value}</p>
                <p className="mt-1 text-[11px] text-[color:var(--color-text-secondary)]">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Funnel comparison */}
          <div>
            <h3 className="mb-4 text-center text-lg font-bold text-[color:var(--color-text-primary)]">What reaching your target could mean for your store</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Current</p>
                <FunnelRows rows={[
                  [`${formatNumber(monthlyVisitors)} Visitors`],
                  [`${currentCVR}% Capture Rate`],
                  [`${formatNumber(currentSubscribers)} Subscribers`],
                  [`${subCVR}% Purchase Rate`],
                  [`${formatNumber(currentCustomers)} Customers`],
                  [`${formatCurrency(currentRevenue)} Revenue`],
                ]} />
              </div>
              <div className="rounded-2xl border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">Your Target</p>
                <FunnelRows rows={[
                  [`${formatNumber(monthlyVisitors)} Visitors`],
                  [`${targetCVR}% Capture Rate`],
                  [`${formatNumber(targetSubscribers)} Subscribers`],
                  [`${subCVR}% Purchase Rate`],
                  [`${formatNumber(targetCustomers)} Customers`],
                  [`${formatCurrency(targetRevenue)} Revenue`],
                ]} emphasize />
              </div>
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-[color:var(--color-primary)]">
              Difference: +{formatCurrency(targetRevenue - currentRevenue)}/month
            </p>
          </div>

          {/* Asmos transition */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-7 text-center">
            <h3 className="mb-2 text-lg font-bold text-[color:var(--color-text-primary)]">Knowing the opportunity is one thing. Capturing it is another.</h3>
            <p className="mb-6 text-sm text-[color:var(--color-text-secondary)] max-w-md mx-auto">
              Asmos continuously creates, tests, and optimizes your email capture experiences to find what converts best for your store.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href={CTA.primary.href} className="rounded-full bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
                {CTA.primary.label}
              </Link>
              <Link href={CTA.tertiary.href} className="text-sm font-medium text-[color:var(--color-primary)]">
                {CTA.tertiary.label}
              </Link>
            </div>
          </div>

          {/* Send me my results */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
            {leadStatus === "sent" ? (
              <p className="text-center text-sm font-medium text-[color:var(--color-text-primary)]">Sent — check your inbox for your calculation and revenue opportunity.</p>
            ) : (
              <form onSubmit={handleSendReport} className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 w-full">
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Work Email</label>
                  <input required type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none" />
                </div>
                <div className="flex-1 w-full">
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Store URL (optional)</label>
                  <input value={leadStoreUrl} onChange={(e) => setLeadStoreUrl(e.target.value)} className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none" />
                </div>
                <button type="submit" disabled={leadStatus === "loading"} className="w-full sm:w-auto rounded-full bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97] disabled:opacity-50">
                  {leadStatus === "loading" ? "Sending…" : "Send My Report"}
                </button>
              </form>
            )}
            {leadStatus === "error" && <p className="mt-2 text-xs text-red-500">Something went wrong. Please try again.</p>}
            <p className="mt-2 text-[11px] text-[color:var(--color-text-secondary)]">We&apos;ll send your calculation and revenue opportunity.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelRows({ rows, emphasize }: { rows: string[][]; emphasize?: boolean }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className={`text-sm ${emphasize ? "font-semibold text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]"}`}>
          {r[0]}
          {i < rows.length - 1 && <div className="text-[10px] text-[color:var(--color-border)]">↓</div>}
        </div>
      ))}
    </div>
  );
}
