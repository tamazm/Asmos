// Industry email-capture benchmark dataset.
//
// TODO(real-data): every value below is a PLACEHOLDER, not a sourced figure.
// Replace `benchmarkCVR`, `source`, and `sourceUrl` per industry with real,
// citable ecommerce/email-capture research before this tool is treated as
// authoritative. `sourced: false` drives the visible "placeholder" badge in
// the UI — flip to true only once a real source is attached.

export interface IndustryBenchmark {
  industry: string;
  benchmarkCVR: number; // percent, e.g. 4.2 = 4.2%
  source: string;
  sourceUrl: string | null;
  updated: string; // ISO date
  sourced: boolean;
}

export const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  { industry: "Fashion & Apparel", benchmarkCVR: 4.2, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "Beauty & Cosmetics", benchmarkCVR: 4.8, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "Health & Wellness", benchmarkCVR: 4.0, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "Food & Beverage", benchmarkCVR: 3.6, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "Home & Furniture", benchmarkCVR: 3.4, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "Electronics", benchmarkCVR: 3.1, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "Jewelry & Accessories", benchmarkCVR: 4.4, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "Sports & Fitness", benchmarkCVR: 3.8, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "General Ecommerce", benchmarkCVR: 3.9, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
  { industry: "Other", benchmarkCVR: 3.5, source: "Placeholder — sourced benchmark pending", sourceUrl: null, updated: "2026-08-01", sourced: false },
];

export function getBenchmark(industry: string): IndustryBenchmark {
  return INDUSTRY_BENCHMARKS.find((b) => b.industry === industry) ?? INDUSTRY_BENCHMARKS[INDUSTRY_BENCHMARKS.length - 1];
}

// Illustrative default used when the visitor doesn't know their own rate —
// clearly labeled as an assumption in the UI, never presented as their data.
export const ESTIMATED_CURRENT_CVR = 2.5;
export const ESTIMATED_SUBSCRIBER_TO_CUSTOMER_CVR = 3;
