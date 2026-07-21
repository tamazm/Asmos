"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const INDUSTRIES = [
  "Ecommerce / Retail",
  "SaaS / Software",
  "Health & Wellness",
  "Education",
  "Food & Beverage",
  "Other",
];

export default function BusinessProfilePage() {
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [brandColor, setBrandColor] = useState("#6366f1");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
          Business profile
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          This sets your default popup theming and helps us tailor
          suggestions to your industry.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Industry
        </label>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        >
          {INDUSTRIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Brand color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded border border-[color:var(--color-border)]"
          />
          <span className="text-sm text-[color:var(--color-text-secondary)]">
            {brandColor}
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Logo
        </label>
        <input
          type="file"
          accept="image/*"
          className="w-full text-sm text-[color:var(--color-text-secondary)]"
        />
      </div>

      <div className="flex justify-between">
        <Button href="/onboarding/verify" variant="secondary">
          Back
        </Button>
        <Button href="/onboarding/consent">Continue</Button>
      </div>
    </div>
  );
}
