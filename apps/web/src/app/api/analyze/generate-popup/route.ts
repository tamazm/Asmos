/**
 * POST /api/analyze/generate-popup
 *
 * Pre-signup surface: generates a real AI-designed branded popup for the
 * /analyze/results page teaser. Called with the full analysis result from
 * sessionStorage so no database access is needed.
 *
 * Rate-limited to 5 requests per IP per minute to prevent abuse.
 * Returns only the baseline (no variants yet — those come after signup via cron).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generatePopupWithVariants,
  buildPopupInput,
  brandTokensFromAnalyzeResult,
  computedStylesFromAnalyzeResult,
  existingPopupFromAnalyzeResult,
  type BrandTokens,
  type ExistingPopupExtracted,
  type ComputedStyles,
} from "@/lib/popupGeneration";

// ─── Simple in-memory cache (per domain, 1h TTL) ──────────────────────────────
type CacheEntry = { result: unknown; expiresAt: number };
const popupCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60_000; // 1 hour

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit by IP using Database to prevent Serverless cold-start bypass
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (ip !== "unknown") {
    const rateLimit = await prisma.rateLimit.upsert({
      where: { ip },
      update: {},
      create: { ip, resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    });

    if (rateLimit.resetAt < new Date()) {
      await prisma.rateLimit.update({
        where: { id: rateLimit.id },
        data: { count: 1, resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
      });
    } else if (rateLimit.count >= 15) { // Allow up to 15 generations per day per IP pre-signup
      return NextResponse.json({ error: "Rate limit exceeded. Please try again tomorrow." }, { status: 429 });
    } else {
      await prisma.rateLimit.update({
        where: { id: rateLimit.id },
        data: { count: { increment: 1 } }
      });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storeUrl = typeof body.storeUrl === "string" ? body.storeUrl.trim() : "";
  if (!storeUrl) {
    return NextResponse.json({ error: "storeUrl is required" }, { status: 400 });
  }

  // Derive cache key from domain
  let domain = storeUrl;
  try {
    domain = new URL(storeUrl).hostname.replace(/^www\./, "");
  } catch { /* use raw storeUrl */ }

  // Cache hit
  const cached = popupCache.get(domain);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.result);
  }

  // Assemble brand tokens from the analysis result
  const brandTokens: BrandTokens = brandTokensFromAnalyzeResult({
    brandColor: typeof body.brandColor === "string" ? body.brandColor : undefined,
    brandTokens: body.brandTokens as BrandTokens | undefined,
    computedStyles: body.computedStyles as ComputedStyles | undefined,
    storeName: typeof body.storeName === "string" ? body.storeName : undefined,
    industry: typeof body.industry === "string" ? body.industry : undefined,
  });

  const computedStyles = computedStylesFromAnalyzeResult({
    computedStyles: body.computedStyles as ComputedStyles | undefined,
    brandColor: typeof body.brandColor === "string" ? body.brandColor : undefined,
  });

  const existingPopup: ExistingPopupExtracted = existingPopupFromAnalyzeResult({
    existingPopup: body.existingPopup as ExistingPopupExtracted | undefined,
    popup: body.popup as { found: boolean; description: string } | undefined,
  });

  const category = typeof body.industry === "string" ? body.industry : "Ecommerce / Retail";

  const input = buildPopupInput({
    domain,
    category,
    brandTokens,
    existingPopup,
    computedStyles,
    analyticsVariants: [], // cold start — no PostHog data yet (pre-signup)
    variantCount: 0,       // baseline only for the teaser
    multivariate: false,
  });

  try {
    const output = await generatePopupWithVariants(input);

    // Only return the baseline for the pre-signup teaser
    const result = {
      mode: output.mode,
      baseline: output.baseline,
      tracking_events: output.tracking_events,
    };

    // Cache for 1 hour
    popupCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[analyze/generate-popup] Generation failed:", err);
    // Return a minimal fallback so the results page still works
    return NextResponse.json(
      { error: "Popup generation failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
