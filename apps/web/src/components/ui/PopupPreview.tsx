"use client";

/**
 * PopupPreview — illustrative popup mockup for the landing page hero.
 * Floats gently with a CSS animation. No external images.
 */
export function PopupPreview() {
  return (
    <div
      aria-hidden="true"
      className="popup-float relative w-full max-w-[300px] mx-auto select-none"
    >
      {/* Ambient glow behind the card */}
      <div
        className="pointer-events-none absolute inset-[-20%] rounded-full"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, oklch(48% 0.255 258 / 0.22) 0%, transparent 65%)",
          filter: "blur(24px)",
          zIndex: 0,
        }}
      />

      {/* Browser chrome wrapper */}
      <div
        className="relative z-10 rounded-2xl overflow-hidden"
        style={{
          border: "1px solid oklch(28% 0.04 258)",
          background: "oklch(18% 0.032 258)",
          boxShadow: [
            "0 32px 64px -12px rgba(0,0,0,0.6)",
            "0 0 0 1px oklch(28% 0.04 258)",
            "inset 0 1px 0 oklch(35% 0.04 258)",
          ].join(", "),
        }}
      >
        {/* Browser bar */}
        <div
          className="flex items-center gap-1.5 px-3 py-2.5 border-b"
          style={{ borderColor: "oklch(28% 0.04 258)", background: "oklch(15% 0.03 258)" }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          <div className="ml-2 flex-1 rounded-md h-4 flex items-center px-2"
            style={{ background: "oklch(22% 0.035 258)" }}>
            <span className="text-[9px] truncate" style={{ color: "oklch(55% 0.02 258)" }}>yourstore.com</span>
          </div>
        </div>

        {/* Simulated store page */}
        <div className="relative min-h-[200px] p-4 flex items-end justify-center"
          style={{ background: "oklch(17% 0.03 258)" }}>
          {/* Skeleton store content */}
          <div className="absolute inset-4 flex flex-col gap-2 opacity-20">
            <div className="h-3 w-3/4 rounded" style={{ background: "oklch(35% 0.04 258)" }} />
            <div className="h-2.5 w-1/2 rounded" style={{ background: "oklch(28% 0.03 258)" }} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-16 rounded-lg" style={{ background: "oklch(22% 0.03 258)" }} />
              <div className="h-16 rounded-lg" style={{ background: "oklch(22% 0.03 258)" }} />
            </div>
          </div>

          {/* The popup */}
          <div
            className="relative z-10 w-full rounded-xl overflow-hidden"
            style={{
              background: "oklch(99% 0.003 255)",
              border: "1px solid oklch(88% 0.01 255)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            {/* Header strip */}
            <div
              className="px-4 py-3 text-white"
              style={{ background: "linear-gradient(135deg, oklch(48% 0.255 258) 0%, oklch(52% 0.24 258) 100%)" }}
            >
              <p className="text-[10px] font-semibold tracking-widest uppercase opacity-70">Limited offer</p>
              <p className="text-[15px] font-bold leading-tight mt-0.5">Get 15% off your first order</p>
            </div>
            {/* Body */}
            <div className="px-4 pt-3 pb-3.5">
              <p className="text-[10px] mb-2.5" style={{ color: "oklch(55% 0.018 255)" }}>
                Drop your email and we&apos;ll send the code instantly.
              </p>
              {/* Input row */}
              <div className="flex gap-1.5">
                <div className="flex-1 rounded-md border h-7 px-2 flex items-center"
                  style={{ borderColor: "oklch(88% 0.01 255)", background: "oklch(97% 0.004 255)" }}>
                  <span className="text-[10px]" style={{ color: "oklch(65% 0.015 255)" }}>you@email.com</span>
                </div>
                <div className="rounded-md px-2.5 h-7 flex items-center text-white text-[10px] font-semibold shrink-0"
                  style={{ background: "oklch(48% 0.255 258)" }}>
                  Claim
                </div>
              </div>
              {/* Social proof */}
              <div className="mt-2 flex items-center gap-1.5">
                <div className="flex -space-x-1">
                  {["#6366f1", "#10b981", "#f59e0b"].map((c, i) => (
                    <span key={i} className="inline-block h-3.5 w-3.5 rounded-full border border-white"
                      style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[9px]" style={{ color: "oklch(60% 0.015 255)" }}>142 claimed today</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI optimized badge — top right */}
      <div
        className="absolute -top-3 -right-4 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold text-white whitespace-nowrap"
        style={{
          background: "oklch(22% 0.04 258)",
          border: "1px solid oklch(32% 0.06 258)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] shrink-0"
          style={{ boxShadow: "0 0 0 3px oklch(35% 0.12 150 / 0.4)" }} />
        AI optimized
      </div>

      {/* Conversion lift badge — bottom, prominent */}
      <div
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-2xl px-4 py-2.5 whitespace-nowrap"
        style={{
          background: "linear-gradient(135deg, oklch(48% 0.255 258) 0%, oklch(52% 0.24 258) 100%)",
          boxShadow: "0 8px 28px oklch(48% 0.255 258 / 0.5), 0 2px 6px rgba(0,0,0,0.3)",
          border: "1px solid oklch(58% 0.22 258 / 0.4)",
        }}
      >
        <span className="text-[1.75rem] font-extrabold text-white tabular-nums tracking-tight leading-none">+23%</span>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-semibold text-white">conversion lift</span>
          <span className="text-[10px]" style={{ color: "oklch(82% 0.08 258)" }}>avg. first 30 days</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M8 13V3M8 3L4 7M8 3l4 4" stroke="rgba(255,255,255,0.85)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
