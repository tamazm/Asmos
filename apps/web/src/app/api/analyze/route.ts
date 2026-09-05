import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { prisma } from "@/lib/prisma";

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

import {
  DOM_EXTRACTION_FN,
  catalogueForPrompt,
  fetchCatalogue,
  normalizeDomExtraction,
  paletteFromDom,
  recommendOffer,
  type CatalogueSummary,
  type DomExtraction,
  type Provenance,
  type SignalKey,
} from "@/lib/storeExtraction";
import { upsertStoreProfile } from "@/lib/storeProfile";

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN ?? "";
// Used only as a failure fallback in the protected campaign preset. The
// public fast analyzer deliberately invokes no more than one AI provider.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const AWS_REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-central-1";

// This endpoint backs the embeddable widget (public/embed/analyze.html),
// which is loaded on arbitrary third-party origins - so responses need to be
// readable cross-origin. No cookies/auth are involved, so a wildcard is fine.
function cors<T extends NextResponse>(res: T): T {
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
}

// Bedrock model - Claude Haiku 4.5 via cross-region inference profile
const BEDROCK_MODEL = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

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

interface ExistingPopupResult {
  captured: boolean;
  extracted_copy: { headline: string; subhead: string; cta: string };
  extracted_structure: { trigger_guess: string; fields: string[]; layout: string };
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
  category?: string;
  subcategories?: string[];
  audience?: string;
  brand_voice?: string;
  value_props?: string[];
  signature_detail?: string;
  imagery_style?: string;
  existing_popup?: ExistingPopupResult;
}

// ---------------------------------------------------------------------------
// CRO analysis prompt (shared across all AI providers)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a senior conversion rate optimization (CRO) expert and direct-response marketer with 15 years of experience auditing ecommerce websites. You look at websites like a hawk - you notice every popup, every sticky bar, every trust badge, every countdown timer.

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
  "topIssue": "No email capture - visitors leave with no way to re-engage",
  "verdict": "Decent social proof but hemorrhaging leads with no popup or email capture.",
  "storeName": "Brand Name",
  "industry": "Ecommerce / Retail",
  "category": "specific products sold, never Ecommerce/Retail/Shopify",
  "subcategories": ["2-5 specific product lines"],
  "audience": "specific buyer group",
  "brand_voice": "one concrete sentence describing how this store talks",
  "value_props": ["up to 4 claims actually visible on the page"],
  "signature_detail": "one distinctive visual or verbal detail, or empty string",
  "imagery_style": "minimal | editorial | product-forward | lifestyle | luxury",
  "existing_popup": {
    "captured": false,
    "extracted_copy": { "headline": "", "subhead": "", "cta": "" },
    "extracted_structure": { "trigger_guess": "none", "fields": [], "layout": "" }
  }
}

Scoring (points per found element): popup=20, emailCapture=15, socialProof=20, urgency=15, exitIntent=10, stickyBar=10, liveChat=10.
Grade scale: 90+=A+, 85+=A, 80+=A-, 77+=B+, 73+=B, 70+=B-, 67+=C+, 63+=C, 60+=C-, 57+=D+, 53+=D, 50+=D-, <50=F.
Be blunt and specific. If you see a Klaviyo/Privy/Omnisend popup, name it. If you see star ratings, name them.
For category, audience, voice, value_props, signature_detail, and imagery_style, make grounded judgments from the screenshot and supplied DOM evidence. Use empty strings/arrays when evidence is insufficient. Do not guess colours or fonts: the DOM measures those.`;

// ---------------------------------------------------------------------------
// One Browserless session: navigation, DOM, popup, logo, colours, product
// images, metadata, and screenshot are all returned by this /function call.
//
// We were already paying for a headless browser and only asking it for a
// photograph. Everything the vision pass below was guessing at - the display
// and body typefaces, the brand colours, the button treatment, the real logo,
// the store's own product photography, whether a popup already exists - is
// sitting in getComputedStyle, exactly, and this reads it.
// ---------------------------------------------------------------------------
const BROWSERLESS_FUNCTION_URL = `https://production-sfo.browserless.io/function?token=${BROWSERLESS_TOKEN}`;

type BrowserAnalysisOptions = {
  navigationTimeoutMs: number;
  triggerWaitMs: number;
  screenshotQuality: number;
};

