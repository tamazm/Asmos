"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { campaignCreated } from "@/lib/analytics";
import Link from "next/link";

type Phase = "idle" | "analyzing" | "error";
type DiscountPreference = "ai_choice" | "percentage" | "free_shipping" | "fixed_prize";
type PageTargetMode = "all" | "include" | "exclude";

// No platform-wide cap - merchants can set whatever max discount they want.
// This is just a sanity bound on the input itself (mirrors
// MAX_SANE_DISCOUNT_PERCENT in lib/popupGeneration.ts), not a business rule.
const DISCOUNT_PERCENT_INPUT_MAX = 100;
const DEFAULT_MAX_DISCOUNT_PERCENT = 15; // mirrors lib/popupGeneration.ts's default

export function NewCampaignForm({ defaultUrl }: { defaultUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl);
  const [campaignName, setCampaignName] = useState("");
  const [goal, setGoal] = useState<"EMAIL" | "DISCOUNT" | "BOTH">("BOTH");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  // Personalization (optional - everything defaults to "let the AI decide" /
  // "show everywhere" so skipping this section doesn't slow anyone down).
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [discountPreference, setDiscountPreference] = useState<DiscountPreference>("ai_choice");
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(DEFAULT_MAX_DISCOUNT_PERCENT);
  const [fixedPrizeDescription, setFixedPrizeDescription] = useState("");
  // Optional quantity caps - left blank/0 means "unlimited" for free
  // shipping, or the platform default (see DEFAULT_GIFT_REDEMPTIONS in
  // lib/limits.ts) for a fixed prize, since a physical/limited-inventory
  // reward should never silently default to unlimited.
  const [freeShippingLimit, setFreeShippingLimit] = useState("");
  const [fixedPrizeLimit, setFixedPrizeLimit] = useState("");
  const [pageTargetMode, setPageTargetMode] = useState<PageTargetMode>("all");
  const [pageTargetPatterns, setPageTargetPatterns] = useState("");
  const [scrapedPages, setScrapedPages] = useState<string[] | null>(null);
  const [scrapingPages, setScrapingPages] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const selectedPatterns = pageTargetPatterns
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  function togglePagePattern(path: string) {
    setPageTargetPatterns((prev) => {
      const list = prev.split(",").map((p) => p.trim()).filter(Boolean);
      const next = list.includes(path) ? list.filter((p) => p !== path) : [...list, path];
      return next.join(", ");
    });
  }

  async function scrapePages() {
    if (!url.trim()) {
      setScrapeError("Enter your store URL first.");
      return;
    }
    setScrapingPages(true);
    setScrapeError(null);
    try {
      const res = await fetch(`/api/campaigns/scrape-pages?url=${encodeURIComponent(url.trim())}`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not scan your site for pages.");
      }
      const data = await res.json();
      setScrapedPages(Array.isArray(data.pages) ? data.pages : []);
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Could not scan your site for pages.");
    } finally {
      setScrapingPages(false);
    }
  }

  async function launch() {
    const raw = url.trim();
    if (!raw) return;
    let normalized = raw;
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }

    setError(null);
    setPhase("analyzing");

    try {
      // Step 1: Analyze the store URL
      const resAnalyze = await fetch(`/api/analyze?url=${encodeURIComponent(normalized)}`);
      if (!resAnalyze.ok) {
        throw new Error("Could not analyze store. Please check the URL and try again.");
      }
      const result = await resAnalyze.json();

      const name = campaignName.trim() || `${result.storeName ?? "My Store"}: Email Capture`;

      // Personalization inputs (see the "Personalize your popup" section
      // below) - undefined/omitted when left at their defaults, so
      // generateCampaign.ts's "ai_choice"/"show everywhere" defaults apply
      // exactly as before for anyone who didn't open that section.
      const pageTargeting =
        pageTargetMode === "all"
          ? undefined
          : {
              mode: pageTargetMode,
              patterns: pageTargetPatterns
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean),
            };

      // Step 2: Create the campaign immediately with GENERATING status
      const resCreate = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          status: "GENERATING",
          generationContext: {
            ...result,
            goal,
            discountPreference,
            maxDiscountPercent:
              discountPreference === "percentage"
                ? Math.min(Math.max(1, maxDiscountPercent), DISCOUNT_PERCENT_INPUT_MAX)
                : undefined,
            fixedPrizeDescription:
              discountPreference === "fixed_prize" ? fixedPrizeDescription.trim() : undefined,
            freeShippingLimit:
              discountPreference === "free_shipping" && freeShippingLimit.trim()
                ? Math.max(1, Math.floor(Number(freeShippingLimit)))
                : undefined,
            fixedPrizeLimit:
              discountPreference === "fixed_prize" && fixedPrizeLimit.trim()
                ? Math.max(1, Math.floor(Number(fixedPrizeLimit)))
                : undefined,
            pageTargeting,
          },
        }),
      });

      if (!resCreate.ok) {
        const body = await resCreate.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create campaign");
      }

      const created = await resCreate.json();
      campaignCreated({
        campaignId: created.campaign?.id ?? "unknown",
        campaignType: "FORM",
        name,
      });

      // Redirect directly to the campaign page. The background task will finish generation there.
      router.push(`/campaigns/${created.campaign?.id ?? ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push("/campaigns")}
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm text-[color:var(--color-text-secondary)]">Pop-ups</span>
        </div>
        <h1 className="text-2xl font-bold text-[color:var(--color-text-primary)]">Launch a popup</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Enter your store URL. Asmos AI scans your brand and designs a popup in seconds.
        </p>
      </div>

      {/* Main card */}
      <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
        <div className="rounded-[1rem] bg-[color:var(--color-surface)] p-6 flex flex-col gap-6">

          {/* ── IDLE / URL input phase ── */}
          {phase === "idle" && (
            <>
              <div className="flex flex-col gap-3">
                <div>
                  <label htmlFor="store-url" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                    Store URL
                  </label>
                  <input
                    id="store-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && url.trim() && launch()}
                    placeholder="yourstore.com"
                    autoFocus
                    className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                  />
                </div>
                <div>
                  <label htmlFor="campaign-name" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                    Campaign name <span className="font-normal text-[color:var(--color-text-secondary)]">(optional - auto-filled from store)</span>
                  </label>
                  <input
                    id="campaign-name"
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Summer Email Capture"
                    className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                  />
                </div>
                
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                    Popup Goal
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* BOTH: Capture & Offer */}
                    <label className={`group relative cursor-pointer rounded-lg border p-3 flex flex-col items-center text-center transition-colors ${goal === "BOTH" ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/5" : "border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/50"}`}>
                      <input type="radio" name="goal" value="BOTH" checked={goal === "BOTH"} onChange={() => setGoal("BOTH")} className="sr-only" />
                      <span className="text-sm font-medium text-[color:var(--color-text-primary)] mb-1">Capture & Offer</span>
                      <span className="text-xs text-[color:var(--color-text-secondary)]">Collect email to reveal code</span>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-gray-900 text-white p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl pointer-events-none">
                        <div className="text-xs text-left space-y-2">
                          <p className="font-bold text-indigo-300">The balanced approach</p>
                          <p><span className="text-green-400 font-bold">Pro:</span> Highly effective. Email-gated discounts convert up to <span className="font-bold">41% higher</span> than standard popups.</p>
                          <p><span className="text-red-400 font-bold">Con:</span> Requires 2 steps (email, then code), adding slight friction.</p>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </label>

                    {/* EMAIL: Email Only */}
                    <label className={`group relative cursor-pointer rounded-lg border p-3 flex flex-col items-center text-center transition-colors ${goal === "EMAIL" ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/5" : "border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/50"}`}>
                      <input type="radio" name="goal" value="EMAIL" checked={goal === "EMAIL"} onChange={() => setGoal("EMAIL")} className="sr-only" />
                      <span className="text-sm font-medium text-[color:var(--color-text-primary)] mb-1">Email Only</span>
                      <span className="text-xs text-[color:var(--color-text-secondary)]">Newsletter signup focus</span>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-gray-900 text-white p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl pointer-events-none">
                        <div className="text-xs text-left space-y-2">
                          <p className="font-bold text-indigo-300">List building focus</p>
                          <p><span className="text-green-400 font-bold">Pro:</span> Higher long-term subscriber quality (avg <span className="font-bold">3-5%</span> conversion).</p>
                          <p><span className="text-red-400 font-bold">Con:</span> Lower raw volume compared to discounting. No immediate sales incentive.</p>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </label>

                    {/* DISCOUNT: Discount Only */}
                    <label className={`group relative cursor-pointer rounded-lg border p-3 flex flex-col items-center text-center transition-colors ${goal === "DISCOUNT" ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/5" : "border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/50"}`}>
                      <input type="radio" name="goal" value="DISCOUNT" checked={goal === "DISCOUNT"} onChange={() => setGoal("DISCOUNT")} className="sr-only" />
                      <span className="text-sm font-medium text-[color:var(--color-text-primary)] mb-1">Discount Only</span>
                      <span className="text-xs text-[color:var(--color-text-secondary)]">Give code immediately</span>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl bg-gray-900 text-white p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl pointer-events-none">
                        <div className="text-xs text-left space-y-2">
                          <p className="font-bold text-indigo-300">Maximize immediate sales</p>
                          <p><span className="text-green-400 font-bold">Pro:</span> Massive immediate conversion rates (<span className="font-bold">8-15%</span>) for purchases.</p>
                          <p><span className="text-red-400 font-bold">Con:</span> <span className="font-bold">0%</span> email capture rate. Misses out on future marketing reach.</p>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Personalize your popup (optional) - discount type/cap + page targeting */}
              <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                <button
                  type="button"
                  onClick={() => setShowPersonalize((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[color:var(--color-text-primary)]"
                >
                  <span>Personalize your popup <span className="font-normal text-[color:var(--color-text-secondary)]">(optional)</span></span>
                  <svg
                    width="14" height="14" viewBox="0 0 14 14" fill="none"
                    className={`transition-transform ${showPersonalize ? "rotate-180" : ""}`}
                  >
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {showPersonalize && (
                  <div className="flex flex-col gap-5 px-4 pb-4 pt-1 border-t border-[color:var(--color-border)]">
                    {/* Discount / offer type */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                        What&apos;s the offer?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: "ai_choice", label: "Let AI decide" },
                          { value: "percentage", label: "Percentage off" },
                          { value: "free_shipping", label: "Free shipping" },
                          { value: "fixed_prize", label: "Fixed prize / gift" },
                        ] as const).map((opt) => (
                          <label
                            key={opt.value}
                            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm text-center transition-colors ${discountPreference === opt.value ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/5 text-[color:var(--color-text-primary)]" : "border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)]/50"}`}
                          >
                            <input
                              type="radio"
                              name="discountPreference"
                              value={opt.value}
                              checked={discountPreference === opt.value}
                              onChange={() => setDiscountPreference(opt.value)}
                              className="sr-only"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>

                      {discountPreference === "percentage" && (
                        <div className="mt-2 flex items-center gap-2">
                          <label htmlFor="max-discount" className="text-sm text-[color:var(--color-text-secondary)]">
                            Max discount:
                          </label>
                          <input
                            id="max-discount"
                            type="number"
                            min={1}
                            max={DISCOUNT_PERCENT_INPUT_MAX}
                            value={maxDiscountPercent}
                            onChange={(e) =>
                              setMaxDiscountPercent(
                                Math.max(1, Math.min(DISCOUNT_PERCENT_INPUT_MAX, Number(e.target.value) || 1)),
                              )
                            }
                            className="w-20 rounded-lg border border-[color:var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[color:var(--color-primary)]"
                          />
                          <span className="text-sm text-[color:var(--color-text-secondary)]">
                            % - the AI will never suggest more than this
                          </span>
                        </div>
                      )}

                      {discountPreference === "free_shipping" && (
                        <div className="mt-2 flex items-center gap-2">
                          <label htmlFor="free-shipping-limit" className="text-sm text-[color:var(--color-text-secondary)]">
                            Limit to:
                          </label>
                          <input
                            id="free-shipping-limit"
                            type="number"
                            min={1}
                            value={freeShippingLimit}
                            onChange={(e) => setFreeShippingLimit(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Unlimited"
                            className="w-28 rounded-lg border border-[color:var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[color:var(--color-primary)]"
                          />
                          <span className="text-sm text-[color:var(--color-text-secondary)]">
                            redemptions (blank = unlimited)
                          </span>
                        </div>
                      )}

                      {discountPreference === "fixed_prize" && (
                        <div className="mt-2 flex flex-col gap-2">
                          <input
                            type="text"
                            value={fixedPrizeDescription}
                            onChange={(e) => setFixedPrizeDescription(e.target.value)}
                            placeholder="e.g. Free tote bag with any order over $50"
                            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
                          />
                          <div className="flex items-center gap-2">
                            <label htmlFor="fixed-prize-limit" className="text-sm text-[color:var(--color-text-secondary)]">
                              Limit to:
                            </label>
                            <input
                              id="fixed-prize-limit"
                              type="number"
                              min={1}
                              value={fixedPrizeLimit}
                              onChange={(e) => setFixedPrizeLimit(e.target.value.replace(/[^0-9]/g, ""))}
                              placeholder="40"
                              className="w-28 rounded-lg border border-[color:var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[color:var(--color-primary)]"
                            />
                            <span className="text-sm text-[color:var(--color-text-secondary)]">
                              redemptions (defaults to 40 - prizes are finite)
                            </span>
                          </div>
                        </div>
                      )}

                      <p className="mt-2 text-xs text-[color:var(--color-text-secondary)]">
                        A popup never shows if its campaign has no reward left to give - Asmos
                        automatically stocks a starting batch of codes/redemptions when you launch, and
                        you can top these up any time from the Rewards page.
                      </p>
                    </div>

                    {/* Page targeting */}
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                        Where should this show?
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: "all", label: "Everywhere" },
                          { value: "include", label: "Only these pages" },
                          { value: "exclude", label: "Everywhere except" },
                        ] as const).map((opt) => (
                          <label
                            key={opt.value}
                            className={`cursor-pointer rounded-lg border px-3 py-2 text-sm text-center transition-colors ${pageTargetMode === opt.value ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/5 text-[color:var(--color-text-primary)]" : "border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)]/50"}`}
                          >
                            <input
                              type="radio"
                              name="pageTargetMode"
                              value={opt.value}
                              checked={pageTargetMode === opt.value}
                              onChange={() => setPageTargetMode(opt.value)}
                              className="sr-only"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>

                      {pageTargetMode !== "all" && (
                        <div className="mt-2 flex flex-col gap-2">
                          <input
                            type="text"
                            value={pageTargetPatterns}
                            onChange={(e) => setPageTargetPatterns(e.target.value)}
                            placeholder="e.g. /, /product/*  (comma-separated)"
                            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
                          />

                          <button
                            type="button"
                            onClick={scrapePages}
                            disabled={scrapingPages}
                            className="self-start text-xs font-medium text-[color:var(--color-primary)] hover:underline disabled:opacity-50"
                          >
                            {scrapingPages
                              ? "Scanning your site…"
                              : scrapedPages
                              ? "Rescan my pages"
                              : "Scrape my pages to choose interactively"}
                          </button>
                          {scrapeError && <p className="text-xs text-red-600">{scrapeError}</p>}

                          {scrapedPages && (
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-[color:var(--color-border)] p-2">
                              {scrapedPages.length === 0 ? (
                                <p className="p-2 text-xs text-[color:var(--color-text-secondary)]">
                                  Couldn&apos;t find any pages automatically - enter paths manually above.
                                </p>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {scrapedPages.map((path) => (
                                    <label
                                      key={path}
                                      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedPatterns.includes(path)}
                                        onChange={() => togglePagePattern(path)}
                                        className="rounded border-[color:var(--color-border)]"
                                      />
                                      <span className="font-mono text-xs">{path}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* What AI does */}
              <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3 flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-text-secondary)]">What Asmos AI does automatically</p>
                {[
                  "Scans your homepage for brand colors, typography, and style",
                  "Detects any existing popups and improves them - or creates from scratch",
                  "Writes personalized headline, subhead and CTA for your store category",
                  "Generates a self-contained popup - live in one click",
                  "Auto-tests variants continuously - no manual A/B setup needed",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <svg className="mt-0.5 shrink-0 text-emerald-500" width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-xs text-[color:var(--color-text-secondary)]">{item}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={launch}
                disabled={!url.trim()}
                className="w-full rounded-lg bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Design my popup →
              </button>

              {/* Manual escape hatch */}
              <div className="text-center">
                <button
                  onClick={() => setShowManual(true)}
                  className="text-xs text-[color:var(--color-text-secondary)] underline underline-offset-2 hover:text-[color:var(--color-text-primary)] transition-colors"
                >
                  Prefer to set it up manually?
                </button>
              </div>

              {showManual && (
                <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3 text-center">
                  <p className="text-sm text-[color:var(--color-text-secondary)] mb-2">
                    The manual campaign wizard gives you full control over type, design, targeting, and rewards.
                  </p>
                  <Link
                    href="/campaigns/new/manual"
                    className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-primary)] font-medium hover:underline"
                  >
                    Open manual wizard →
                  </Link>
                </div>
              )}
            </>
          )}

          {/* ── WORKING phase ── */}
          {phase === "analyzing" && (
            <div className="flex flex-col items-center gap-8 py-4">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inline-block h-20 w-20 rounded-full border-2 border-[color:var(--color-primary)] opacity-20 animate-ping" />
                <span className="absolute inline-block h-14 w-14 rounded-full border border-[color:var(--color-primary)]/30" />
                <span className="inline-block h-6 w-6 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent animate-spin" />
              </div>
              <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
                Initializing campaign...
              </p>
            </div>
          )}

          {/* ── ERROR phase ── */}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-red-500">
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[color:var(--color-text-primary)]">Something went wrong</p>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{error}</p>
              </div>
              <button
                onClick={reset}
                className="rounded-lg bg-[color:var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors"
              >
                Try again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
