"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up from 0 to `value` once it scrolls into view. Same
 * IntersectionObserver-on-mount pattern as ScrollReveal, but self-contained
 * since each counter animates its own number rather than toggling a shared
 * CSS class - the animated value has to live in JS state.
 */
export function StatCounter({
  value,
  suffix = "",
  prefix = "",
  durationMs = 1400,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);
  // Lazy initializer runs on mount, not inside an effect - window is guarded
  // for the SSR render pass, where this client component still renders once.
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
    if (!started || prefersReducedMotion) return;
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, prefersReducedMotion, value, durationMs]);

  const shown = started ? (prefersReducedMotion ? value : display) : 0;

  return (
    <span ref={ref} className="stat-tick tabular-nums">
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