async function extractDom(
  url: string,
  timeoutMs = 3000,
  browserOptions: BrowserAnalysisOptions = {
    navigationTimeoutMs: 2200,
    triggerWaitMs: 250,
    screenshotQuality: 72,
  },
): Promise<DomExtraction | null> {
  if (!BROWSERLESS_TOKEN) return null;
  try {
    const res = await fetch(BROWSERLESS_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: DOM_EXTRACTION_FN, context: { url, ...browserOptions } }),
      signal: AbortSignal.timeout(Math.max(250, timeoutMs)),
    });
    if (!res.ok) {
      console.warn("[analyze] Browserless /function failed:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const body = await res.json();
    // Browserless returns either the raw value or { data } depending on version.
    return normalizeDomExtraction(body?.data ?? body);
  } catch (e) {
    console.warn("[analyze] Browserless /function error:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI analysis - Bedrock (primary)
// ---------------------------------------------------------------------------
async function analyzeWithBedrock(
  base64Jpeg: string,
  evidence = "",
  abortSignal?: AbortSignal,
  maxTokens = 1200,
): Promise<CROResult | null> {
  try {
    const client = new BedrockRuntimeClient({ region: AWS_REGION });

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: maxTokens,
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
              text: "Analyze this website screenshot and DOM evidence. Return only JSON with no markdown fences.\n\n" + evidence,
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

    const response = abortSignal
      ? await client.send(command, { abortSignal })
      : await client.send(command);
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
// ---------------------------------------------------------------------------
// Deterministic signal detection - grep the page's own HTML/scripts for known
// library and copy signatures, rather than asking a vision model to guess
// from one static screenshot. This is the only source of truth for these 7
// checks: a vision model cannot see a JS-triggered exit-intent popup, a
// sticky bar that only appears on scroll, or a chat widget that loads late,
// so letting it answer "found" for those is a guess dressed up as an
// observation. A text/script match is a fact we can actually verify from
// what the store served us; the AI's screenshot narrative (SYSTEM_PROMPT
// below) is used only for descriptive colour, never for the found/missing
// verdict itself - see the merge in handler(). This is the fallback for
// when Browserless is unavailable; DOM_EXTRACTION_FN's live CRO signal pass
// (storeExtraction.ts) is preferred whenever we have it - see handler().
const SIGNAL_LABELS: Record<SignalKey, string> = {
  popup: "popup",
  emailCapture: "email capture",
  socialProof: "social proof",
  urgency: "urgency messaging",
  exitIntent: "exit-intent offer",
  stickyBar: "sticky bar",
  liveChat: "live chat",
};

const SCORE_MAP: Record<SignalKey, number> = {
  popup: 20, emailCapture: 15, socialProof: 20,
  urgency: 15, exitIntent: 10, stickyBar: 10, liveChat: 10,
};

const SIGNAL_FOUND_DESCRIPTIONS: Record<SignalKey, string> = {
  popup: "Popup detected on the page",
  emailCapture: "Email capture form or signup copy detected",
  socialProof: "Reviews or social proof detected",
  urgency: "Urgency or scarcity messaging detected",
  exitIntent: "Exit-intent trigger detected",
  stickyBar: "Sticky announcement bar detected",
  liveChat: "Live chat widget detected",
};

function gradeFromScore(score: number): { grade: string; gradeLabel: string } {
  if (score >= 90) return { grade: "A+", gradeLabel: "Outstanding" };
  if (score >= 85) return { grade: "A", gradeLabel: "Excellent" };
  if (score >= 80) return { grade: "A-", gradeLabel: "Very strong" };
  if (score >= 77) return { grade: "B+", gradeLabel: "Above average" };
  if (score >= 73) return { grade: "B", gradeLabel: "Good" };
  if (score >= 70) return { grade: "B-", gradeLabel: "Decent" };
  if (score >= 67) return { grade: "C+", gradeLabel: "Room to improve" };
  if (score >= 63) return { grade: "C", gradeLabel: "Average" };
  if (score >= 60) return { grade: "C-", gradeLabel: "Below average" };
  if (score >= 50) return { grade: "D", gradeLabel: "Poor" };
  return { grade: "F", gradeLabel: "Missing key tools" };
}

function detectSignalsFromHtml(html: string): Record<SignalKey, boolean> {
  const lower = html.toLowerCase();

  // Popup: only flag when a known popup library script/class is present.
  // Bare 'popup' is in virtually every Shopify theme JS and is not a signal.
  const POPUP_LIBRARY_SIGNALS = [
    "klaviyo", "privy", "omnisend", "justuno", "wheelio", "spin-a-sale",
    "wisepops", "sumo", "optinmonster", "popupsmart", "mailmunch",
    "sleeknote", "popup-trigger", "pop-up-trigger", "privy-widget",
    "klaviyo-popup",
  ];
  return {
    popup: POPUP_LIBRARY_SIGNALS.some(sig => lower.includes(sig)),
    // emailCapture: require specific subscription signals; avoid bare 'newsletter'
    // (appears in footer nav links), bare 'sign up' (nav menus), and generic
    // 'form[action' (fires on every cart/search form - not an email signal).
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
}

async function heuristicAnalysis(url: string) {
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AsmosBot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    html = await res.text();
  } catch { /* ignore */ }

  const found = detectSignalsFromHtml(html);

  let score = 0;
  for (const [k, pts] of Object.entries(SCORE_MAP)) {
    if (found[k as SignalKey]) score += pts;
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

  const { grade, gradeLabel } = gradeFromScore(score);

  const missing = (Object.keys(found) as SignalKey[]).filter((k) => !found[k]);
  const topIssue = missing.length > 0 ? `No ${SIGNAL_LABELS[missing[0]]} detected - this is the biggest gap.` : "Store looks reasonably well-optimized.";

  return {
    storeName,
    industry: "Ecommerce / Retail",
    brandColor: "#111827",
    description: "",
    logoUrl: "",
    score,
    overallScore: score,
    grade,
    gradeLabel,
    topIssue,
    verdict: `Score ${score}/100 - analyzed via HTML signals (visual scan unavailable).`,
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
  brandColor: string | null;
  logoUrl: string;
  description: string;
  fontStack: string[];
  commonBorderRadius: string;
  rawHtml: string;
}> {
  // Deliberately null, not "#165DFF".
  //
  // A default that is indistinguishable from a successful extraction is the
  // worst kind: nothing downstream could tell "this store's brand is blue" from
  // "every extraction branch missed", so a large share of generated popups came
  // out in Asmos's own brand colour. Null makes the failure legible and lets the
  // caller decide what to do about it.
  let brandColor: string | null = null;
  let logoUrl = "";
  let description = "";
  let fontStack: string[] = [];
  let commonBorderRadius = "8px";
  let rawHtml = "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "AsmosBot/1.0" }, signal: AbortSignal.timeout(6000) });
    const html = await res.text();
    rawHtml = html;

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
    // No system-stack default here either - an empty array means "we did not
    // find their typeface", which is a different statement from "their typeface
    // is system-ui", and only the first one lets the DOM pass win the merge.

    // ── Border radius extraction ───────────────────────────────────────────────
    const radiusVarMatch = html.match(/--(?:border-radius|radius|rounded|corner-radius)\s*:\s*([0-9.]+(?:px|rem|em))/i)?.[1];
    if (radiusVarMatch) commonBorderRadius = radiusVarMatch;

  } catch { /* ignore */ }
  return { brandColor, logoUrl, description, fontStack, commonBorderRadius, rawHtml };
}


// ---------------------------------------------------------------------------
// Second AI vision pass: brand tokens + existing popup detection
// Runs after the CRO pass - uses the same screenshot, separate focused prompt.
// Returns null on any failure so the main flow degrades gracefully.
// ---------------------------------------------------------------------------
const BRAND_TOKENS_PROMPT = `You are a brand analyst. You are shown a screenshot of an e-commerce
store's homepage, and - when the store exposes one - a digest of its actual product catalogue.

Your job is JUDGMENT, not measurement. The colours, typefaces, button treatment and logo have
already been read directly out of the page's computed styles and are more accurate than anything
you could infer from a JPEG. Do not attempt to name hex codes or identify typefaces.

Answer the questions a copywriter needs answered before they can write a single line for this
specific shop, and that nothing else in the pipeline can answer.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "category": "",
  "subcategories": [],
  "audience": "",
  "brand_voice": "",
  "value_props": [],
  "signature_detail": "",
  "imagery_style": "minimal | editorial | product-forward | lifestyle | luxury",
  "existing_popup": {
    "captured": true,
    "extracted_copy": { "headline": "", "subhead": "", "cta": "" },
    "extracted_structure": { "trigger_guess": "exit-intent | page-load | scroll | unknown", "fields": ["email"], "layout": "modal | slide-in | bar | fullscreen" }
  }
}

Field rules:
- "category": what this shop actually SELLS, as a person would say it. "children's sleepwear",
  "single-origin coffee", "handmade ceramics", "climbing hardware". Never a platform bucket like
  "Ecommerce", "Retail", "Online Store" or "Shopify". If the catalogue digest is present, it is
  the authority - read the product titles and types, not the hero photograph.
- "subcategories": 2-5 more specific lines the shop carries.
- "audience": who buys this, in a phrase. "parents of under-fives", "people furnishing a first
  flat", "trail runners". Infer from the products and the price band, not from the models in the
  hero image.
- "brand_voice": how this shop talks, in one sentence, specific enough to write from. Quote or
  paraphrase their own words where you can see them. "Plain and unhurried, no exclamation marks,
  talks about materials" beats "friendly and modern".
- "value_props": up to 4 claims THEY make on their own page (free returns, made in Britain,
  ships in 24h). Their words, not yours. Empty array if none are visible.
- "signature_detail": one concrete visual or verbal thing that is distinctive to this brand and
  could be echoed in a popup. Empty string if nothing stands out - an invented one is worse
  than none.
- "existing_popup": if a popup is visible in the screenshot, capture it. If not, set captured
  to false and leave the copy/structure empty.

If you cannot tell something from the evidence you were given, return an empty string for it.
An honest blank is useful; a confident guess is not, because everything downstream treats these
as facts about the merchant.`;

interface BrandTokensResult {
  category?: string;
  subcategories?: string[];
  audience?: string;
  brand_voice?: string;
  value_props?: string[];
  signature_detail?: string;
  imagery_style?: string;
  /** Legacy shape - kept so a cached/older response still parses. */
  brand_tokens?: {
    palette: string[];
    type_display: string;
    type_body: string;
    imagery_style: string;
    signature_element_suggestion: string;
  };
  existing_popup: ExistingPopupResult;
}

async function extractBrandTokens(
  base64Jpeg: string,
  evidence: string,
): Promise<BrandTokensResult | null> {
  // The catalogue digest and the page's own hero copy go in alongside the
  // screenshot. This is the difference between "guess what this shop is from
  // one marketing photograph" and "read 250 product titles and tell me who
  // buys them".
  const userText =
    "Analyse this store and return only JSON.\n\n" + evidence;

  // Reuse same provider cascade as the CRO pass - Bedrock first, then direct Anthropic, then Gemini
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
          { type: "text", text: userText },
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
              { type: "text", text: userText },
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
export async function OPTIONS() { return cors(new NextResponse(null, { status: 204 })); }

const ANALYZE_RESPONSE_BUDGET_MS = 3850;
const CAMPAIGN_ANALYSIS_BUDGET_MS = 7500;
export type StoreAnalysisMode = "fast" | "campaign";

const ANALYSIS_PRESETS = {
  fast: {
    totalBudgetMs: ANALYZE_RESPONSE_BUDGET_MS,
    maxBrowserMs: 2900,
    catalogueTimeoutMs: 1200,
    catalogueJoinMs: 150,
    aiReserveMs: 120,
    aiMaxTokens: 1200,
    browser: { navigationTimeoutMs: 2200, triggerWaitMs: 250, screenshotQuality: 72 },
  },
  campaign: {
    totalBudgetMs: CAMPAIGN_ANALYSIS_BUDGET_MS,
    maxBrowserMs: 4800,
    catalogueTimeoutMs: 2500,
    catalogueJoinMs: 900,
    aiReserveMs: 200,
    aiMaxTokens: 1700,
    browser: { navigationTimeoutMs: 3500, triggerWaitMs: 650, screenshotQuality: 82 },
  },
} as const;
const recentAnalyzeDurations: number[] = [];

type AnalyzeTimings = {
  navigationMs: number;
  extractionMs: number;
  screenshotMs: number;
  aiMs: number;
  catalogueMs: number;
  databaseMs: number;
  totalMs: number;
};

async function settleWithin<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  if (timeoutMs <= 0) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function analyzeWithAnthropicUnified(
  base64Jpeg: string,
  evidence: string,
  abortSignal: AbortSignal,
  maxTokens: number,
): Promise<CROResult | null> {
  if (!ANTHROPIC_KEY) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
            { type: "text", text: "Analyze this website screenshot and DOM evidence. Return only JSON.\n\n" + evidence },
          ],
        }],
      }),
      signal: abortSignal,
    });
    if (!response.ok) return null;
    const body = await response.json();
    return parseJSON(body.content?.[0]?.text ?? "");
  } catch (error) {
    if (!abortSignal.aborted) console.warn("[analyze] campaign Anthropic fallback failed:", error);
    return null;
  }
}

