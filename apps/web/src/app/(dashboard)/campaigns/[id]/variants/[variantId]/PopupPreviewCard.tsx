"use client";

// ─── Color utility ────────────────────────────────────────────────────────────

function btnTextColor(hex: string): string {
  const s = hex.trim();
  let r = 22, g = 93, b = 255;
  if (s[0] === "#") {
    const full =
      s.length === 4
        ? "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
        : s;
    r = parseInt(full.slice(1, 3), 16);
    g = parseInt(full.slice(3, 5), 16);
    b = parseInt(full.slice(5, 7), 16);
  }
  const vals = [r, g, b].map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
  return lum < 0.35 ? "#ffffff" : "#0d0d10";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PopupPreviewCardProps {
  headline?: string;
  body?: string;
  ctaText?: string;
  primaryColor?: string;
  campaignName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PopupPreviewCard({
  headline = "Get 10% off your first order",
  body = "Subscribe and receive a welcome discount on anything in the store.",
  ctaText = "Claim my discount",
  primaryColor = "#165DFF",
  campaignName = "Your Store",
}: PopupPreviewCardProps) {
  const textColor = btnTextColor(primaryColor);

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-[color:var(--color-text-primary)]">
        Popup Preview
      </h2>

      {/* Outer wrapper — centered, constrained */}
      <div className="flex items-center justify-center py-4">
        {/* Double-Bezel outer shell */}
        <div
          className="w-full max-w-[340px] rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
        >
          {/* Inner core */}
          <div
            className="overflow-hidden rounded-[1rem] bg-white"
            style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
          >
            {/* Accent bar */}
            <div className="h-1.5" style={{ backgroundColor: primaryColor }} />

            <div className="px-5 pt-4 pb-5">
              {/* Brand row */}
              <div className="flex items-center gap-1.5 mb-3">
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: primaryColor }}
                />
                <span
                  className="text-[10px] font-bold tracking-[0.08em] uppercase"
                  style={{ color: "#9ca3af" }}
                >
                  {campaignName.toUpperCase()}
                </span>
              </div>

              {/* Headline */}
              <p
                className="text-[17px] font-extrabold leading-snug tracking-tight mb-2"
                style={{ color: "#0d0d10" }}
              >
                {headline}
              </p>

              {/* Body */}
              <p
                className="text-[12px] leading-relaxed mb-4"
                style={{ color: "#6b7280" }}
              >
                {body}
              </p>

              {/* Email input */}
              <div
                className="w-full rounded-lg border px-3 py-2.5 text-[12px] mb-2.5"
                style={{
                  borderColor: "#e5e7eb",
                  background: "#fafafa",
                  color: "#9ca3af",
                }}
              >
                Your email address
              </div>

              {/* CTA Button */}
              <div
                className="w-full rounded-lg py-2.5 text-[13px] font-bold text-center mb-3"
                style={{ backgroundColor: primaryColor, color: textColor }}
              >
                {ctaText}
              </div>

              {/* Trust signal */}
              <p
                className="text-center text-[10px]"
                style={{ color: "#9ca3af" }}
              >
                No spam. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Color swatch row */}
      <div className="mt-4 flex items-center gap-2 pt-4 border-t border-[color:var(--color-border)]">
        <span
          className="h-4 w-4 rounded-md border border-black/10 flex-shrink-0"
          style={{ backgroundColor: primaryColor }}
          aria-hidden="true"
        />
        <span className="font-mono text-xs text-[color:var(--color-text-secondary)] tabular-nums">
          {primaryColor}
        </span>
        <span className="text-[color:var(--color-border)]" aria-hidden="true">
          &middot;
        </span>
        <span className="text-xs text-[color:var(--color-text-secondary)] truncate">
          {headline}
        </span>
      </div>
    </div>
  );
}
