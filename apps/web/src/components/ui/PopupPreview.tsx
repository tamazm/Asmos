"use client";

import { useEffect, useState } from "react";

/**
 * PopupPreview — a high-fidelity mockup of the popup Asmos builds.
 * Shows inside a minimal browser chrome so visitors can picture it on their store.
 * Design goal: make someone think "I want that on my store."
 */
export function PopupPreview() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-[340px] mx-auto select-none"
      style={{ perspective: "1200px" }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotateX(2deg) rotateY(-3deg); }
          50%       { transform: translateY(-8px) rotateX(2deg) rotateY(-3deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes badge-enter {
          from { opacity: 0; transform: translateY(6px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .popup-float {
          animation: float 5s ease-in-out infinite;
          transform: rotateX(2deg) rotateY(-3deg);
          transform-style: preserve-3d;
        }
        .badge-enter { animation: badge-enter 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .badge-enter-1 { animation: badge-enter 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both; }
        .badge-enter-2 { animation: badge-enter 0.5s 0.16s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      {/* Browser chrome wrapper */}
      <div
        className={`rounded-2xl overflow-hidden shadow-2xl transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}
        style={{
          boxShadow: "0 32px 80px rgba(22,93,255,0.16), 0 8px 24px rgba(0,0,0,0.10)",
        }}
      >
        {/* Browser bar */}
        <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#f5f5f7] border-b border-black/[0.07]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-2 flex-1 rounded-md bg-white border border-black/[0.08] h-[22px] flex items-center px-2.5 gap-1.5">
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-40">
              <circle cx="6" cy="5" r="3.5" stroke="#374151" strokeWidth="1.3"/>
              <path d="M8.5 8.5L11 11" stroke="#374151" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="text-[9px] text-gray-400 font-medium truncate tracking-tight">urbancraft.com</span>
          </div>
        </div>

        {/* Store page background */}
        <div className="relative bg-[#fafaf9] overflow-hidden" style={{ minHeight: 320 }}>

          {/* Store skeleton — subtle, doesn't distract */}
          <div className="absolute inset-0 p-4 pointer-events-none">
            {/* Nav skeleton */}
            <div className="flex items-center justify-between mb-4">
              <div className="h-3 w-20 rounded bg-gray-200/80" />
              <div className="flex gap-3">
                <div className="h-2.5 w-10 rounded bg-gray-200/60" />
                <div className="h-2.5 w-10 rounded bg-gray-200/60" />
                <div className="h-2.5 w-10 rounded bg-gray-200/60" />
              </div>
            </div>
            {/* Hero text skeleton */}
            <div className="mb-3">
              <div className="h-4 w-3/5 rounded bg-gray-200/70 mb-2" />
              <div className="h-3 w-2/5 rounded bg-gray-200/50" />
            </div>
            {/* Product grid skeleton */}
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3].map(i => (
                <div key={i} className="rounded-lg bg-gray-200/50 aspect-square" />
              ))}
            </div>
          </div>

          {/* Page dim overlay — simulates popup backdrop */}
          <div className="absolute inset-0 bg-black/18" />

          {/* ─── THE POPUP ─────────────────────────────────────────── */}
          <div className="absolute inset-0 flex items-center justify-center p-5">
            <div
              className="popup-float w-full max-w-[270px] overflow-hidden rounded-[22px] bg-white"
              style={{
                boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)",
              }}
            >
              {/* Top image band — lifestyle product photo simulation */}
              <div
                className="relative h-[106px] overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, oklch(30% 0.06 258) 0%, oklch(25% 0.04 258) 100%)",
                }}
              >
                {/* Abstract product shapes */}
                <div className="absolute inset-0 overflow-hidden">
                  {/* Circle — soft glow */}
                  <div
                    className="absolute"
                    style={{
                      width: 160,
                      height: 160,
                      borderRadius: "50%",
                      background: "oklch(56% 0.22 258 / 0.25)",
                      top: -40,
                      right: -20,
                    }}
                  />
                  {/* Product pill shapes */}
                  <div
                    className="absolute"
                    style={{
                      width: 60,
                      height: 72,
                      borderRadius: 14,
                      background: "oklch(72% 0.14 258 / 0.30)",
                      bottom: 12,
                      right: 32,
                      transform: "rotate(-12deg)",
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      width: 44,
                      height: 56,
                      borderRadius: 12,
                      background: "oklch(68% 0.10 258 / 0.22)",
                      bottom: 20,
                      right: 18,
                      transform: "rotate(-5deg)",
                    }}
                  />
                  {/* Discount badge */}
                  <div
                    className="absolute top-3.5 right-3.5 flex items-center justify-center rounded-full"
                    style={{
                      width: 46,
                      height: 46,
                      background: "#165DFF",
                      boxShadow: "0 4px 14px rgba(22,93,255,0.55)",
                    }}
                  >
                    <div className="text-center">
                      <div className="text-[10px] font-black text-white leading-none">15%</div>
                      <div className="text-[7px] font-semibold text-white/80 leading-none mt-0.5">OFF</div>
                    </div>
                  </div>
                </div>

                {/* Brand row */}
                <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-[#165DFF] flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-white/90">UrbanCraft</span>
                </div>
              </div>

              {/* Popup body */}
              <div className="px-4 pt-3.5 pb-4">
                {/* Headline */}
                <h3
                  className="text-[15px] font-extrabold text-gray-950 leading-[1.25] tracking-[-0.02em] mb-1"
                >
                  Get 15% off your first order
                </h3>

                {/* Sub-copy */}
                <p className="text-[11.5px] text-gray-500 leading-relaxed mb-3.5">
                  Join 4,200+ UrbanCraft subscribers for exclusive offers, early drops, and insider deals.
                </p>

                {/* Email field */}
                <div
                  className="flex items-center w-full rounded-xl mb-2.5 overflow-hidden"
                  style={{
                    border: "1.5px solid #e5e7eb",
                    background: "#f9fafb",
                  }}
                >
                  <input
                    readOnly
                    tabIndex={-1}
                    placeholder="your@email.com"
                    className="flex-1 bg-transparent px-3 py-2.5 text-[11.5px] text-gray-400 placeholder:text-gray-400 outline-none cursor-default"
                  />
                </div>

                {/* CTA button */}
                <button
                  tabIndex={-1}
                  className="w-full rounded-xl py-2.5 text-[12px] font-bold text-white text-center cursor-default"
                  style={{
                    background: "#165DFF",
                    boxShadow: "0 4px 16px rgba(22,93,255,0.40)",
                  }}
                >
                  Claim my 15% discount
                </button>

                {/* Trust row */}
                <div className="mt-3 flex items-center justify-between">
                  {/* Subscriber avatars */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                      {[
                        { bg: "#a78bfa", letter: "S" },
                        { bg: "#34d399", letter: "M" },
                        { bg: "#fb923c", letter: "J" },
                      ].map((a) => (
                        <span
                          key={a.letter}
                          className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white text-[8px] font-bold text-white"
                          style={{ background: a.bg }}
                        >
                          {a.letter}
                        </span>
                      ))}
                    </div>
                    <span className="text-[9.5px] text-gray-500 font-medium">142 today</span>
                  </div>

                  {/* No-spam */}
                  <span className="text-[9px] text-gray-400">No spam, ever</span>
                </div>

                {/* Dismiss */}
                <p className="mt-2.5 text-center text-[9.5px] text-gray-400">
                  No thanks, I&apos;ll pay full price
                </p>
              </div>
            </div>
          </div>
          {/* ─── END POPUP ─────────────────────────────────────────── */}
        </div>
      </div>

      {/* ── Floating badge: AI optimized ── */}
      <div
        className="badge-enter absolute -top-3.5 -right-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold text-white"
        style={{
          background: "#0d0d0f",
          boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"
          style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
        />
        AI optimized
      </div>

      {/* ── Floating badge: conversion lift ── */}
      <div
        className="badge-enter-1 absolute -bottom-4 -left-3 rounded-2xl px-4 py-3 z-20"
        style={{
          background: "white",
          boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
            style={{ background: "oklch(96% 0.04 145)" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 12L7 7.5L10 10L13.5 5" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 5h2.5v2.5" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-black text-gray-900 leading-none tabular-nums">+23%</div>
            <div className="text-[9.5px] text-gray-500 font-medium mt-0.5">email capture lift</div>
          </div>
        </div>
      </div>

      {/* ── Floating badge: brand matched ── */}
      <div
        className="badge-enter-2 absolute top-1/2 -right-5 -translate-y-1/2 rounded-xl px-3 py-2"
        style={{
          background: "white",
          boxShadow: "0 4px 18px rgba(0,0,0,0.11), 0 1px 4px rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-2.5 w-2.5 rounded-full bg-[#165DFF] shrink-0" />
          <span className="text-[9px] font-bold text-gray-800 uppercase tracking-[0.08em]">Brand matched</span>
        </div>
        <div className="flex gap-1">
          {["#165DFF", "#1d4ed8", "#0ea5e9"].map((c) => (
            <div key={c} className="h-3 w-3 rounded-full border border-white/50" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
