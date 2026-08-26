import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-adapter";

// Powers NewCampaignForm.tsx's "Scrape my pages" button (page targeting
// section) - lets a merchant pick real pages from their own site instead of
// having to type paths like "/collections/summer" from memory. Dashboard-
// authenticated (not the public /api/analyze flow), so no separate IP rate
// limit - reuses the account's own session the same way other
// /api/campaigns/* routes do.

const MAX_PAGES = 40;
const FETCH_TIMEOUT_MS = 6000;

function isAssetOrNoisePath(pathname: string): boolean {
  if (/\.(jpg|jpeg|png|gif|svg|webp|css|js|mjs|json|xml|pdf|ico|woff2?|ttf|zip|mp4|mp3)$/i.test(pathname)) {
    return true;
  }
  // Cart/checkout/account/admin pages aren't meaningful popup-targeting
  // choices - showing a "10% off your first order" popup on the checkout
  // page a customer is actively paying on, for instance, is never what
  // someone wants when they pick "only show on these pages".
  if (/^\/(cart|checkout|account|admin|wp-admin|wp-json|api)(\/|$)/i.test(pathname)) return true;
  return false;
}

function addPage(set: Set<string>, pathname: string) {
  if (!pathname) return;
  if (isAssetOrNoisePath(pathname)) return;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (clean) set.add(clean);
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let normalized = rawUrl.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }

  let origin: string;
  try {
    origin = new URL(normalized).origin;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const pages = new Set<string>(["/"]);

  // 1. sitemap.xml first - most complete/accurate source when a store has
  // one (virtually every Shopify/WooCommerce/etc. store auto-generates one).
  try {
    const sitemapRes = await fetch(`${origin}/sitemap.xml`, {
      headers: { "User-Agent": "AsmosBot/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (sitemapRes.ok) {
      const xml = await sitemapRes.text();
      // Sitemap indexes point at other sitemaps (sitemap_products_1.xml
      // etc.) rather than pages directly - not worth recursing into for a
      // "pick a few pages to target" picker, so just take whatever <loc>
      // entries are directly in this document.
      const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
      for (const loc of locs) {
        try {
          const u = new URL(loc);
          if (u.origin === origin) addPage(pages, u.pathname);
        } catch {
          // malformed <loc> - skip it
        }
        if (pages.size >= MAX_PAGES) break;
      }
    }
  } catch {
    // No sitemap, or it timed out - fall through to homepage link scraping.
  }

  // 2. Also scrape links off the homepage itself - catches nav links a
  // sitemap might omit, and is the only source at all when there's no
  // sitemap.
  if (pages.size < MAX_PAGES) {
    try {
      const homeRes = await fetch(normalized, {
        headers: { "User-Agent": "AsmosBot/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const html = await homeRes.text();
      const hrefs = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
      for (const href of hrefs) {
        try {
          const u = new URL(href, origin);
          if (u.origin === origin) addPage(pages, u.pathname);
        } catch {
          // relative/malformed href - skip it
        }
        if (pages.size >= MAX_PAGES) break;
      }
    } catch {
      // Homepage fetch failed too - return whatever the sitemap gave us
      // (possibly just "/"), rather than erroring the whole request.
    }
  }

  return NextResponse.json({ pages: Array.from(pages).sort() });
}
