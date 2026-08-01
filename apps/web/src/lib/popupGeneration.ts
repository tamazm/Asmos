/**
 * lib/popupGeneration.ts
 *
 * Schema-driven popup design engine for Asmos.
 * Implements the full pipeline: brand token assembly → mode detection →
 * baseline generation → variant generation driven by PostHog analytics.
 *
 * Provider: Claude Haiku (fast, structured output via tool call).
 * Falls back to Gemini Flash when ANTHROPIC_API_KEY is not set.
 * Falls back to Postgres CampaignEvent data when PostHog Personal API key is not set.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { gemini, GEMINI_MODEL } from "@/lib/gemini";
import { confidenceVsControl } from "@/lib/stats";
import { prisma } from "@/lib/prisma";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";



// ─── Environment ─────────────────────────────────────────────────────────────
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY ?? "";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const HAS_ANTHROPIC_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const HAS_AWS_KEY = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
const AWS_REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-central-1";
const BEDROCK_MODEL = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignificanceFlag = "conclusive" | "inconclusive" | "insufficient_data";
export type TestAxis = "trigger" | "friction" | "copy" | "layout" | "visual";

export type BrandTokens = {
  palette: string[];           // hex colors, 4-6 entries
  type_display: string;        // display font name or stack
  type_body: string;           // body font name or stack
  imagery_style: string;       // "minimal" | "editorial" | "product-forward" etc.
  signature_element_suggestion: string; // e.g. "use brand badge with logo mark"
};

export type ExistingPopupExtracted = {
  captured: boolean;
  screenshot_url: string | null;
  extracted_copy: { headline: string; subhead: string; cta: string };
  extracted_structure: { trigger_guess: string; fields: string[]; layout: string };
};

export type ComputedStyles = {
  colors_in_use: string[];
  font_stack: string[];
  common_border_radius: string;
};

export type AnalyticsVariant = {
  variant_id: string;
  test_axis: TestAxis | null;
  config: Record<string, unknown>;
  impressions: number;
  conversion_rate: number;
  dismiss_rate: number;
  significance_flag: SignificanceFlag;
};

export type PopupGenerationInput = {
  store: {
    domain: string;
    category: string;
    screenshot_urls: string[];
    computed_styles: ComputedStyles;
  };
  existing_popup: ExistingPopupExtracted;
  brand_tokens: BrandTokens;
  analytics: { variants: AnalyticsVariant[] };
  constraints: { variant_count: number; multivariate: boolean };
};

export type PopupDiagnosis = {
  lever: TestAxis;
  change: string;
  reason: string;
};

export type PopupSpec = {
  trigger: string;
  frequency_cap: string;
  headline: string;
  subhead: string;
  cta: string;
  fields: string[];
  design_tokens: { palette: string[]; type_display: string; type_body: string };
};

export type BaselineOutput = {
  popup_id: string;
  diagnosis: PopupDiagnosis[];
  spec: PopupSpec;
  code: string;
};

export type VariantOutput = {
  variant_id: string;
  test_axis: TestAxis;
  hypothesis: string;
  motivating_metric: string;
  diff_from_baseline: string;
  code: string;
  spec: PopupSpec;
};

export type PopupGenerationOutput = {
  mode: "IMPROVE_EXISTING" | "CREATE_NEW";
  baseline: BaselineOutput;
  variants: VariantOutput[];
  tracking_events: {
    shown: "asmos_popup_shown";
    dismissed: "asmos_popup_dismissed";
    converted: "asmos_popup_converted";
  };
};

// ─── System Prompt ────────────────────────────────────────────────────────────

const POPUP_GENERATION_SYSTEM_PROMPT = `You are Asmos's popup design engine. You receive structured data about a
single e-commerce store and return either an improved popup, a new popup,
plus a set of test variants. Follow this decision logic exactly, in order.

CRITICAL CONSTRAINTS (never break these):
- brand_tokens.palette are LOCKED across baseline and every variant. Never invent, substitute, or omit brand colors.
- Every variant MUST change exactly ONE test_axis from the baseline (unless constraints.multivariate is true).
- brand_tokens (palette, type_display, type_body, signature_element) are NEVER a test axis.
- Return ONLY valid JSON matching the output schema. No prose, no markdown fences, no explanation outside the JSON.
- The "code" field must be a complete self-contained HTML string with inline styles that renders the popup correctly — brand colors, typography, copy — in an isolated div. Include a close button with id="asmos-close".

MODE DETECTION
- existing_popup.captured == true  -> IMPROVE_EXISTING
- existing_popup.captured == false -> CREATE_NEW

IMPROVE_EXISTING
- Treat existing_popup as ground truth for current brand voice and layout. Do not redesign from scratch.
- Diagnose weaknesses against these levers, ranked by typical conversion impact, highest first:
  (1) trigger type/timing, (2) field count/friction, (3) offer framing and copy,
  (4) visual hierarchy, (5) micro-details (button size, color, corner radius).
- Change only what you diagnosed as weak. Preserve what's already working and the visual equity it has with returning visitors.
- Output the improved baseline plus a diagnosis list: what changed, which lever it targets, and why.

CREATE_NEW
- Use brand_tokens as ground truth for palette, type, and signature element. Never invent a palette when brand_tokens are supplied.
- Infer likely offer type from store.category:
  fashion/beauty -> first-order percentage discount
  home goods -> free shipping threshold
  food/beverage -> first-order flat discount
  high-ticket/luxury -> value proposition (no cheap discounts)
  default -> 10-15% first order discount
- Default trigger: exit-intent on desktop, 60% scroll-depth fallback on mobile.
  Override if store.category or price point suggests longer consideration window
  (high-ticket items -> time-delay over exit-intent).
- Output one baseline popup: full spec plus self-contained HTML code.
- diagnosis array must be empty for CREATE_NEW mode.

VARIANT GENERATION (always runs, after IMPROVE_EXISTING or CREATE_NEW)
- If analytics.variants is non-empty:
  - Read each variant's significance_flag. Never re-test a test_axis marked "conclusive" unless explicitly instructed via constraints.
  - Identify the highest-leverage axis (see ranked list above) that is either "inconclusive" or entirely untested.
  - Generate variants against that axis. Each variant must cite the specific metric that motivated it in motivating_metric.
- If analytics.variants is empty (cold start):
  - Use the ranked default order: trigger/timing -> friction -> copy/offer framing -> layout -> visual/micro-details.
  - Generate exactly constraints.variant_count variants (0 = no variants, only baseline).
  - Each variant isolates ONE axis change from the baseline.
- motivating_metric must be in plain language for a store owner's dashboard, e.g.:
  "removed the name field — email-only variant is converting 34% higher after 1,200 impressions"
  or "cold_start_default_priority" if no data yet.

POPUP CODE REQUIREMENTS
The "code" field must be a complete self-contained HTML string:
- Outer wrapper: <div id="asmos-popup" style="..."> with fixed/absolute positioning, z-index 99999
- Close button: <button id="asmos-close" ...> in top-right corner
- Use brand_tokens.palette[0] as primary CTA button background
- Use brand_tokens.palette for all accent colors
- Email input with id="asmos-email-input"
- CTA button with id="asmos-cta-btn"
- Mobile-responsive (max-width: 360px, centered)
- No external font dependencies — use system font stack from brand_tokens.type_body or safe fallback
- Stunning, premium design that will wow visitors on first glance
- Include subtle micro-animation on the popup entrance: transform scale from 0.96 to 1.0`;

// ─── Output Schema (tool call) ────────────────────────────────────────────────

const popupSpecSchema = {
  type: "object",
  properties: {
    trigger: { type: "string" },
    frequency_cap: { type: "string" },
    headline: { type: "string" },
    subhead: { type: "string" },
    cta: { type: "string" },
    fields: { type: "array", items: { type: "string" } },
    design_tokens: {
      type: "object",
      properties: {
        palette: { type: "array", items: { type: "string" } },
        type_display: { type: "string" },
        type_body: { type: "string" },
      },
      required: ["palette", "type_display", "type_body"],
      additionalProperties: false,
    },
  },
  required: ["trigger", "frequency_cap", "headline", "subhead", "cta", "fields", "design_tokens"],
  additionalProperties: false,
} as const;

const popupOutputSchema = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["IMPROVE_EXISTING", "CREATE_NEW"] },
    baseline: {
      type: "object",
      properties: {
        popup_id: { type: "string" },
        diagnosis: {
          type: "array",
          items: {
            type: "object",
            properties: {
              lever: { type: "string", enum: ["trigger", "friction", "copy", "layout", "visual"] },
              change: { type: "string" },
              reason: { type: "string" },
            },
            required: ["lever", "change", "reason"],
            additionalProperties: false,
          },
        },
        spec: popupSpecSchema,
        code: { type: "string" },
      },
      required: ["popup_id", "diagnosis", "spec", "code"],
      additionalProperties: false,
    },
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          variant_id: { type: "string" },
          test_axis: { type: "string", enum: ["trigger", "friction", "copy", "layout", "visual"] },
          hypothesis: { type: "string" },
          motivating_metric: { type: "string" },
          diff_from_baseline: { type: "string" },
          code: { type: "string" },
          spec: popupSpecSchema,
        },
        required: ["variant_id", "test_axis", "hypothesis", "motivating_metric", "diff_from_baseline", "code", "spec"],
        additionalProperties: false,
      },
    },
    tracking_events: {
      type: "object",
      properties: {
        shown: { type: "string" },
        dismissed: { type: "string" },
        converted: { type: "string" },
      },
      required: ["shown", "dismissed", "converted"],
      additionalProperties: false,
    },
  },
  required: ["mode", "baseline", "variants", "tracking_events"],
  additionalProperties: false,
} as const;

const GENERATE_POPUP_TOOL: Anthropic.Tool = {
  name: "generate_popup",
  description:
    "Generate a complete popup design with baseline and test variants for an e-commerce store. Always call this — it is the only output format accepted.",
  input_schema: popupOutputSchema as unknown as Anthropic.Tool.InputSchema,
  strict: true,
};

// ─── Significance Flag ────────────────────────────────────────────────────────

const MIN_SAMPLE_FOR_SIGNIFICANCE = 100;

export function computeSignificanceFlag(
  control: { impressions: number; conversions: number },
  variant: { impressions: number; conversions: number },
): SignificanceFlag {
  if (control.impressions < MIN_SAMPLE_FOR_SIGNIFICANCE || variant.impressions < MIN_SAMPLE_FOR_SIGNIFICANCE) {
    return "insufficient_data";
  }
  const confidence = confidenceVsControl(
    { impressions: control.impressions, conversions: control.conversions },
    { impressions: variant.impressions, conversions: variant.conversions },
  );
  if (confidence === null) return "insufficient_data";
  // 95% confidence threshold for "conclusive"
  if (confidence >= 95 || confidence <= 5) return "conclusive";
  return "inconclusive";
}

// ─── PostHog Analytics Fetch (falls back to Postgres) ────────────────────────

export async function fetchVariantAnalytics(campaignId: string): Promise<AnalyticsVariant[]> {
  // Prefer PostHog query API if configured
  if (POSTHOG_PERSONAL_API_KEY && POSTHOG_PROJECT_ID) {
    try {
      return await fetchFromPostHog(campaignId);
    } catch (err) {
      console.warn("[popupGeneration] PostHog query failed, falling back to Postgres:", err);
    }
  }
  // Fallback: aggregate from Postgres CampaignEvent table
  return fetchFromPostgres(campaignId);
}

async function fetchFromPostHog(campaignId: string): Promise<AnalyticsVariant[]> {
  // Use PostHog Events API to aggregate asmos_popup_* events per variant
  const query = {
    query: {
      kind: "HogQLQuery",
      query: `
        SELECT
          properties.variant_id AS variant_id,
          countIf(event = 'asmos_popup_shown') AS impressions,
          countIf(event = 'asmos_popup_converted') AS conversions,
          countIf(event = 'asmos_popup_dismissed') AS dismissals
        FROM events
        WHERE
          properties.campaign_id = '${campaignId}'
          AND event IN ('asmos_popup_shown', 'asmos_popup_converted', 'asmos_popup_dismissed')
          AND timestamp > now() - interval 90 day
        GROUP BY variant_id
      `,
    },
  };

  const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`PostHog query failed: ${res.status}`);
  const data = await res.json();

  const rows: Array<[string, number, number, number]> = data.results ?? [];
  if (rows.length === 0) return [];

  // Find control variant stats for significance computation
  const controlVariant = await prisma.variant.findFirst({
    where: { campaignId, isControl: true },
    select: { id: true },
  });

  const controlRow = rows.find(([vid]) => vid === controlVariant?.id);
  const controlImpressions = controlRow?.[1] ?? 0;
  const controlConversions = controlRow?.[2] ?? 0;

  // Fetch variant metadata (testAxis etc.) from Postgres
  const variants = await prisma.variant.findMany({
    where: { campaignId },
    select: { id: true, testAxis: true, design: true },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  return rows.map(([variant_id, impressions, conversions, dismissals]) => {
    const v = variantMap.get(variant_id) as { id: string; testAxis: string | null; design: unknown } | undefined;
    const conversion_rate = impressions > 0 ? conversions / impressions : 0;
    const dismiss_rate = impressions > 0 ? dismissals / impressions : 0;
    const significance_flag = computeSignificanceFlag(
      { impressions: controlImpressions, conversions: controlConversions },
      { impressions, conversions },
    );
    return {
      variant_id,
      test_axis: (v?.testAxis ?? null) as TestAxis | null,
      config: (v?.design ?? {}) as Record<string, unknown>,
      impressions,
      conversion_rate,
      dismiss_rate,
      significance_flag,
    };
  });
}

async function fetchFromPostgres(campaignId: string): Promise<AnalyticsVariant[]> {
  const variants = await prisma.variant.findMany({
    where: { campaignId, status: { not: "ELIMINATED" } },
    select: {
      id: true,
      testAxis: true,
      design: true,
      isControl: true,
      events: { select: { type: true } },
    },
  });

  if (variants.length === 0) return [];

  const controlVariant = variants.find((v) => v.isControl);
  const controlImpressions = controlVariant?.events.filter((e) => e.type === "IMPRESSION").length ?? 0;
  const controlConversions = controlVariant?.events.filter((e) => e.type === "SUBMISSION").length ?? 0;

  return variants.map((v) => {
    const impressions = v.events.filter((e: { type: string }) => e.type === "IMPRESSION").length;
    const conversions = v.events.filter((e: { type: string }) => e.type === "SUBMISSION").length;
    const dismissals = v.events.filter((e: { type: string }) => e.type === "DISMISSED").length;
    const conversion_rate = impressions > 0 ? conversions / impressions : 0;
    const dismiss_rate = impressions > 0 ? dismissals / impressions : 0;
    const significance_flag = computeSignificanceFlag(
      { impressions: controlImpressions, conversions: controlConversions },
      { impressions, conversions },
    );
    return {
      variant_id: v.id,
      test_axis: (v.testAxis ?? null) as TestAxis | null,
      config: (v.design ?? {}) as Record<string, unknown>,
      impressions,
      conversion_rate,
      dismiss_rate,
      significance_flag,
    };
  });
}

// ─── Input Builder ────────────────────────────────────────────────────────────

export function buildPopupInput(opts: {
  domain: string;
  category: string;
  brandTokens: BrandTokens;
  existingPopup: ExistingPopupExtracted;
  computedStyles: ComputedStyles;
  analyticsVariants: AnalyticsVariant[];
  variantCount: number;
  multivariate?: boolean;
}): PopupGenerationInput {
  return {
    store: {
      domain: opts.domain,
      category: opts.category,
      screenshot_urls: [],
      computed_styles: opts.computedStyles,
    },
    existing_popup: opts.existingPopup,
    brand_tokens: opts.brandTokens,
    analytics: { variants: opts.analyticsVariants },
    constraints: {
      variant_count: opts.variantCount,
      multivariate: opts.multivariate ?? false,
    },
  };
}

// ─── Generation — Claude Haiku ────────────────────────────────────────────────

async function generateWithClaude(input: PopupGenerationInput): Promise<PopupGenerationOutput> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    system: POPUP_GENERATION_SYSTEM_PROMPT,
    tools: [GENERATE_POPUP_TOOL],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `Generate a popup design for this store. Return the result by calling generate_popup.\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "generate_popup",
  );

  if (!toolUse) {
    throw new Error("[popupGeneration] Claude did not call generate_popup tool");
  }

  return toolUse.input as PopupGenerationOutput;
}

// ─── Generation — Gemini fallback ────────────────────────────────────────────

async function generateWithGemini(input: PopupGenerationInput): Promise<PopupGenerationOutput> {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${POPUP_GENERATION_SYSTEM_PROMPT}\n\nGenerate a popup design for this store. Return the result by calling generate_popup.\n\n${JSON.stringify(input, null, 2)}`,
          },
        ],
      },
    ],
    config: {
      tools: [
        {
          functionDeclarations: [
            {
              name: "generate_popup",
              description:
                "Generate a complete popup design with baseline and test variants for an e-commerce store.",
              parametersJsonSchema: popupOutputSchema,
            },
          ],
        },
      ],
    },
  });

  const call = response.functionCalls?.find((c) => c.name === "generate_popup");
  if (!call) {
    // Try parsing text as JSON fallback
    const text = response.text ?? "";
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const jsonStr = text.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr) as PopupGenerationOutput;
      } catch (err) {
        throw new Error(`[popupGeneration] Failed to parse fallback JSON: ${(err as Error).message}`);
      }
    }
    throw new Error("[popupGeneration] Gemini did not return generate_popup call");
  }

  return call.args as PopupGenerationOutput;
}

// ─── Generation — Bedrock (primary when AWS keys present) ────────────────────

async function generateWithBedrock(input: PopupGenerationInput): Promise<PopupGenerationOutput> {
  const client = new BedrockRuntimeClient({ region: AWS_REGION });

  // Bedrock uses the same Anthropic message format but via InvokeModel
  const bedrockBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8000,
    system: POPUP_GENERATION_SYSTEM_PROMPT,
    tools: [GENERATE_POPUP_TOOL],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `Generate a popup design for this store. Return the result by calling generate_popup.\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  };

  const cmd = new InvokeModelCommand({
    modelId: BEDROCK_MODEL,
    body: new TextEncoder().encode(JSON.stringify(bedrockBody)),
    contentType: "application/json",
    accept: "application/json",
  });

  const raw = await client.send(cmd);
  const response = JSON.parse(new TextDecoder().decode(raw.body)) as {
    content: Array<{ type: string; name?: string; input?: unknown }>;
  };

  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === "generate_popup",
  );

  if (!toolUse) {
    throw new Error("[popupGeneration] Bedrock did not call generate_popup tool");
  }

  return toolUse.input as PopupGenerationOutput;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function generatePopupWithVariants(
  input: PopupGenerationInput,
): Promise<PopupGenerationOutput> {
  // Provider priority: Bedrock (AWS) → Anthropic direct → Gemini
  if (HAS_AWS_KEY) {
    return generateWithBedrock(input);
  }
  if (HAS_ANTHROPIC_KEY) {
    return generateWithClaude(input);
  }
  return generateWithGemini(input);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive sensible brand tokens from the data /api/analyze already returns. */