function domBasedCro(
  normalizedUrl: string,
  signals: Record<SignalKey, boolean>,
  dom: DomExtraction | null,
): CROResult {
  let overallScore = 0;
  for (const key of Object.keys(SCORE_MAP) as SignalKey[]) if (signals[key]) overallScore += SCORE_MAP[key];
  const { grade, gradeLabel } = gradeFromScore(overallScore);
  const missing = (Object.keys(signals) as SignalKey[]).find((key) => !signals[key]);
  let hostname = "Store";
  try { hostname = new URL(normalizedUrl).hostname.replace(/^www\./, "").split(".")[0]; } catch {}
  const check = (key: SignalKey): CheckItem => ({
    found: signals[key],
    description: signals[key] ? SIGNAL_FOUND_DESCRIPTIONS[key] : "None detected",
  });
  return {
    popup: check("popup"), emailCapture: check("emailCapture"), socialProof: check("socialProof"),
    urgency: check("urgency"), exitIntent: check("exitIntent"), stickyBar: check("stickyBar"), liveChat: check("liveChat"),
    overallScore, grade, gradeLabel,
    topIssue: missing ? `No ${SIGNAL_LABELS[missing]} detected - this is the biggest gap.` : "Store looks reasonably well-optimized.",
    verdict: `Score ${overallScore}/100 based on live DOM signals.`,
    storeName: dom?.h1 || hostname.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    industry: "Ecommerce / Retail",
  };
}

