"use client";

/**
 * PopupPreview — an illustrative popup mockup for the landing page hero.
 * Pure CSS/SVG, no external images. Represents what Asmos generates for a store.
 */
export function PopupPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-[320px] mx-auto select-none"
    >
      {/* Browser chrome */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-xl overflow-hidden">
        {/* Browser bar */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          <div className="ml-2 flex-1 rounded-md bg-[color:var(--color-border)] h-4 flex items-center px-2">
            <span className="text-[9px] text-[color:var(--color-text-secondary)] truncate">yourstore.com</span>
          </div>
        </div>
        {/* Store background simulation */}
        <div className="relative bg-[#f8f9fb] min-h-[220px] p-4 flex items-end justify-center">
          {/* Skeleton store content */}
          <div className="absolute inset-4 flex flex-col gap-2 opacity-30">
            <div className="h-4 w-3/4 rounded bg-gray-300" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-20 rounded-lg bg-gray-200" />
              <div className="h-20 rounded-lg bg-gray-200" />
            </div>
          </div>
          {/* The popup */}
          <div
            className="relative z-10 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-lg overflow-hidden"
            style={{ boxShadow: "0 8px 32px rgba(22,93,255,0.12), 0 2px 8px rgba(0,0,0,0.08)" }}
          >
            {/* Popup header strip — brand blue */}
            <div
              className="px-4 py-3 text-white"
              style={{ background: "linear-gradient(135deg, #165DFF 0%, #2B6FFF 100%)" }}
            >
              <p className="text-[11px] font-semibold tracking-wide uppercase opacity-80">Limited offer</p>
              <p className="text-[15px] font-bold leading-tight mt-0.5">Get 15% off your first order</p>
            </div>
            {/* Popup body */}
            <div className="px-4 pt-3 pb-4">
              <p className="text-[11px] text-[color:var(--color-text-secondary)] mb-3">
                Drop your email and we'll send the code instantly.
              </p>
              {/* Email input mock */}
              <div className="flex gap-1.5">
                <div className="flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] h-7 px-2 flex items-center">
                  <span className="text-[10px] text-[color:var(--color-text-secondary)]">you@email.com</span>
                </div>
                <div
                  className="rounded-md px-2.5 h-7 flex items-center text-white text-[10px] font-semibold shrink-0"
                  style={{ background: "#165DFF" }}
                >
                  Claim
                </div>
              </div>
              {/* Social proof inside popup */}
              <div className="mt-2.5 flex items-center gap-1.5">
                <div className="flex -space-x-1">
                  {["#6366f1", "#10b981", "#f59e0b"].map((c, i) => (
                    <span
                      key={i}
                      className="inline-block h-4 w-4 rounded-full border border-white"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span className="text-[9px] text-[color:var(--color-text-secondary)]">
                  142 claimed today
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating "AI optimized" badge */}
      <div
        className="absolute -top-3 -right-3 z-20 flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-1.5 shadow-md"
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] shrink-0"
          style={{ boxShadow: "0 0 0 3px #dcfce7" }}
        />
        <span className="text-[10px] font-semibold text-[color:var(--color-text-primary)] whitespace-nowrap">
          AI optimized
        </span>
      </div>

      {/* Conversion lift banner badge — prominent, high z-index */}
      <div
        className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl whitespace-nowrap"
        style={{
          background: "linear-gradient(135deg, #165DFF 0%, #2B6FFF 100%)",
          boxShadow: "0 8px 24px rgba(22,93,255,0.35), 0 2px 6px rgba(22,93,255,0.2)",
        }}
      >
        <span className="text-2xl font-extrabold text-white tabular-nums tracking-tight leading-none">+23%</span>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-semibold text-white">conversion lift</span>
          <span className="text-[10px] text-white/70">avg. first 30 days</span>
        </div>
        {/* Arrow up icon */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
          <path d="M9 14V4M9 4L5 8M9 4l4 4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
