import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// ---------------------------------------------------------------------------
// POST  /api/analyze
// GET   /api/analyze?url=...
//
// Flow:
//  1. Browserless → real browser screenshot (JPEG, base64)
//  2. Bedrock Claude Haiku → CRO analysis via vision  (primary)
//  3. Fallback: Anthropic API direct (if ANTHROPIC_API_KEY set)
//  4. Fallback: Gemini Flash (if GEMINI_API_KEY set)
//  5. Last resort: HTML heuristic analysis (no screenshot/AI)
// ---------------------------------------------------------------------------

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN ?? "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const AWS_REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-central-1";

// Bedrock model — Claude Haiku 4.5 via cross-region inference profile
const BEDROCK_MODEL = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

const BROWSERLESS_URL = `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_TOKEN}`;

// ---------------------------------------------------------------------------
// HTML entity decoder
// ---------------------------------------------------------------------------
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/[\u00AE\u2122]/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
interface CheckItem {
  found: boolean;
  description: string;
}

interface CROResult {
  popup: CheckItem;
  emailCapture: CheckItem;
  socialProof: CheckItem;
  urgency: CheckItem;
  exitIntent: CheckItem;
  stickyBar: CheckItem;
  liveChat: CheckItem;
  overallScore: number;
  grade: string;
  gradeLabel: string;
  topIssue: string;
  verdict: string;
  storeName: string;
  industry: string;
}

// ---------------------------------------------------------------------------
// CRO analysis prompt (shared across all AI providers)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a senior conversion rate optimization (CRO) expert and direct-response marketer with 15 years of experience auditing ecommerce websites. You look at websites like a hawk — you notice every popup, every sticky bar, every trust badge, every countdown timer.

Analyze the provided website screenshot and return ONLY valid JSON (no markdown, no explanation, no code fences) with this exact shape:

{
  "popup": { "found": true, "description": "describe what you see" },
  "emailCapture": { "found": false, "description": "None detected" },
  "socialProof": { "found": true, "description": "describe what you see" },
  "urgency": { "found": false, "description": "None detected" },
  "exitIntent": { "found": false, "description": "None detected" },
  "stickyBar": { "found": true, "description": "describe what you see" },
  "liveChat": { "found": false, "description": "None detected" },
  "overallScore": 55,
  "grade": "C",
  "gradeLabel": "Average",
  "topIssue": "No email capture — visitors leave with no way to re-engage",
  "verdict": "Decent social proof but hemorrhaging leads with no popup or email capture.",
  "storeName": "Brand Name",
  "industry": "Ecommerce / Retail"
}