function recordAnalyzeDuration(totalMs: number) {
  recentAnalyzeDurations.push(totalMs);
  if (recentAnalyzeDurations.length > 100) recentAnalyzeDurations.shift();
  const sorted = [...recentAnalyzeDurations].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? totalMs;
  return { sampleSize: sorted.length, medianMs: percentile(0.5), p95Ms: percentile(0.95) };
}

async function handler(req: NextRequest) {
  const requestStartedAt = Date.now();
  let rateLimitDatabaseMs = 0;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (ip !== "unknown") {
    const databaseStartedAt = Date.now();
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
    } else if (rateLimit.count >= 50) {
      return cors(NextResponse.json({ error: "Rate limit exceeded. Please try again tomorrow." }, { status: 429 }));
    } else {
      await prisma.rateLimit.update({
        where: { id: rateLimit.id },
        data: { count: { increment: 1 } }
      });
    }
    rateLimitDatabaseMs = Date.now() - databaseStartedAt;
  }

  let url: string | null = req.nextUrl.searchParams.get("url");
  if (!url && req.method === "POST") {
    try { url = (await req.json()).url; } catch { /* ignore */ }
  }

  if (!url || typeof url !== "string") {
    return cors(NextResponse.json({ error: "Missing url param" }, { status: 400 }));
  }

  const result = await analyzeStore(url, {
    mode: "fast",
    deadlineAt: requestStartedAt + ANALYZE_RESPONSE_BUDGET_MS,
    databaseMs: rateLimitDatabaseMs,
  });
  const timing = (result.analysisTimingMs ?? {}) as Record<string, unknown>;
  const response = cors(NextResponse.json({ ...result, analysisTimingMs: timing }));
  const totalMs = Date.now() - requestStartedAt;
  const distribution = recordAnalyzeDuration(totalMs);
  response.headers.set("X-Analyze-Duration-Ms", String(totalMs));
  response.headers.set(
    "Server-Timing",
    ["navigation", "extraction", "ai", "catalogue", "database"]
      .map((key) => `${key};dur=${Number(timing[`${key}Ms`] ?? 0)}`)
      .concat(`total;dur=${totalMs}`)
      .join(", "),
  );
  console.info("[analyze:timing]", JSON.stringify({ ...timing, totalMs, ...distribution }));
  return response;
}

