"use client";

import { useEffect, useRef, useState } from "react";

/**
 * KnockoutBracketPreview
 *
 * Visualizes the bandit-based knockout system — Asmos's core differentiator.
 * Shows 4 popup variants competing, with 2 getting eliminated and 1 winning.
 * Animates in sequence to tell the story of autonomous optimization.
 *
 * Two visual variants:
 *   default — light card, used in the hero section
 *   dark    — slightly lighter dark, used in the dark knockout section
 */

interface KnockoutBracketPreviewProps {
  variant?: "default" | "dark";
  animated?: boolean;
  /** When true, renders without its own outer border/shadow — for nesting inside another frame (e.g. the hero's browser-chrome window). */
  embedded?: boolean;
}

// Variant data
const VARIANTS = [
  { id: "A", label: "Variant A", desc: "15% off, blue CTA", color: "#165DFF", cr: "5.8%", winner: true },
  { id: "B", label: "Variant B", desc: "Free shipping offer", color: "#a78bfa", cr: "3.1%", winner: false },
  { id: "C", label: "Variant C", desc: "10% + countdown", color: "#34d399", cr: "4.2%", winner: false },
  { id: "D", label: "Variant D", desc: "Loyalty points join", color: "#fb923c", cr: "2.6%", winner: false },
];

// Animation phases
// 0: all visible, no result
// 1: D eliminated
// 2: B eliminated
// 3: C eliminated, A wins

const PHASES = [0, 1, 2, 3];
const PHASE_DURATIONS = [1400, 900, 900, 1200]; // ms per phase

function useAnimationPhase(autoPlay: boolean) {
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoPlay) return;

    let currentPhase = 0;

    function advance() {
      currentPhase = (currentPhase + 1) % (PHASES.length + 1);
      if (currentPhase > PHASES.length - 1) {
        // Reset after a pause
        timerRef.current = setTimeout(() => {
          currentPhase = 0;
          setPhase(0);
          timerRef.current = setTimeout(advance, 1000);
        }, 2400);
        return;
      }
      setPhase(currentPhase);
      timerRef.current = setTimeout(advance, PHASE_DURATIONS[currentPhase] ?? 900);
    }

    timerRef.current = setTimeout(advance, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoPlay]);

  return phase;
}

function VariantRow({
  v,
  eliminated,
  winner,
  dark,
  delay,
}: {
  v: typeof VARIANTS[number];
  eliminated: boolean;
  winner: boolean;
  dark: boolean;
  delay: number;
}) {
  const borderColor = winner
    ? v.color
    : eliminated
    ? dark ? "oklch(25% 0.02 255)" : "#e5e7eb"
    : dark ? "oklch(25% 0.02 255)" : "#e5e7eb";

  const bgColor = winner
    ? dark ? "oklch(19% 0.06 258)" : "#f0f4ff"
    : dark ? "oklch(17% 0.025 255)" : "#fafafa";

  return (
    <div
      style={{
        transition: `opacity 500ms ease ${delay}ms, transform 500ms ease ${delay}ms`,
        opacity: eliminated ? 0.3 : 1,
        transform: eliminated ? "scale(0.97)" : "scale(1)",
      }}
    >
      <div
        style={{
          border: `1.5px solid ${borderColor}`,
          background: bgColor,
          borderRadius: 10,
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "relative",
          overflow: "hidden",
          boxShadow: winner ? `0 0 0 3px ${v.color}22` : undefined,
          transition: "box-shadow 400ms ease, border-color 400ms ease",
        }}
      >
        {/* Color dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: v.color,
            flexShrink: 0,
            opacity: eliminated ? 0.4 : 1,
          }}
        />

        {/* Label + desc */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: eliminated
                  ? dark ? "oklch(40% 0.01 255)" : "#9ca3af"
                  : dark ? "#f3f4f6" : "#0d0d10",
              textDecoration: eliminated ? "line-through red" : "none",
                transition: "color 400ms ease",
              }}
            >
              {v.label}
            </span>
            {winner && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: v.color,
                  color: "white",
                  borderRadius: 4,
                  padding: "1px 5px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Winner
              </span>
            )}
            {eliminated && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: dark ? "oklch(38% 0.01 255)" : "#d1d5db",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Out
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 10,
              color: eliminated
                ? dark ? "oklch(35% 0.01 255)" : "#d1d5db"
                : dark ? "oklch(55% 0.02 255)" : "#6b7280",
              marginTop: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {v.desc}
          </p>
        </div>

        {/* CR stat */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: winner
              ? v.color
              : eliminated
              ? dark ? "oklch(35% 0.01 255)" : "#d1d5db"
              : dark ? "oklch(70% 0.02 255)" : "#374151",
            flexShrink: 0,
            transition: "color 400ms ease",
          }}
        >
          {v.cr}
        </span>
      </div>
    </div>
  );
}

