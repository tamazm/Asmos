"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/calculators";
import { CTA } from "@/lib/site";

export function TrafficCalculatorClient() {
  const [monthlyVisitors, setMonthlyVisitors] = useState(50_000);
  const [growthPct, setGrowthPct] = useState(25);
  const [siteCVR, setSiteCVR] = useState(2.0);
  const [aov, setAov] = useState(85);

  const projectedVisitors = useMemo(() => Math.round(monthlyVisitors * (1 + growthPct / 100)), [monthlyVisitors, growthPct]);
  const additionalVisitors = projectedVisitors - monthlyVisitors;

  const currentCustomers = Math.round(monthlyVisitors * (siteCVR / 100));
  const projectedCustomers = Math.round(projectedVisitors * (siteCVR / 100));
  const additionalCustomers = projectedCustomers - currentCustomers;

  const currentRevenue = Math.round(currentCustomers * aov);
  const projectedRevenue = Math.round(projectedCustomers * aov);
  const additionalRevenue = projectedRevenue - currentRevenue;

  return (
    <div>
      <div className="mx-auto max-w-2xl rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:p-7 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Current Monthly Visitors</label>
            <input type="number" min={0} value={monthlyVisitors} onChange={(e) => setMonthlyVisitors(Math.max(0, Number(e.target.value)))} className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Website Conversion Rate (%)</label>
            <input type="number" step={0.1} min={0} max={100} value={siteCVR} onChange={(e) => setSiteCVR(Number(e.target.value))} className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">Average Order Value (USD)</label>
            <input type="number" min={0} value={aov} onChange={(e) => setAov(Math.max(0, Number(e.target.value)))} className="input-glow w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm focus:outline-none" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-[color:var(--color-text-secondary)]">Traffic Growth Scenario</label>
              <span className="text-xs font-semibold text-[color:var(--color-primary)]">+{growthPct}%</span>
            </div>
            <input type="range" min={0} max={200} value={growthPct} onChange={(e) => setGrowthPct(Number(e.target.value))} className="w-full accent-[color:var(--color-primary)] mt-2.5" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl mt-10 space-y-8">
        <div>
          <h3 className="mb-4 text-center text-lg font-bold text-[color:var(--color-text-primary)]">Your traffic opportunity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Today</p>
              <p className="text-sm text-[color:var(--color-text-secondary)]">{formatNumber(monthlyVisitors)} visitors → {formatNumber(currentCustomers)} customers</p>
              <p className="mt-2 text-xl font-bold text-[color:var(--color-text-primary)] tabular-nums">{formatCurrency(currentRevenue)}<span className="text-xs font-normal text-[color:var(--color-text-secondary)]">/mo</span></p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">At +{growthPct}% traffic</p>
              <p className="text-sm text-[color:var(--color-text-secondary)]">{formatNumber(projectedVisitors)} visitors → {formatNumber(projectedCustomers)} customers</p>
              <p className="mt-2 text-xl font-bold text-[color:var(--color-text-primary)] tabular-nums">{formatCurrency(projectedRevenue)}<span className="text-xs font-normal text-[color:var(--color-text-secondary)]">/mo</span></p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <p className="text-sm font-bold text-[color:var(--color-text-primary)] tabular-nums">+{formatNumber(additionalVisitors)}</p>
              <p className="text-[10px] text-[color:var(--color-text-secondary)]">Additional visitors/mo</p>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <p className="text-sm font-bold text-[color:var(--color-text-primary)] tabular-nums">+{formatNumber(additionalCustomers)}</p>
              <p className="text-[10px] text-[color:var(--color-text-secondary)]">Additional customers/mo</p>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <p className="text-sm font-bold text-[color:var(--color-primary)] tabular-nums">+{formatCurrency(additionalRevenue)}</p>
              <p className="text-[10px] text-[color:var(--color-text-secondary)]">Additional revenue/mo</p>
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] text-[color:var(--color-text-secondary)]">
            This models a traffic-growth scenario you define — it is not a prediction or guarantee of actual traffic or revenue.
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-7 text-center">
          <h3 className="mb-2 text-lg font-bold text-[color:var(--color-text-primary)]">More traffic only pays off if more of it converts.</h3>
          <p className="mb-6 text-sm text-[color:var(--color-text-secondary)] max-w-md mx-auto">
            Asmos continuously tests and improves the conversion experience so the traffic you already have — and any traffic you add — converts at a higher rate.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={CTA.primary.href} className="rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
              {CTA.primary.label}
            </Link>
            <Link href="/tools/email-capture-calculator" className="text-sm font-medium text-[color:var(--color-primary)]">
              Try the Email Capture Revenue Calculator
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
