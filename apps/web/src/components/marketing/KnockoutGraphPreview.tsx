"use client";

import { useEffect, useRef, useState } from "react";

/**
 * KnockoutGraphPreview
 *
 * The same knockout story as KnockoutBracketPreview, told as a conversion
 * curve instead of a card bracket: four variant lines draw in together,
 * then the losers fade to gray with a struck-through "Eliminated" state
 * while the winner keeps its color and gets a pulsing "Winning" highlight.
 * Used in the "How Asmos works" section to make the mechanism legible at
 * a glance rather than just described in prose.
 */

const VIEW_W = 600;
const VIEW_H = 240;
const X = [60, 156, 252, 348, 444, 540];

const GRAPH_VARIANTS = [
  { id: "A", label: "Variant A", color: "#165DFF", cr: "5.8%", winner: true, y: [128, 113, 100, 84, 69, 51] },
  { id: "B", label: "Variant B", color: "#a78bfa", cr: "3.1%", winner: false, y: [107, 110, 115, 113, 118, 120] },
  { id: "C", label: "Variant C", color: "#34d399", cr: "4.2%", winner: false, y: [82, 84, 90, 87, 92, 92] },
  { id: "D", label: "Variant D", color: "#fb923c", cr: "2.6%", winner: false, y: [115, 123, 125, 131, 133, 133] },
] as const;

function pathFor(ys: readonly number[]) {
  return ys.map((y, i) => `${i === 0 ? "M" : "L"}${X[i]},${y}`).join(" ");
}

function pathLength(ys: readonly number[]) {
  let len = 0;
  for (let i = 1; i < ys.length; i++) {
    len += Math.hypot(X[i] - X[i - 1], ys[i] - ys[i - 1]);
  }
  return len;
}

const DRAW_MS = 1500;

export function KnockoutGraphPreview() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [settled, setSettled] = useState(false);
  const [prefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      setSettled(true);
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
    if (!started || prefersReducedMotion) {
      if (started) setSettled(true);
      return;
    }
    const t = setTimeout(() => setSettled(true), DRAW_MS + 250);
    return () => clearTimeout(t);
  }, [started, prefersReducedMotion]);

  return (
    <div ref={ref} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Live campaign</p>
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Conversion rate by variant, last 6 days</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors duration-300"
          style={{
            background: settled ? "#dcfce7" : "var(--color-primary-light)",
            color: settled ? "#16a34a" : "var(--color-primary)",
          }}
        >
          {settled ? "Winner found" : "Testing"}
        </span>
      </div>

      {/* Chart */}
      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {/* Gridlines */}
          {[40, 100, 160, 220].map((y) => (
            <line key={y} x1={40} x2={560} y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1" />
          ))}
          {/* Lines */}
          {GRAPH_VARIANTS.map((v, i) => {
            const len = pathLength(v.y);
            const losing = settled && !v.winner;
            return (
              <path
                key={v.id}
                d={pathFor(v.y)}
                fill="none"
                stroke={losing ? "#d1d5db" : v.color}
                strokeWidth={v.winner ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: len,
                  strokeDashoffset: started ? 0 : len,
                  opacity: losing ? 0.55 : 1,
                  transition: `stroke-dashoffset ${DRAW_MS}ms var(--ease-out-expo) ${i * 110}ms, stroke 500ms ease, opacity 500ms ease`,
                }}
              />
            );
          })}
        </svg>

        {/* Endpoint dots + status chips, positioned over the SVG by percentage
            so they track the plotted points exactly at any container width. */}
        {GRAPH_VARIANTS.map((v) => {
          const left = `${(X[X.length - 1] / VIEW_W) * 100}%`;
          const top = `${(v.y[v.y.length - 1] / VIEW_H) * 100}%`;
          const losing = settled && !v.winner;
          const winning = settled && v.winner;
          return (
            <div key={v.id} className="pointer-events-none absolute" style={{ left, top, transform: "translate(-50%, -50%)" }}>
              <span
                className={winning ? "bracket-winner" : ""}
                style={{
                  display: "block",
                  width: v.winner ? 10 : 7,
                  height: v.winner ? 10 : 7,
                  borderRadius: "50%",
                  background: losing ? "#d1d5db" : v.color,
                  border: "2px solid var(--color-surface)",
                  transition: "background 500ms ease, width 300ms ease, height 300ms ease",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Legend - same win/loss vocabulary as the hero bracket: struck-through
          + faded for eliminated, solid + tagged for the winner. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GRAPH_VARIANTS.map((v) => {
          const losing = settled && !v.winner;
          const winning = settled && v.winner;
          return (
            <div
              key={v.id}
              className="rounded-lg border p-2.5 transition-[opacity,border-color,background-color] duration-500"
              style={{
                opacity: losing ? 0.55 : 1,
                borderColor: winning ? v.color : "var(--color-border)",
                background: winning ? "var(--color-primary-light)" : "transparent",
              }}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: losing ? "#d1d5db" : v.color }} />
                <span
                  className="text-[11px] font-semibold text-[color:var(--color-text-primary)]"
                  style={{ textDecoration: losing ? "line-through" : "none" }}
                >
                  {v.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold tabular-nums" style={{ color: winning ? "var(--color-primary)" : "var(--color-text-primary)" }}>
                  {v.cr}
                </span>
                {settled && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{
                      background: winning ? "var(--color-primary)" : "#f3f4f6",
                      color: winning ? "white" : "#9ca3af",
                    }}
                  >
                    {winning ? "Winning" : "Out"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