function TrafficBar({
  phase,
  dark,
}: {
  phase: number;
  dark: boolean;
}) {
  // Traffic allocation: starts equal, shifts to A as phases progress
  const allocations = [
    [25, 25, 25, 25],
    [30, 20, 27, 23], // D starting to lose
    [42, 18, 28, 12], // D losing more, B losing
    [72, 8, 16, 4],   // A winning, others minimal
  ];

  const alloc = allocations[Math.min(phase, 3)];
  const colors = [VARIANTS[0].color, VARIANTS[1].color, VARIANTS[2].color, VARIANTS[3].color];

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: dark ? "oklch(45% 0.02 255)" : "#9ca3af",
        }}
      >
        <span>Traffic allocation</span>
        <span style={{ color: dark ? "oklch(60% 0.14 258)" : "#165DFF" }}>Auto-adjusting</span>
      </div>
      <div
        style={{
          display: "flex",
          height: 6,
          borderRadius: 6,
          overflow: "hidden",
          gap: 1,
        }}
      >
        {alloc.map((pct, i) => (
          <div
            key={i}
            style={{
              width: `${pct}%`,
              background: colors[i],
              transition: "width 800ms cubic-bezier(0.16, 1, 0.3, 1)",
              opacity: phase === 3 && i !== 0 ? 0.35 : 1,
              borderRadius: i === 0 ? "4px 0 0 4px" : i === alloc.length - 1 ? "0 4px 4px 0" : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function KnockoutBracketPreview({
  variant = "default",
  animated = false,
  embedded = false,
}: KnockoutBracketPreviewProps) {
  const dark = variant === "dark";
  const phase = useAnimationPhase(animated);

  const isEliminated = (id: string) => {
    if (phase >= 1 && id === "D") return true;
    if (phase >= 2 && id === "B") return true;
    if (phase >= 3 && id === "C") return true;
    return false;
  };

  const isWinner = (id: string) => phase >= 3 && id === "A";

  const cardBg = dark
    ? "oklch(16% 0.028 258)"
    : "oklch(99.5% 0.002 255)";

  const cardBorder = dark
    ? "oklch(22% 0.035 258)"
    : "#e5e7eb";

  const titleColor = dark ? "#f3f4f6" : "#0d0d10";
  const mutedColor = dark ? "oklch(45% 0.02 255)" : "#9ca3af";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 360,
        borderRadius: embedded ? 14 : 18,
        border: embedded ? "none" : `1.5px solid ${cardBorder}`,
        background: embedded ? "transparent" : cardBg,
        padding: embedded ? 0 : 16,
        boxShadow: embedded
          ? undefined
          : dark
          ? "0 32px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.3)"
          : "0 24px 60px rgba(22,93,255,0.10), 0 6px 20px rgba(0,0,0,0.07)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: titleColor, letterSpacing: "-0.01em" }}>
            Campaign: Summer sale
          </p>
          <p style={{ fontSize: 10, color: mutedColor, marginTop: 1 }}>
            4 variants &middot; {phase < 3 ? "Testing" : "Winner found"}
          </p>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#22c55e",
            background: "#dcfce7",
            borderRadius: 6,
            padding: "3px 7px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Live
        </span>
      </div>

      {/* Traffic bar */}
      <TrafficBar phase={phase} dark={dark} />

      {/* Variants */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {VARIANTS.map((v, i) => (
          <VariantRow
            key={v.id}
            v={v}
            eliminated={isEliminated(v.id)}
            winner={isWinner(v.id)}
            dark={dark}
            delay={i * 40}
          />
        ))}
      </div>

      {/* Footer note */}
      <p
        style={{
          marginTop: 12,
          fontSize: 9.5,
          color: mutedColor,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        {phase < 3
          ? "Automatically shifting traffic to top performers"
          : "Variant A promoted. 72% of traffic now converting at 5.8%"}
      </p>
    </div>
  );
}