export function brandTokensFromAnalyzeResult(result: {
  brandColor?: string;
  brandTokens?: BrandTokens;
  computedStyles?: ComputedStyles;
  storeName?: string;
  industry?: string;
}): BrandTokens {
  if (result.brandTokens) return result.brandTokens;

  const primaryColor = result.brandColor ?? "#165DFF";
  return {
    palette: [primaryColor],
    type_display: "system-ui, -apple-system, sans-serif",
    type_body: "system-ui, -apple-system, sans-serif",
    imagery_style: "clean and minimal",
    signature_element_suggestion: "subtle brand accent bar at popup top",
  };
}

export function computedStylesFromAnalyzeResult(result: {
  computedStyles?: ComputedStyles;
  brandColor?: string;
}): ComputedStyles {
  if (result.computedStyles) return result.computedStyles;
  return {
    colors_in_use: result.brandColor ? [result.brandColor] : ["#165DFF"],
    font_stack: ["system-ui", "-apple-system", "sans-serif"],
    common_border_radius: "8px",
  };
}

export function existingPopupFromAnalyzeResult(result: {
  existingPopup?: ExistingPopupExtracted;
  popup?: { found: boolean; description: string };
}): ExistingPopupExtracted {
  if (result.existingPopup) return result.existingPopup;
  const captured = result.popup?.found ?? false;
  return {
    captured,
    screenshot_url: null,
    extracted_copy: { headline: "", subhead: "", cta: "" },
    extracted_structure: {
      trigger_guess: captured ? "unknown" : "none",
      fields: captured ? ["email"] : [],
      layout: captured ? result.popup?.description ?? "unknown" : "none",
    },
  };
}