Scoring (points per found element): popup=20, emailCapture=15, socialProof=20, urgency=15, exitIntent=10, stickyBar=10, liveChat=10.
Grade scale: 90+=A+, 85+=A, 80+=A-, 77+=B+, 73+=B, 70+=B-, 67+=C+, 63+=C, 60+=C-, 57+=D+, 53+=D, 50+=D-, <50=F.
Be blunt and specific. If you see a Klaviyo/Privy/Omnisend popup, name it. If you see star ratings, name them.`;

// ---------------------------------------------------------------------------
// Screenshot via Browserless
// ---------------------------------------------------------------------------
async function takeScreenshot(url: string): Promise<string | null> {
  if (!BROWSERLESS_TOKEN) {
    console.log("[analyze] No BROWSERLESS_TOKEN set, skipping screenshot");
    return null;
  }

  try {
    const res = await fetch(BROWSERLESS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        options: {
          fullPage: false,
          type: "jpeg",
          quality: 75,
        },
        waitForTimeout: 4000,
        gotoOptions: { waitUntil: "networkidle2", timeout: 15000 },
        viewport: { width: 1280, height: 900 },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[analyze] Browserless error:", res.status, body.slice(0, 200));
      return null;
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) {
      console.error("[analyze] Browserless returned suspiciously small response:", buf.byteLength, "bytes");
      return null;
    }

    console.log("[analyze] Screenshot taken:", buf.byteLength, "bytes");
    return Buffer.from(buf).toString("base64");
  } catch (e) {
    console.error("[analyze] Browserless fetch failed:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI analysis — Bedrock (primary)
// ---------------------------------------------------------------------------
async function analyzeWithBedrock(base64Jpeg: string): Promise<CROResult | null> {
  try {
    const client = new BedrockRuntimeClient({ region: AWS_REGION });

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Jpeg,
              },
            },
            {
              type: "text",
              text: "Analyze this website screenshot. Return only JSON with no markdown fences.",
            },
          ],
        },
      ],
    });

    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL,
      body: new TextEncoder().encode(body),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text: string = responseBody.content?.[0]?.text ?? "";
    console.log("[analyze] Bedrock raw response:", text.slice(0, 200));
    return parseJSON(text);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[analyze] Bedrock failed:", msg);
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI analysis — Anthropic API direct (fallback 1)
// ---------------------------------------------------------------------------
async function analyzeWithAnthropic(base64Jpeg: string): Promise<CROResult | null> {
  if (!ANTHROPIC_KEY) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg },
              },
              {
                type: "text",
                text: "Analyze this website screenshot. Return only JSON with no markdown fences.",
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error("[analyze] Anthropic API error:", res.status);
      return null;
    }

    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "";
    return parseJSON(text);
  } catch (e) {
    console.error("[analyze] Anthropic API failed:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI analysis — Gemini Flash (fallback 2)
// ---------------------------------------------------------------------------
async function analyzeWithGemini(base64Jpeg: string): Promise<CROResult | null> {
  if (!GEMINI_KEY) return null;

  // Try models in order until one works
  const models = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: "image/jpeg", data: base64Jpeg } },
                  { text: SYSTEM_PROMPT + "\n\nAnalyze this screenshot. Return only JSON with no markdown fences." },
                ],
              },
            ],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (res.status === 429) {
        console.warn("[analyze] Gemini", model, "rate limited, trying next...");
        continue;
      }

      if (!res.ok) {
        console.error("[analyze] Gemini", model, "error:", res.status);
        continue;
      }

      const data = await res.json();
      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const result = parseJSON(text);
      if (result) {
        console.log("[analyze] Gemini success with model:", model);
        return result;
      }
    } catch (e) {
      console.error("[analyze] Gemini", model, "failed:", e);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parse JSON from LLM output (strips markdown fences if present)
// ---------------------------------------------------------------------------
function parseJSON(text: string): CROResult | null {
  try {
    const clean = text
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im, "")
      .replace(/```\s*$/im, "")
      .trim();
    return JSON.parse(clean) as CROResult;
  } catch {
    const match = text.match(/\{[\s\S]+\}/);
    if (match) {
      try { return JSON.parse(match[0]) as CROResult; } catch { /* fall through */ }
    }
    console.error("[analyze] Failed to parse AI JSON:", text.slice(0, 300));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Heuristic fallback (no screenshot / AI)
// ---------------------------------------------------------------------------
async function heuristicAnalysis(url: string) {
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AsmosBot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    html = await res.text();
  } catch { /* ignore */ }

  const lower = html.toLowerCase();

  // Popup: only flag when a known popup library script/class is present.
  // Bare 'popup' is in virtually every Shopify theme JS and is not a signal.
  const POPUP_LIBRARY_SIGNALS = [
    "klaviyo", "privy", "omnisend", "justuno", "wheelio", "spin-a-sale",
    "wisepops", "sumo", "optinmonster", "popupsmart", "mailmunch",
    "sleeknote", "popup-trigger", "pop-up-trigger", "privy-widget",
    "klaviyo-popup",
  ];
  const found = {
    popup: POPUP_LIBRARY_SIGNALS.some(sig => lower.includes(sig)),
    // emailCapture: require specific subscription signals; avoid bare 'newsletter'
    // (appears in footer nav links), bare 'sign up' (nav menus), and generic
    // 'form[action' (fires on every cart/search form — not an email signal).
    emailCapture:
      lower.includes("subscribe to our") ||
      lower.includes("join our newsletter") ||
      lower.includes("get 10%") ||
      lower.includes("first order discount") ||
      lower.includes("sign up for emails") ||
      lower.includes("sign up for our newsletter") ||
      lower.includes("klaviyo-form") ||
      lower.includes("email-signup") ||
      lower.includes("newsletter-form") ||
      lower.includes("email_signup") ||
      (lower.includes("enter your email") && lower.includes("subscribe")) ||
      (lower.includes("subscribe") && lower.includes("email") && !lower.includes("email us")),
    socialProof: lower.includes("review") || lower.includes("trustpilot") || lower.includes("yotpo") || lower.includes("stars") || lower.includes("testimonial"),
    // Urgency: remove bare 'only' (stop word). Keep specific phrases.
    urgency:
      lower.includes("limited time") ||
      lower.includes("countdown") ||
      lower.includes("ends soon") ||
      lower.includes("only left") ||
      lower.includes("hours left") ||
      lower.includes("today only") ||
      lower.includes("low stock"),
    exitIntent: lower.includes("exit intent") || lower.includes("exit-intent") || lower.includes("exitintent"),
    // stickyBar: require announcement bar or sticky-bar specific signals.
    // bare 'sticky' fires on sticky nav/footer (universal), 'free shipping' fires on almost every store footer.
    stickyBar:
      lower.includes("announcement-bar") ||
      lower.includes("announcement_bar") ||
      lower.includes("announcementbar") ||
      lower.includes("sticky-bar") ||
      lower.includes("stickybar") ||
      lower.includes("free shipping on orders over") ||
      lower.includes("free shipping over $"),
    // liveChat: add Gorgias (common Shopify), Freshchat
    liveChat:
      lower.includes("livechat") ||
      lower.includes("live-chat") ||
      lower.includes("intercom") ||
      lower.includes("zendesk") ||
      lower.includes("tidio") ||
      lower.includes("crisp") ||
      lower.includes("gorgias") ||
      lower.includes("freshchat") ||
      lower.includes("re:amaze") ||
      lower.includes("reamaze"),
  };

  const scoreMap: Record<keyof typeof found, number> = {
    popup: 20, emailCapture: 15, socialProof: 20,
    urgency: 15, exitIntent: 10, stickyBar: 10, liveChat: 10,
  };

  let score = 0;
  for (const [k, pts] of Object.entries(scoreMap)) {
    if (found[k as keyof typeof found]) score += pts;
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].replace(/\s*[-|:].*$/, "").trim() : "";
  // Decode HTML entities (e.g. &amp; &#174; &reg;)
  const storeName = rawTitle
    ? rawTitle
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#\d+;/g, c => String.fromCharCode(parseInt(c.slice(2, -1), 10)))
        .replace(/®|™/g, "")
        .trim()
    : (() => {
        try { return new URL(url).hostname.replace(/^www\./, "").replace(/\.[^.]+$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
        catch { return "Your Store"; }
      })();

  let grade = "F"; let gradeLabel = "Missing key tools";
  if (score >= 90) { grade = "A+"; gradeLabel = "Outstanding"; }
  else if (score >= 85) { grade = "A"; gradeLabel = "Excellent"; }
  else if (score >= 80) { grade = "A-"; gradeLabel = "Very strong"; }
  else if (score >= 77) { grade = "B+"; gradeLabel = "Above average"; }
  else if (score >= 73) { grade = "B"; gradeLabel = "Good"; }
  else if (score >= 70) { grade = "B-"; gradeLabel = "Decent"; }
  else if (score >= 67) { grade = "C+"; gradeLabel = "Room to improve"; }
  else if (score >= 63) { grade = "C"; gradeLabel = "Average"; }
  else if (score >= 60) { grade = "C-"; gradeLabel = "Below average"; }
  else if (score >= 50) { grade = "D"; gradeLabel = "Poor"; }

  const missing = Object.entries(found).filter(([, v]) => !v).map(([k]) => k);
  const topIssue = missing.length > 0 ? `No ${missing[0]} detected — this is the biggest gap.` : "Store looks reasonably well-optimized.";

  return {
    storeName,
    industry: "Ecommerce / Retail",
    brandColor: "#165DFF",
    description: "",
    logoUrl: "",
    score,
    overallScore: score,
    grade,
    gradeLabel,
    topIssue,
    verdict: `Score ${score}/100 — analyzed via HTML signals (visual scan unavailable).`,
    popup:        { found: found.popup,        description: found.popup        ? "Detected via script signals" : "None detected" },
    emailCapture: { found: found.emailCapture, description: found.emailCapture ? "Detected" : "None detected" },
    socialProof:  { found: found.socialProof,  description: found.socialProof  ? "Detected" : "None detected" },
    urgency:      { found: found.urgency,      description: found.urgency      ? "Detected" : "None detected" },
    exitIntent:   { found: found.exitIntent,   description: found.exitIntent   ? "Detected" : "None detected" },
    stickyBar:    { found: found.stickyBar,    description: found.stickyBar    ? "Detected" : "None detected" },
    liveChat:     { found: found.liveChat,     description: found.liveChat     ? "Detected" : "None detected" },
    screenshotBase64: null,
    analysisSource: "heuristic" as const,
  };
}

// ---------------------------------------------------------------------------
// Extract brand metadata from HTML (color, font, border-radius, logo, description)
// ---------------------------------------------------------------------------
async function extractBrandMeta(url: string): Promise<{
  brandColor: string;
  logoUrl: string;
  description: string;
  fontStack: string[];
  commonBorderRadius: string;
}> {
  let brandColor = "#165DFF";
  let logoUrl = "";
  let description = "";
  let fontStack: string[] = [];
  let commonBorderRadius = "8px";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "AsmosBot/1.0" }, signal: AbortSignal.timeout(6000) });
    const html = await res.text();

    // 1. meta theme-color (highest confidence)
    const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,6})["']/i)?.[1];
    if (themeColor) {
      brandColor = themeColor;
    } else {
      // 2. CSS custom property: --color-primary, --brand-color, --primary-color, --accent-color
      const cssVarMatch = html.match(/--(?:color-primary|brand-color|primary-color|accent-color|color-accent)\s*:\s*(#[0-9a-fA-F]{3,6})/i)?.[1];
      if (cssVarMatch) {
        brandColor = cssVarMatch;
      } else {
        // 3. background-color on header or nav element
        const navBgMatch = html.match(/<(?:header|nav)[^>]*style=["'][^"']*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/i)?.[1];
        if (navBgMatch && navBgMatch.toLowerCase() !== "#ffffff" && navBgMatch.toLowerCase() !== "#fff" && navBgMatch.toLowerCase() !== "#000000" && navBgMatch.toLowerCase() !== "#000") {
          brandColor = navBgMatch;
        } else {
          // 4. Shopify color settings in JSON blobs
          const shopifyColor = html.match(/"colors_accent_1"\s*:\s*"(#[0-9a-fA-F]{3,6})"/i)?.[1] ||
            html.match(/"color_button"\s*:\s*"(#[0-9a-fA-F]{3,6})"/i)?.[1] ||
            html.match(/"color_accent"\s*:\s*"(#[0-9a-fA-F]{3,6})"/i)?.[1];
          if (shopifyColor) brandColor = shopifyColor;
        }
      }
    }

    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (ogImage) logoUrl = ogImage;
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (descMatch) description = descMatch.slice(0, 160);

    // ── Font stack extraction ──────────────────────────────────────────────────
    // Check Google Fonts link tags first (most reliable signal)
    const googleFontsMatch = html.match(/fonts\.googleapis\.com\/css[^"']*family=([^"'&]+)/i);
    if (googleFontsMatch) {
      const rawFamily = decodeURIComponent(googleFontsMatch[1]).replace(/\+/g, " ").split("|")[0].split(":")[0].trim();
      if (rawFamily) fontStack = [rawFamily, "sans-serif"];
    }
    // CSS --font-* custom properties
    if (fontStack.length === 0) {
      const fontVarMatch = html.match(/--(?:font-heading|font-display|font-primary|font-family-heading)\s*:\s*["']?([^;"']+)["']?/i)?.[1];
      if (fontVarMatch) fontStack = [fontVarMatch.trim()];
    }
    // Default to system stack
    if (fontStack.length === 0) fontStack = ["system-ui", "-apple-system", "sans-serif"];

    // ── Border radius extraction ───────────────────────────────────────────────
    const radiusVarMatch = html.match(/--(?:border-radius|radius|rounded|corner-radius)\s*:\s*([0-9.]+(?:px|rem|em))/i)?.[1];
    if (radiusVarMatch) commonBorderRadius = radiusVarMatch;

  } catch { /* ignore */ }
  return { brandColor, logoUrl, description, fontStack, commonBorderRadius };
}


// ---------------------------------------------------------------------------
// Second AI vision pass: brand tokens + existing popup detection
// Runs after the CRO pass — uses the same screenshot, separate focused prompt.
// Returns null on any failure so the main flow degrades gracefully.
// ---------------------------------------------------------------------------
const BRAND_TOKENS_PROMPT = `You are a brand design analyst. Look at this e-commerce store screenshot and extract brand identity data plus any popup currently visible on screen.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "brand_tokens": {
    "palette": ["#hex1", "#hex2", "#hex3"],
    "type_display": "font name or stack used for headings",
    "type_body": "font name or stack used for body text",
    "imagery_style": "minimal | editorial | product-forward | lifestyle | luxury",
    "signature_element_suggestion": "one sentence describing a distinctive visual element from the brand to use in a popup"
  },
  "existing_popup": {
    "captured": true,
    "extracted_copy": { "headline": "", "subhead": "", "cta": "" },
    "extracted_structure": { "trigger_guess": "exit-intent | page-load | scroll | unknown", "fields": ["email"], "layout": "modal | slide-in | bar | fullscreen" }
  }
}

If no popup is visible, set existing_popup.captured to false and leave extracted_copy/structure as empty strings/arrays.
For palette: extract 3-6 actual brand colors you see used on the page (not white/black backgrounds unless they are signature brand colors).
Be precise about font names if you can identify them from visual appearance.`;

interface BrandTokensResult {
  brand_tokens: {
    palette: string[];
    type_display: string;
    type_body: string;
    imagery_style: string;
    signature_element_suggestion: string;
  };
  existing_popup: {
    captured: boolean;
    extracted_copy: { headline: string; subhead: string; cta: string };
    extracted_structure: { trigger_guess: string; fields: string[]; layout: string };
  };
}

async function extractBrandTokens(base64Jpeg: string): Promise<BrandTokensResult | null> {
  // Reuse same provider cascade as the CRO pass — Bedrock first, then direct Anthropic, then Gemini
  try {
    // Try Bedrock first
    const client = new BedrockRuntimeClient({ region: AWS_REGION });
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      system: BRAND_TOKENS_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
          { type: "text", text: "Extract brand tokens and detect any popup. Return only JSON." },
        ],
      }],
    });
    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL,
      body: new TextEncoder().encode(body),
      contentType: "application/json",
      accept: "application/json",
    });
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text: string = responseBody.content?.[0]?.text ?? "";
    return parseBrandTokensJSON(text);
  } catch (bedrockErr) {
    console.warn("[analyze/brand-tokens] Bedrock failed:", bedrockErr instanceof Error ? bedrockErr.message : bedrockErr);
  }

  // Fallback: direct Anthropic API
  if (ANTHROPIC_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          system: BRAND_TOKENS_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
              { type: "text", text: "Extract brand tokens and detect any popup. Return only JSON." },
            ],
          }],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const data = await res.json();
        return parseBrandTokensJSON(data.content?.[0]?.text ?? "");
      }
    } catch (anthropicErr) {
      console.warn("[analyze/brand-tokens] Anthropic failed:", anthropicErr instanceof Error ? anthropicErr.message : anthropicErr);
    }
  }

  return null;
}

