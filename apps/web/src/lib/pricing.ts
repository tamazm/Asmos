// Pricing bracket logic shared by the pricing slider and the compact comparison table.

export type PlanTier = "Starter" | "Growth" | "Scale" | "Custom";

export interface PricingBracket {
  tier: PlanTier;
  maxVisitors: number | null; // null = custom / above self-serve range
  price: number | null; // monthly, USD
  managedIncluded: boolean;
  managedAddOn: number | null; // +$/mo, null if included or not applicable
  visitorLabel: string;
  abTests: string;
  features: string[];
}

export const PRICING_BRACKETS: PricingBracket[] = [
  {
    tier: "Starter",
    maxVisitors: 20_000,
    price: 100,
    managedIncluded: false,
    managedAddOn: 200,
    visitorLabel: "Up to 20K Monthly Visitors",
    abTests: "4",
    features: ["Full Asmos Platform", "14-Day Free Trial", "Up to 20K Monthly Visitors", "4 A/B Tests", "Live Chat Support", "Automatic Onboarding"],
  },
  {
    tier: "Growth",
    maxVisitors: 50_000,
    price: 400,
    managedIncluded: false,
    managedAddOn: 200,
    visitorLabel: "Up to 50K Monthly Visitors",
    abTests: "30",
    features: ["Full Asmos Platform", "14-Day Free Trial", "Up to 50K Monthly Visitors", "30 A/B Tests", "Live Chat Support", "Automatic Onboarding"],
  },
  {
    tier: "Growth",
    maxVisitors: 100_000,
    price: 500,
    managedIncluded: false,
    managedAddOn: 200,
    visitorLabel: "Up to 100K Monthly Visitors",
    abTests: "30",
    features: ["Full Asmos Platform", "14-Day Free Trial", "Up to 100K Monthly Visitors", "30 A/B Tests", "Live Chat Support", "Automatic Onboarding"],
  },
  {
    tier: "Growth",
    maxVisitors: 500_000,
    price: 700,
    managedIncluded: false,
    managedAddOn: 200,
    visitorLabel: "Up to 500K Monthly Visitors",
    abTests: "50",
    features: ["Full Asmos Platform", "14-Day Free Trial", "Up to 500K Monthly Visitors", "50 A/B Tests", "Live Chat Support", "Automatic Onboarding"],
  },
  {
    tier: "Scale",
    maxVisitors: 750_000,
    price: 1000,
    managedIncluded: true,
    managedAddOn: null,
    visitorLabel: "Up to 750K Monthly Visitors",
    abTests: "100",
    features: ["Full Asmos Platform", "14-Day Free Trial", "Up to 750K Monthly Visitors", "100 A/B Tests", "Live Chat Support", "White-Glove Onboarding", "Dedicated Customer Success Manager", "Hands-On Setup & Support"],
  },
  {
    tier: "Scale",
    maxVisitors: 1_000_000,
    price: 1500,
    managedIncluded: true,
    managedAddOn: null,
    visitorLabel: "Up to 1M Monthly Visitors",
    abTests: "150",
    features: ["Full Asmos Platform", "14-Day Free Trial", "Up to 1M Monthly Visitors", "150 A/B Tests", "Live Chat Support", "White-Glove Onboarding", "Dedicated Customer Success Manager", "Hands-On Setup & Support"],
  },
];

export function getBracketForTraffic(traffic: number): PricingBracket | null {
  for (const bracket of PRICING_BRACKETS) {
    if (bracket.maxVisitors !== null && traffic <= bracket.maxVisitors) return bracket;
  }
  return null; // above 1M -> custom
}

export const ANNUAL_DISCOUNT = 0.2;
export const annualPrice = (monthly: number) => Math.round(monthly * (1 - ANNUAL_DISCOUNT));

// Slider mapping: continuous log-ish scale from 1,000 to 1,500,000+, expressed as 0-1000 position.
const SLIDER_MIN_VISITORS = 1_000;
const SLIDER_MAX_VISITORS = 1_500_000; // beyond this, slider still moves but bucket = "above 1M"
const LOG_MIN = Math.log10(SLIDER_MIN_VISITORS);
const LOG_MAX = Math.log10(SLIDER_MAX_VISITORS);

export function sliderPositionToTraffic(position: number): number {
  const t = position / 1000;
  const log = LOG_MIN + t * (LOG_MAX - LOG_MIN);
  return Math.round(Math.pow(10, log) / 1000) * 1000; // round to nearest 1,000
}

export function trafficToSliderPosition(traffic: number): number {
  const clamped = Math.min(Math.max(traffic, SLIDER_MIN_VISITORS), SLIDER_MAX_VISITORS);
  const log = Math.log10(clamped);
  const t = (log - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return Math.round(t * 1000);
}

export function formatVisitors(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
}
