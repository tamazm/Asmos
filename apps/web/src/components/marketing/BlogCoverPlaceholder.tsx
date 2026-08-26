// No real cover photography exists yet - render a category-tinted abstract
// gradient block instead of a fabricated/stock image.
const CATEGORY_GRADIENTS: Record<string, string> = {
  "Conversion Optimization": "linear-gradient(135deg, oklch(48% 0.255 258 / 0.16), oklch(48% 0.255 258 / 0.04))",
  "Popup Optimization": "linear-gradient(135deg, oklch(60% 0.18 200 / 0.18), oklch(60% 0.18 200 / 0.04))",
  "Email Capture": "linear-gradient(135deg, oklch(65% 0.18 150 / 0.18), oklch(65% 0.18 150 / 0.04))",
  "A/B Testing": "linear-gradient(135deg, oklch(65% 0.2 40 / 0.18), oklch(65% 0.2 40 / 0.04))",
  Shopify: "linear-gradient(135deg, oklch(65% 0.2 145 / 0.18), oklch(65% 0.2 145 / 0.04))",
  Benchmarks: "linear-gradient(135deg, oklch(60% 0.15 300 / 0.16), oklch(60% 0.15 300 / 0.04))",
  "AI & Automation": "linear-gradient(135deg, oklch(55% 0.2 258 / 0.2), oklch(55% 0.2 258 / 0.05))",
  "Case Studies": "linear-gradient(135deg, oklch(55% 0.18 20 / 0.16), oklch(55% 0.18 20 / 0.04))",
};

export function BlogCoverPlaceholder({ category }: { category: string }) {
  const bg = CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS["Conversion Optimization"];
  return (
    <div className="relative h-32 w-full overflow-hidden border-b border-[color:var(--color-border)]" style={{ background: bg }}>
      <svg className="absolute inset-0 h-full w-full opacity-40" aria-hidden="true">
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-primary)" strokeWidth="0.5" opacity="0.3" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}
