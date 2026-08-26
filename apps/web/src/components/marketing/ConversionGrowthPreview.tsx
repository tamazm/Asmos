"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ConversionGrowthPreview
 *
 * The "Learn & improve automatically" step's visual: a single conversion-rate
 * line climbing over six weeks as Asmos keeps promoting whatever's winning.
 * Deliberately the odd one out next to the multi-variant bracket/graph
 * previews - this one has already finished competing and is just showing
 * the compounding result.
 */

const VIEW_W = 600;
const VIEW_H = 200;
const X = [40, 144, 248, 352, 456, 560];
const BASELINE_Y = 170;
const VALUES = [2.1, 2.4, 2.9, 3.5, 4.1, 4.8];
const Y = [148, 136, 117, 95, 73, 46];
const WEEK_LABELS = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];
const GAIN_PCT = Math.round(((VALUES[VALUES.length - 1] - VALUES[0]) / VALUES[0]) * 100);

const DRAW_MS = 1600;

function linePath() {
  return Y.map((y, i) => `${i === 0 ? "M" : "L"}${X[i]},${y}`).join(" ");
}

function areaPath() {
  return `${linePath()} L${X[X.length - 1]},${BASELINE_Y} L${X[0]},${BASELINE_Y} Z`;
}

function lineLength() {
  let len = 0;
  for (let i = 1; i < Y.length; i++) len += Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  return len;
}

export function ConversionGrowthPreview() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [display, setDisplay] = useState(VALUES[0]);
  const [prefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setStarted(true);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (prefersReducedMotion) {
      setDisplay(VALUES[VALUES.length - 1]);
      return;
    }
    let raf: number;
    const start = performance.now();
    const from = VALUES[0];
    const to = VALUES[VALUES.length - 1];
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DRAW_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, prefersReducedMotion]);

  const settled = prefersReducedMotion ? started : display >= VALUES[VALUES.length - 1] - 0.01;
  const len = lineLength();

  return (
    <div ref={ref} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:p-8">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Conversion rate over time</p>
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Same store, six weeks of autonomous testing</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity duration-500"
          style={{ background: "#dcfce7", color: "#16a34a", opacity: settled ? 1 : 0 }}
        >
          +{GAIN_PCT}%
        </span>
      </div>

      <div className="mb-1 flex items-end gap-2">
        <span className="text-4xl font-semibold tracking-[-0.02em] tabular-nums text-[color:var(--color-primary)]">{display.toFixed(1)}%</span>
        <span className="mb-1 text-xs text-[color:var(--color-text-secondary)]">current conversion rate</span>
      </div>

      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[46, 95, 148].map((y) => (
            <line key={y} x1={X[0]} x2={X[X.length - 1]} y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1" />
          ))}
          <path
            d={areaPath()}
            fill="url(#growthFill)"
            style={{ opacity: started ? 1 : 0, transition: "opacity 900ms ease 400ms" }}
          />
          <path
            d={linePath()}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: len,
              strokeDashoffset: started ? 0 : len,
              transition: `stroke-dashoffset ${DRAW_MS}ms var(--ease-out-expo)`,
            }}
          />
        </svg>
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${(X[X.length - 1] / VIEW_W) * 100}%`,
            top: `${(Y[Y.length - 1] / VIEW_H) * 100}%`,
            transform: "translate(-50%, -50%)",
            opacity: settled ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        >
          <span
            className="bracket-winner block rounded-full"
            style={{ width: 10, height: 10, background: "var(--color-primary)", border: "2px solid var(--color-surface)" }}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[color:var(--color-text-secondary)]">
        {WEEK_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
    </div>
  );
}
