import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let fetchedHtml = "";
  let storeName = "";
  let description = "";
  let logoUrl = "";
  let brandColor = "#165DFF";

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AsmosBot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    fetchedHtml = await res.text();
  } catch {
    // Fallback to domain name extraction
  }

  // Extract store name from title or og:title
  const titleMatch =
    fetchedHtml.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    fetchedHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    fetchedHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (titleMatch) {
    storeName = titleMatch[1].replace(/\s*[-|].*$/, "").trim();
  }

  // Fallback to domain
  if (!storeName) {
    try {
      const parsedUrl = new URL(url);
      storeName = parsedUrl.hostname
        .replace(/^www\./, "")
        .replace(/\.[^.]+$/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      storeName = "Your Store";
    }
  }

  // Extract meta description
  const descMatch =
    fetchedHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    fetchedHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
    fetchedHtml.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (descMatch) {
    description = descMatch[1].slice(0, 160).trim();
  }

  // Extract og:image
  const ogImageMatch =
    fetchedHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    fetchedHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogImageMatch) {
    logoUrl = ogImageMatch[1];
  }

  // Extract theme color
  const themeColorMatch =
    fetchedHtml.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,6})["']/i) ||
    fetchedHtml.match(/<meta[^>]+content=["'](#[0-9a-fA-F]{3,6})["'][^>]+name=["']theme-color["']/i);
  if (themeColorMatch) {
    brandColor = themeColorMatch[1];
  }

  // Detect industry from content signals
  const lowerHtml = fetchedHtml.toLowerCase();
  let industry = "Ecommerce / Retail";

  if (
    lowerHtml.includes("saas") ||
    lowerHtml.includes("software") ||
    lowerHtml.includes("dashboard") ||
    lowerHtml.includes("subscription")
  ) {
    industry = "SaaS / Software";
  } else if (
    lowerHtml.includes("health") ||
    lowerHtml.includes("wellness") ||
    lowerHtml.includes("fitness") ||
    lowerHtml.includes("supplement")
  ) {
    industry = "Health & Wellness";
  } else if (
    lowerHtml.includes("food") ||
    lowerHtml.includes("restaurant") ||
    lowerHtml.includes("beverage") ||
    lowerHtml.includes("coffee")
  ) {
    industry = "Food & Beverage";
  } else if (
    lowerHtml.includes("education") ||
    lowerHtml.includes("course") ||
    lowerHtml.includes("learning") ||
    lowerHtml.includes("school")
  ) {
    industry = "Education";
  } else if (
    lowerHtml.includes("add to cart") ||
    lowerHtml.includes("buy now") ||
    lowerHtml.includes("shop now") ||
    lowerHtml.includes("shopify") ||
    lowerHtml.includes("checkout")
  ) {
    industry = "Ecommerce / Retail";
  }

  return NextResponse.json({
    storeName,
    industry,
    brandColor,
    description,
    logoUrl,
  });
}