function parseBrandTokensJSON(text: string): BrandTokensResult | null {
  try {
    const clean = text.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/im, "").trim();
    return JSON.parse(clean) as BrandTokensResult;
  } catch {
    const match = text.match(/\{[\s\S]+\}/);
    if (match) {
      try { return JSON.parse(match[0]) as BrandTokensResult; } catch { /* fall through */ }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }

async function handler(req: NextRequest) {
  let url: string | null = req.nextUrl.searchParams.get("url");
  if (!url && req.method === "POST") {
    try { url = (await req.json()).url; } catch { /* ignore */ }
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  // 1. Screenshot
  const screenshotBase64 = await takeScreenshot(normalizedUrl);

  if (!screenshotBase64) {
    // No screenshot — use heuristics
    const result = await heuristicAnalysis(normalizedUrl);
    return NextResponse.json(result);
  }

  // 2. AI analysis — Bedrock → Anthropic → Gemini → heuristic (CRO pass)
  let aiResult: CROResult | null = null;
  let analysisSource: "bedrock" | "anthropic" | "gemini" | "heuristic" = "bedrock";

  aiResult = await analyzeWithBedrock(screenshotBase64);

  if (!aiResult) {
    aiResult = await analyzeWithAnthropic(screenshotBase64);
    analysisSource = "anthropic";
  }

  if (!aiResult) {
    aiResult = await analyzeWithGemini(screenshotBase64);
    analysisSource = "gemini";
  }

  if (!aiResult) {
    // All AI failed — return heuristics but include screenshot
    const heuristic = await heuristicAnalysis(normalizedUrl);
    return NextResponse.json({ ...heuristic, screenshotBase64 });
  }

  // 3. Run brand token extraction + HTML meta enrichment in parallel
  const [brandTokensResult, brandMeta] = await Promise.all([
    extractBrandTokens(screenshotBase64),
    extractBrandMeta(normalizedUrl),
  ]);

  const { brandColor, logoUrl, description, fontStack, commonBorderRadius } = brandMeta;

  // Merge: prefer AI-extracted palette over HTML-extracted color
  const finalPalette = brandTokensResult?.brand_tokens?.palette?.length
    ? brandTokensResult.brand_tokens.palette
    : [brandColor];

  const brandTokens = brandTokensResult?.brand_tokens
    ? {
        ...brandTokensResult.brand_tokens,
        palette: finalPalette,
        // If AI returned generic fonts, prefer HTML-extracted ones
        type_body: brandTokensResult.brand_tokens.type_body || fontStack.join(", "),
        type_display: brandTokensResult.brand_tokens.type_display || fontStack[0] || "system-ui",
      }
    : {
        palette: finalPalette,
        type_display: fontStack[0] || "system-ui",
        type_body: fontStack.join(", ") || "system-ui",
        imagery_style: "minimal",
        signature_element_suggestion: "subtle brand accent bar at popup top using primary brand color",
      };

  const existingPopup = brandTokensResult?.existing_popup ?? {
    captured: aiResult.popup?.found ?? false,
    screenshot_url: null,
    extracted_copy: { headline: "", subhead: "", cta: "" },
    extracted_structure: {
      trigger_guess: aiResult.popup?.found ? "unknown" : "none",
      fields: aiResult.popup?.found ? ["email"] : [],
      layout: aiResult.popup?.description ?? "none",
    },
  };

  const computedStyles = {
    colors_in_use: finalPalette,
    font_stack: fontStack,
    common_border_radius: commonBorderRadius,
  };

  return NextResponse.json({
    ...aiResult,
    storeName: decodeEntities(aiResult.storeName ?? ""),
    score: aiResult.overallScore,
    brandColor,
    logoUrl,
    description,
    storeUrl: normalizedUrl,
    screenshotBase64,
    analysisSource,
    // ── New fields for popup generation engine ──
    brandTokens,
    existingPopup,
    computedStyles,
  });
}

