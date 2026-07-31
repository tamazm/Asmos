"use client";

import { useState } from "react";

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

// ─── Popup widget ─────────────────────────────────────────────────────────────

function PopupWidget({
  headline,
  body,
  ctaText,
  primaryColor,
  campaignName,
  compact,
}: PopupPreviewCardProps & { compact?: boolean }) {
  const color = primaryColor ?? "#165DFF";
  const textColor = btnTextColor(color);
  const px = compact ? "px-3.5 pt-3 pb-3.5" : "px-5 pt-4 pb-5";
  const headlineSize = compact ? "text-[13px]" : "text-[17px]";
  const bodySize = compact ? "text-[10px]" : "text-[12px]";
  const inputSize = compact ? "text-[10px] py-1.5" : "text-[12px] py-2.5";
  const ctaSize = compact ? "text-[10px] py-1.5" : "text-[13px] py-2.5";
  const trustSize = compact ? "text-[8px]" : "text-[10px]";
  const brandDot = compact ? "h-1.5 w-1.5" : "h-2 w-2";
  const brandText = compact ? "text-[8px]" : "text-[10px]";
  const accentHeight = compact ? "h-1" : "h-1.5";

  return (
    <div
      className="overflow-hidden rounded-[1rem] bg-white"
      style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
    >
      {/* Accent bar */}
      <div className={accentHeight} style={{ backgroundColor: color }} />

      <div className={px}>
        {/* Brand row */}
        <div className="flex items-center gap-1.5 mb-3">
          <div
            className={`${brandDot} rounded-full flex-shrink-0`}
            style={{ backgroundColor: color }}
          />
          <span
            className={`${brandText} font-bold tracking-[0.08em] uppercase`}
            style={{ color: "#9ca3af" }}
          >
            {(campaignName ?? "Your Store").toUpperCase()}
          </span>
        </div>

        {/* Headline */}
        <p
          className={`${headlineSize} font-extrabold leading-snug tracking-tight mb-2`}
          style={{ color: "#0d0d10" }}
        >
          {headline ?? "Get 10% off your first order"}
        </p>

        {/* Body */}
        <p
          className={`${bodySize} leading-relaxed mb-4`}
          style={{ color: "#6b7280" }}
        >
          {body ?? "Subscribe and receive a welcome discount on anything in the store."}
        </p>

        {/* Email input */}
        <div
          className={`w-full rounded-lg border px-3 ${inputSize} mb-2.5`}
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
          className={`w-full rounded-lg ${ctaSize} font-bold text-center mb-3`}
          style={{ backgroundColor: color, color: textColor }}
        >
          {ctaText ?? "Claim my discount"}
        </div>

        {/* Trust signals row */}
        <div className="flex items-center justify-center gap-3">
          <p
            className={`${trustSize} text-center`}
            style={{ color: "#9ca3af" }}
          >
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PopupPreviewCard({
  headline = "Get 10% off your first order",
  body = "Subscribe and receive a welcome discount on anything in the store.",
  ctaText = "Claim my discount",
  primaryColor = "#165DFF",
  campaignName = "Your Store",
}: PopupPreviewCardProps) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">
          Popup Preview
        </h2>

        {/* Desktop / Mobile toggle */}
        <div className="flex items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-0.5 gap-0.5">
          {(["desktop", "mobile"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className="flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-xs font-medium transition-[background-color,color] duration-150"
              style={
                view === mode
                  ? {
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text-primary)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                    }
                  : {
                      color: "var(--color-text-secondary)",
                    }
              }
              aria-pressed={view === mode}
            >
              {mode === "desktop" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="11" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 18h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              <span className="capitalize">{mode}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Outer wrapper — centered, constrained */}
      <div className="flex items-center justify-center py-4">
        {view === "desktop" ? (
          /* Desktop: wider preview with browser chrome hint */
          <div className="w-full max-w-[360px]">
            {/* Double-Bezel outer shell */}
            <div
              className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <PopupWidget
                headline={headline}
                body={body}
                ctaText={ctaText}
                primaryColor={primaryColor}
                campaignName={campaignName}
              />
            </div>
          </div>
        ) : (
          /* Mobile: narrower with phone frame hint */
          <div className="w-full max-w-[240px]">
            <div
              className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <PopupWidget
                headline={headline}
                body={body}
                ctaText={ctaText}
                primaryColor={primaryColor}
                campaignName={campaignName}
                compact
              />
            </div>
          </div>
        )}
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
