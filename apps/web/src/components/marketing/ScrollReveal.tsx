"use client";

import { useEffect } from "react";

/**
 * Wires up the .reveal / .reveal-eager / .reveal-stagger scroll-in
 * animations (see globals.css) via IntersectionObserver. Mount once per
 * page — rendered from MarketingFooter so every marketing page gets it
 * without needing to remember to add it individually. IntersectionObserver
 * fires an initial callback for already-in-viewport elements, so anything
 * above the fold at mount time reveals immediately rather than staying
 * hidden until a scroll event.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = document.querySelectorAll(".reveal, .reveal-eager, .reveal-stagger");
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