/**
 * Run the full store analysis without an HTTP round trip.
 *
 * The public analyzer route and campaign-generation workflow share this core
 * so campaign creation can return immediately while the same high-quality
 * screenshot, DOM, catalogue, and vision analysis continues durably in
 * Inngest. Callers are responsible for authentication/rate limiting.
 */
export async function analyzeStore(
  url: string,
  options: { mode?: StoreAnalysisMode; deadlineAt?: number; databaseMs?: number } = {},
): Promise<Record<string, unknown>> {
  const analysisStartedAt = Date.now();
  const mode = options.mode ?? "fast";
  const preset = ANALYSIS_PRESETS[mode];
  const deadlineAt = options.deadlineAt ?? analysisStartedAt + preset.totalBudgetMs;
  const timings: AnalyzeTimings = {
    navigationMs: 0,
    extractionMs: 0,
    screenshotMs: 0,
    aiMs: 0,
    catalogueMs: 0,
    databaseMs: options.databaseMs ?? 0,
    totalMs: 0,
  };

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  // Neither of these depends on the screenshot below - kicked off now, before
  // the screenshot/CRO-vision chain even starts, so a full second Browserless
  // session (extractDom) and a plain HTML fetch (extractBrandMeta) run
  // concurrently with it instead of only starting after it. Safe to leave
  // in flight and abandon on the early-return below: both catch their own
  // errors internally and never reject (see their definitions above), so
  // there's no unhandled-rejection risk from not awaiting them there.
  const catalogueStartedAt = Date.now();
  let catalogueFinished = false;
  const cataloguePromise = fetchCatalogue(normalizedUrl, "", preset.catalogueTimeoutMs).finally(() => {
    catalogueFinished = true;
    timings.catalogueMs = Date.now() - catalogueStartedAt;
  });
  const browserBudgetMs = Math.max(250, Math.min(preset.maxBrowserMs, deadlineAt - Date.now() - 700));
  const browserStartedAt = Date.now();
  const dom = await extractDom(normalizedUrl, browserBudgetMs, preset.browser);
  timings.navigationMs = dom?.timings?.navigationMs ?? (Date.now() - browserStartedAt);
  timings.extractionMs = dom?.timings?.extractionMs ?? 0;
  timings.screenshotMs = dom?.timings?.screenshotMs ?? 0;
  const screenshotBase64 = dom?.screenshotBase64 ?? null;

  // 2. AI analysis - Bedrock → Anthropic → Gemini → heuristic (CRO pass)
  const catalogue: CatalogueSummary | null = await settleWithin(
    cataloguePromise,
    Math.max(0, Math.min(preset.catalogueJoinMs, deadlineAt - Date.now() - 500)),
    null,
  );
  if (!catalogueFinished) timings.catalogueMs = Date.now() - catalogueStartedAt;

  const htmlBrandColor = dom?.pageBrandColor ?? null;
  const ogImage = dom?.ogImage ?? "";
  const description = dom?.pageDescription ?? "";
  const fontStack: string[] = [];
  const commonBorderRadius = dom?.borderRadius ?? "8px";
  const rawHtml = "";
  const signals: Record<SignalKey, boolean> = dom?.signals ?? detectSignalsFromHtml(rawHtml);
  const fallbackResult = domBasedCro(normalizedUrl, signals, dom);

  const evidence = [
    `Store URL: ${normalizedUrl}`,
    dom?.h1 ? `Page headline: ${dom.h1}` : null,
    dom?.heroText ? `Hero copy: ${dom.heroText}` : null,
    description ? `Meta description: ${description}` : null,
    dom?.productTitles.length ? `Visible products: ${dom.productTitles.join(", ")}` : null,
    catalogue ? `Catalogue:\n${catalogueForPrompt(catalogue)}` : null,
  ].filter((line) => line !== null).join("\n");

  let aiResult: CROResult = fallbackResult;
  let analysisSource: "bedrock" | "anthropic" | "dom" = "dom";
  if (screenshotBase64 && deadlineAt - Date.now() > 200) {
    const aiStartedAt = Date.now();
    const controller = new AbortController();
    const aiBudgetMs = Math.max(1, deadlineAt - Date.now() - preset.aiReserveMs);
    const abortTimer = setTimeout(() => controller.abort(), aiBudgetMs);
    let modelResult = await settleWithin(
      analyzeWithBedrock(screenshotBase64, evidence, controller.signal, preset.aiMaxTokens),
      aiBudgetMs,
      null,
    );
    let modelSource: "bedrock" | "anthropic" = "bedrock";
    // Protected campaign analysis gets one failure-only fallback. The public
    // fast path still makes no more than one AI request.
    if (!modelResult && mode === "campaign" && !controller.signal.aborted) {
      const fallbackBudgetMs = Math.max(0, deadlineAt - Date.now() - preset.aiReserveMs);
      if (fallbackBudgetMs > 200) {
        modelResult = await settleWithin(
          analyzeWithAnthropicUnified(
            screenshotBase64,
            evidence,
            controller.signal,
            preset.aiMaxTokens,
          ),
          fallbackBudgetMs,
          null,
        );
        modelSource = "anthropic";
      }
    }
    clearTimeout(abortTimer);
    timings.aiMs = Date.now() - aiStartedAt;
    if (modelResult) {
      aiResult = modelResult;
      analysisSource = modelSource;
    }
  }

  // ── 3. MEASURE, then judge ────────────────────────────────────────────────
  //
  // Source order is confidence order. The DOM knows the fonts and colours
  // exactly; the catalogue knows what is sold and for how much; the pixels are
  // the fallback when the DOM pass is unavailable; the model is asked only for
  // the things none of those can answer. Previously all of it was one vision
  // guess with an HTML regex as backup, which is why the store name was the
  // only field that came out right.
  //
  // brandMeta is awaited alone, not Promise.all'd with dom, so the catalogue
  // fetch just below can start the moment it's ready instead of waiting for
  // whichever of the two happens to be slower - dom (a full browser session)
  // usually is, and catalogue never needed it in the first place.
  // ── Ground the found/missing checklist in what we can actually verify ─────
  // The AI's screenshot narrative above is not trustworthy for this: asked
  // whether an exit-intent popup exists, a vision model has nothing to look
  // at (it's a JS mouse-leave listener, invisible in a still frame), so it
  // answers with a plausible-sounding guess instead of an observation. These
  // 7 checks are overwritten with what was actually measured, and the
  // score/grade/top issue are recomputed to match so nothing downstream
  // contradicts a fact we now know for certain.
  //
  // Two ways we can know it, in confidence order: dom.signals is a live
  // Browserless pass that queried the actually-rendered DOM/window globals
  // and, for exitIntent, dispatched the real exit-gesture event and checked
  // whether a popup demonstrably appeared because of it (DOM_EXTRACTION_FN
  // in storeExtraction.ts). detectSignalsFromHtml is the fallback when
  // Browserless wasn't available for this request - a static fetch of the
  // page's own HTML, so it can still see script tags and copy, just nothing
  // that only exists after JS runs.
  (Object.keys(signals) as SignalKey[]).forEach((key) => {
    const found = signals[key];
    const keepAiDescription = found && aiResult[key]?.found && aiResult[key]?.description;
    aiResult[key] = {
      found,
      description: keepAiDescription ? aiResult[key].description : (found ? SIGNAL_FOUND_DESCRIPTIONS[key] : "None detected"),
    };
  });

  let overallScore = 0;
  for (const key of Object.keys(SCORE_MAP) as SignalKey[]) {
    if (signals[key]) overallScore += SCORE_MAP[key];
  }
  const { grade, gradeLabel } = gradeFromScore(overallScore);
  const missingSignal = (Object.keys(signals) as SignalKey[]).find((k) => !signals[k]);
  aiResult.overallScore = overallScore;
  aiResult.grade = grade;
  aiResult.gradeLabel = gradeLabel;
  aiResult.topIssue = missingSignal
    ? `No ${SIGNAL_LABELS[missingSignal]} detected - this is the biggest gap.`
    : "Store looks reasonably well-optimized.";

  const sources: Provenance = {};
  const note = (field: string, source: Provenance[string]["source"], confidence: number) => {
    sources[field] = { source, confidence };
  };

  // ── Palette ───────────────────────────────────────────────────────────────
  // Measured from painted area where possible. A vision model naming hex codes
  // off a quality-75 JPEG was the old method, and it is why output could feel
  // almost-but-not-quite on-brand even when nothing errored.
  let palette = dom ? paletteFromDom(dom.colorsByArea) : [];
  if (palette.length > 0) {
    note("palette", "dom", 0.95);
  } else if (htmlBrandColor) {
    palette = [{ hex: htmlBrandColor, areaShare: 0 }];
    note("palette", "html", 0.5);
  }
  const paletteHex = palette.map((p) => p.hex);
  // Null, not "#165DFF" - see extractBrandMeta.
  const brandColor: string | null = paletteHex[0] ?? htmlBrandColor ?? null;

  // ── Type ──────────────────────────────────────────────────────────────────
  const typeDisplay = dom?.displayFont ?? fontStack[0] ?? null;
  // `fontStack.join(", ")` yields "" for an empty stack, and "" is a worse
  // answer than null: downstream, an empty string reads as "we measured their
  // body face and it is nothing". Parenthesised because mixing ?? with || is a
  // syntax error in ECMAScript, not merely a style problem - the unparenthesised
  // form is what broke the build.
  const joinedStack = fontStack.join(", ");
  const typeBody = dom?.bodyFont ?? (joinedStack || null);
  if (dom?.displayFont) note("typeDisplay", "dom", 0.95);
  else if (fontStack[0]) note("typeDisplay", "html", 0.5);

  // ── Logo ──────────────────────────────────────────────────────────────────
  // From the header <img>, not og:image. og:image is the social share card,
  // which is a product or lifestyle shot on approximately every store - which
  // is exactly why it is a bad logo and a perfectly good *photograph*. It is
  // reused as a last-resort product image further down rather than thrown away.
  const logoUrl = dom?.logo ?? "";
  if (dom?.logo) note("logoUrl", "dom", 0.9);

  // ── The judgment pass ─────────────────────────────────────────────────────
  const brandTokensResult = analysisSource !== "dom" ? {
    category: aiResult.category,
    subcategories: aiResult.subcategories,
    audience: aiResult.audience,
    brand_voice: aiResult.brand_voice,
    value_props: aiResult.value_props,
    signature_detail: aiResult.signature_detail,
    imagery_style: aiResult.imagery_style,
    existing_popup: aiResult.existing_popup,
  } : null;

  // The model's own category is only trusted when it is not a platform bucket.
  // The old schema example literally showed "Ecommerce / Retail", and an example
  // value inside a JSON schema is the strongest anchor a model gets.
  const GENERIC_CATEGORY = /^(e-?commerce|retail|online (store|shop)|shopify|store|shop|general)\b/i;
  const modelCategory = brandTokensResult?.category?.trim() || "";
  const category = modelCategory && !GENERIC_CATEGORY.test(modelCategory) ? modelCategory : null;
  if (category) note("category", catalogue ? "catalogue" : "model", catalogue ? 0.85 : 0.6);

  if (catalogue) {
    note("priceBand", "catalogue", 0.95);
    note("productImages", "catalogue", 0.9);
  }

  const offerRecommendation = recommendOffer(catalogue);

  // Real product photography, preferred over the generic stock library.
  // Catalogue first (it is the store's own merchandising), then whatever the
  // page was actually showing, then og:image as a floor so a store with no
  // readable catalogue still contributes one real photograph of its own.
  const productImages = [...(catalogue?.images ?? []), ...(dom?.productImages ?? []), ogImage]
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 16);

  // ── Assemble ──────────────────────────────────────────────────────────────
  const brandTokens = {
    palette: paletteHex,
    type_display: typeDisplay ?? "system-ui",
    type_body: typeBody ?? typeDisplay ?? "system-ui",
    imagery_style: brandTokensResult?.imagery_style ?? (productImages.length ? "product-forward" : "minimal"),
    signature_element_suggestion:
      brandTokensResult?.signature_detail ||
      "the store's own product photography, keyed to the brand palette",
  };

  const measuredPopupPresent = dom?.detectedPopup?.present ?? aiResult.popup?.found ?? false;
  const existingPopup = measuredPopupPresent && brandTokensResult?.existing_popup ? {
    ...brandTokensResult.existing_popup,
    captured: true,
  } : {
    captured: measuredPopupPresent,
    screenshot_url: null,
    extracted_copy: { headline: "", subhead: "", cta: "" },
    extracted_structure: {
      trigger_guess: aiResult.popup?.found ? "unknown" : "none",
      fields: aiResult.popup?.found ? ["email"] : [],
      layout: aiResult.popup?.description ?? "none",
    },
  };

  const computedStyles = {
    colors_in_use: paletteHex,
    font_stack: [typeDisplay, typeBody].filter((f): f is string => !!f),
    common_border_radius: dom?.borderRadius ?? commonBorderRadius,
  };

  const storeProfile = {
    category,
    subcategories: brandTokensResult?.subcategories ?? [],
    audience: brandTokensResult?.audience?.trim() || null,
    priceBandMin: catalogue?.priceMin ?? null,
    priceBandMax: catalogue?.priceMax ?? null,
    priceBandMedian: catalogue?.priceMedian ?? null,
    currency: catalogue?.currency ?? dom?.currency ?? null,
    productCount: catalogue?.productCount ?? null,
    palette,
    typeDisplay,
    typeBody,
    buttonStyle: dom?.buttonStyle ?? null,
    borderRadius: dom?.borderRadius ?? commonBorderRadius,
    logoUrl: logoUrl || null,
    productImages,
    brandVoice: brandTokensResult?.brand_voice?.trim() || null,
    valueProps: brandTokensResult?.value_props ?? [],
    signatureDetail: brandTokensResult?.signature_detail?.trim() || null,
    platform: dom?.platform ?? catalogue?.source ?? null,
    detectedPopup: dom?.detectedPopup ?? null,
    sources,
  };

  // Persist against the Website when one exists for this URL. Pre-auth analyses
  // have no Website row yet; the onboarding step picks the profile up from the
  // response and writes it once the account is created.
  const databaseBudgetMs = Math.max(0, Math.min(150, deadlineAt - Date.now() - 25));
  if (databaseBudgetMs >= 25) {
    const databaseStartedAt = Date.now();
    const persist = (async () => {
      try {
        const website = await prisma.website.findFirst({
          where: { url: normalizedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") },
          select: { id: true },
        });
        if (website) await upsertStoreProfile({ websiteId: website.id, ...storeProfile });
      } catch (e) {
        // Persistence is an enhancement, never a reason to fail the analysis.
        console.warn("[analyze] store profile persist failed:", e);
      }
    })();
    await settleWithin<void>(persist, databaseBudgetMs, undefined);
    timings.databaseMs += Date.now() - databaseStartedAt;
  }

  timings.totalMs = Date.now() - analysisStartedAt;

  return {
    ...aiResult,
    storeName: decodeEntities(aiResult.storeName ?? ""),
    // The generic bucket no longer masquerades as a finding. Downstream reads
    // `category` first and only falls back to `industry` when it is null.
    industry: category ?? aiResult.industry ?? null,
    score: aiResult.overallScore,
    brandColor,
    logoUrl,
    description,
    storeUrl: normalizedUrl,
    screenshotBase64,
    analysisSource,
    analysisMode: mode,
    // ── New fields for popup generation engine ──
    brandTokens,
    existingPopup,
    computedStyles,
    // ── The store, as understood ──
    storeProfile,
    offerRecommendation,
    extractionSources: sources,
    analysisTimingMs: timings,
  };
}

/** Richer, still bounded analysis for authenticated popup generation. */
export function analyzeStoreForCampaign(url: string): Promise<Record<string, unknown>> {
  return analyzeStore(url, { mode: "campaign" });
}

