// @ts-expect-error
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
import { formatImageLibraryForPrompt, isLibraryImage, UNSERVED_STORE_TYPES } from "@/lib/imageLibrary";
import { normalizeIndustry, type ScrapedPopupDesign } from "@/lib/popupScraping";
import {
  dnaFingerprint,
  normalizeDna,
  popupDnaJsonSchema,
  type PopupDna,
  type CornerRadius,
} from "@/lib/popupDna";
import {
  briefToPromptSection,
  enforceBrief,
  type DesignBrief,
} from "@/lib/designBrief";
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
const AWS_REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-north-1";
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

export type FunnelStepCount = {
  step: string; // e.g. "2" (teaser -> capture) or "email_field_focus"
  count: number;
};

export type AnalyticsVariant = {
  variant_id: string;
  test_axis: TestAxis | null;
  config: Record<string, unknown>;
  impressions: number;
  conversion_rate: number;
  dismiss_rate: number;
  significance_flag: SignificanceFlag;
  // Added for the AI popup variation roadmap (Phase 0/2): how long people
  // took to give up (null if no dismissals with timing data yet), and how
  // far they got through the popup's own funnel before dropping off — the
  // detail that turns "conversion is low" into "people open it but never
  // reach the email field" or "they focus the email field, then leave."
  avg_dismiss_after_ms: number | null;
  funnel: FunnelStepCount[];
  // Interaction-level telemetry (see lib/templates/runtime.ts). This is the
  // layer that distinguishes "the offer is weak" from "they cannot find the
  // email field" — conversion rate alone cannot tell those apart, which is
  // why the AI previously had nothing useful to learn from.
  ux: UxSignals;
  // Pre-classified from the fields above (see classifyFailurePatterns) so the
  // model doesn't have to re-derive the same heuristic on every call.
  failure_patterns: FailurePattern[];
};

export type UxSignals = {
  /** Sessions that clicked something non-interactive inside the popup. */
  dead_click_sessions: number;
  /** Sessions that clicked the same area repeatedly in frustration. */
  rage_click_sessions: number;
  /** Sessions that focused the email field, typed nothing, and left. */
  field_abandon_sessions: number;
  /** Sessions that hovered a CTA for a while without clicking it. */
  cta_hesitation_sessions: number;
  /** Median ms from popup open to first keystroke, across sessions that typed. */
  median_time_to_first_keystroke_ms: number | null;
  /** Sessions with any measured interaction summary at all. */
  sessions_with_signals: number;
};

const EMPTY_UX: UxSignals = {
  dead_click_sessions: 0,
  rage_click_sessions: 0,
  field_abandon_sessions: 0,
  cta_hesitation_sessions: 0,
  median_time_to_first_keystroke_ms: null,
  sessions_with_signals: 0,
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
  constraints: {
    variant_count: number;
    multivariate: boolean;
    max_discount_percent: number;
    // Merchant's own choice at campaign creation (see NewCampaignForm.tsx's
    // "What's the offer?" question) — "ai_choice" (default) lets the model
    // pick per the CREATE_NEW category-inference rules; the others pin the
    // offer type/amount so the model writes copy around it instead of
    // inventing its own discount.
    offer_preference: {
      type: "ai_choice" | "percentage" | "free_shipping" | "fixed_prize";
      fixed_prize_description?: string;
    };
  };
  goal: "EMAIL" | "DISCOUNT" | "BOTH";
  /**
   * Two-tier variant policy (see the VARIANT DIVERGENCE POLICY section of the
   * system prompt). "explore" while the campaign is still cold — variants are
   * supposed to look substantially different so we learn which region of the
   * design space this store responds to. "exploit" once real traffic has
   * produced a leader — variants differ by one knob so a delta is attributable.
   */
  testing_mode: "explore" | "exploit";
  /**
   * What this account has already been shown. Passed as an explicit
   * do-not-repeat list: the single most common failure of an AI popup tool is
   * generating the same popup for every campaign, which reads to the merchant
   * as the AI doing nothing at all.
   */
  novelty: {
    recent_headlines: string[];
    recent_fingerprints: string[];
  };
  // ISO date (YYYY-MM-DD), computed fresh per call (see buildPopupInput) —
  // NOT baked into the static system prompt, which is a module-level
  // constant evaluated once at process start and would otherwise go stale.
  // Referenced by the CONTENT & COMPLIANCE GUARDRAILS section to keep
  // seasonal/holiday copy from firing outside its actual window.
  current_date: string;
};

export type PopupDiagnosis = {
  lever: TestAxis;
  change: string;
  reason: string;
};

export type TemplateId = "split-screen" | "corner-toast" | "fullscreen-takeover";

export type PopupSpec = {
  trigger: string;
  delay_seconds: number | null;
  frequency_cap: string;
  headline: string;
  subhead: string;
  cta: string;
  fields: string[];
  coupon_code: string;
  // Structured discount amount, decoupled from freeform copy so it can
  // actually be validated/clamped server-side (see applyContentGuardrails)
  // instead of relying on regex-scraping "20%" out of a headline. Null when
  // the popup isn't offering a percentage discount (e.g. goal="EMAIL", or a
  // free-shipping/fixed-amount/gift-card offer instead).
  discount_percent: number | null;
  // Which physical template renders this spec (see lib/templates/index.ts).
  // Added for the AI popup variation roadmap (Phase 3) — previously every
  // popup used the same split-screen template regardless of what the AI
  // chose, with layout_style only varying its CSS within that one skeleton.
  template_id: TemplateId;
  layout_style: "split-left" | "split-right" | "centered" | "minimal";
  image_url: string | null;
  design_tokens: { palette: string[]; type_display: string; type_body: string };
  /**
   * The ~30 composable design knobs (see lib/popupDna.ts) that decide what the
   * popup actually looks like: timer, eyebrow, step flow, density, theme,
   * button treatment, form layout, and every word of the non-headline copy.
   *
   * Before this existed, all of those were string literals hardcoded inside
   * the template files, which is why every campaign and every variant rendered
   * the identical "Limited Time Offer" card with a 10:00 countdown no matter
   * what the model produced.
   */
  dna: PopupDna;
};

export type BaselineOutput = {
  popup_id: string;
  diagnosis: PopupDiagnosis[];
  spec: PopupSpec;
};

export type VariantOutput = {
  variant_id: string;
  test_axis: TestAxis;
  hypothesis: string;
  motivating_metric: string;
  diff_from_baseline: string;
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
- Never write HTML. The server renders the popup from your JSON spec using the template named by template_id.

CONTENT & COMPLIANCE GUARDRAILS (never break these — enforced server-side too, but get it right here first):
- Never suggest, imply, or offer anything illegal, regulated, or inappropriate as a discount, prize, or
  reward — no prescription/controlled substances, no weapons/firearms/ammunition/explosives, no alcohol or
  tobacco as a giveaway, no adult content. Rewards must always be standard e-commerce fare: a percentage or
  fixed discount, free shipping, a gift card, or the store's own merchandise.
- Never mention a real third-party brand, franchise, character, or copyrighted property that isn't the
  store's own — don't borrow recognizable IP to make an offer sound bigger than it is.
- Today's date is given at the very top of the user message (as current_date). Only reference a seasonal or
  holiday moment (Christmas, Black Friday, back-to-school, summer sale, etc.) if it is genuinely near in
  time to current_date — never write "Christmas" copy in the middle of summer or "summer sale" copy in
  winter. If in doubt, skip the seasonal framing entirely and write an evergreen offer instead.
- \`discount_percent\` (see POPUP DESIGN REQUIREMENTS) must never exceed constraints.max_discount_percent.
  This is a hard ceiling, not a suggestion — if you're tempted to write a bigger number for impact, cap it
  at constraints.max_discount_percent instead and let the framing (urgency, exclusivity, first-order-only)
  do the persuasive work.

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
- Check constraints.offer_preference first — this is the merchant's own explicit choice, and overrides the
  category-inference below whenever it isn't "ai_choice":
  - "percentage": write a percentage discount (respecting max_discount_percent). Set discount_percent accordingly.
  - "free_shipping": the offer IS free shipping — do not also invent a percentage discount. discount_percent = null.
  - "fixed_prize": the offer is constraints.offer_preference.fixed_prize_description verbatim (a gift card,
    a specific product, a fixed-dollar credit, etc.) — write copy around exactly that, don't reinterpret it
    as a percentage. discount_percent = null unless the merchant's description itself states a percentage.
  - "ai_choice" (default): infer likely offer type from store.category:
    fashion/beauty -> first-order percentage discount
    home goods -> free shipping threshold
    food/beverage -> first-order flat discount
    high-ticket/luxury -> value proposition (no cheap discounts)
    default -> 10-15% first order discount
- Default trigger: exit-intent on desktop, 60% scroll-depth fallback on mobile.
  Override if store.category or price point suggests longer consideration window
  (high-ticket items -> time-delay over exit-intent).
- Choose a layout_style and image treatment (see POPUP BLUEPRINT below) that fits the store's category and
  existing brand — this is what makes each store's popup feel different from the last one you generated.
- Output one baseline popup: full spec plus self-contained HTML code.
- diagnosis array must be empty for CREATE_NEW mode.

VARIANT GENERATION (always runs, after IMPROVE_EXISTING or CREATE_NEW)
- If analytics.variants is non-empty:
  - Read each variant's significance_flag. Never re-test a test_axis marked "conclusive" unless explicitly instructed via constraints.
  - Identify the highest-leverage axis (see ranked list above) that is either "inconclusive" or entirely untested.
  - Generate variants against that axis. Each variant must cite the specific metric that motivated it in motivating_metric.
  - READING BEHAVIORAL DETAIL (failure_patterns, funnel, avg_dismiss_after_ms): conversion_rate and
    dismiss_rate alone only tell you THAT something is failing, not WHY. Use the richer fields to pick
    a more precise fix within whichever axis you've already identified as highest-leverage:
    - "low_offer_appeal" (few people engage with the popup at all beyond it appearing) -> points at
      trigger axis (wrong moment/too easy to ignore) or copy axis (headline/offer isn't compelling) —
      prefer whichever the funnel array suggests: near-zero engagement at any step points at trigger;
      some engagement but stalling immediately after points at copy.
    - "form_friction" (people reach the email field but don't convert) -> friction axis: cut fields,
      question whether goal=BOTH's two-step flow is adding friction rather than reducing it here.
    - "premature_dismissal" (avg_dismiss_after_ms is low and dismiss_rate is high) -> trigger axis:
      the popup is very likely firing at the wrong moment or feels intrusive — test a later/gentler
      trigger before touching copy or layout.
    - "cant_find_the_cta" (visitors click parts of the popup that aren't clickable) -> the
      button doesn't read as a button, or the wrong element looks primary. Change
      dna.button_fill / dna.button_shape / dna.accent_placement so the action is unmistakable,
      and cut competing visual weight. This is a layout/visual fix, never a copy fix.
    - "interaction_rage" (repeated clicking in the same spot) -> something is being perceived
      as broken or unresponsive. Simplify the step: prefer dna.step_flow "one_step", remove
      any element that looks interactive but isn't.
    - "field_abandonment" (they focus the email field, type nothing, leave) -> the ask itself
      is the blocker, not the offer. Reduce it: dna.privacy_note reassurance, a warmer
      dna.email_placeholder, dna.show_field_label true so the field is unambiguous, and make
      sure the reward is restated next to the field rather than only on the previous step.
    - "cta_hesitation" (long hover, no click) -> they read the button and weren't convinced.
      This IS a copy problem: rewrite the CTA and the value restatement around it.
    - "slow_to_engage" (long delay before the first keystroke) -> too much to read before
      acting. Cut words, raise dna.type_scale, lower dna.density.
    - "insufficient_data" -> fall back to the cold-start ranked order below; don't over-fit to noise.
    - Prefer citing a failure_pattern + its concrete evidence in motivating_metric over a bare
      percentage — that's the difference between "this is what's happening" and "this is why."
- If analytics.variants is empty (cold start):
  - Use the ranked default order: trigger/timing -> friction -> copy/offer framing -> layout -> visual/micro-details.
  - Generate exactly constraints.variant_count variants (0 = no variants, only baseline).
  - Each variant isolates ONE axis change from the baseline.
- VARIANT DIVERGENCE POLICY (read testing_mode in the input — this replaces the old
  "always isolate exactly one axis" rule, which produced variant sets that were
  visually interchangeable and therefore untestable in practice):
  - testing_mode == "explore" (cold start, no meaningful traffic yet): every variant gets
    its OWN design brief and is SUPPOSED to look substantially different from control —
    different template, different flow, different urgency treatment, different copy angle.
    You are mapping which region of the design space this store responds to, not measuring
    a single knob. Do not try to hold everything else constant; the briefs already differ.
  - testing_mode == "exploit" (a leader has emerged from real data): variants inherit the
    control's brief and differ on exactly ONE knob, which the brief already specifies.
    Keep everything else identical to control so the conversion delta is attributable.
  - Either way: never ship two variants a visitor could not tell apart. If two of your
    specs differ only in delay_seconds or only in a synonym-level copy change, that is a
    wasted arm of the test.
- motivating_metric must be in plain language for a store owner's dashboard, e.g.:
  "62% of visitors who open this popup never reach the email field (form_friction) — testing a
  one-field, no-name variant" or "people who dismiss are gone in under 2s on average (premature_dismissal)
  — testing a later trigger" — cite the behavioral pattern and its evidence, not just a conversion delta.
  Use "cold_start_default_priority" if no data yet.

PSYCHOLOGICAL FOUNDATION (from Asmos's design research — every layout/copy choice below should serve at least one of these)
- Reciprocity: state the gift in the headline before asking for anything — "you've got 10% off" framing, not a generic "join us."
- Loss aversion: frame the offer as something to lose ("your discount expires"), not only something to gain — loses roughly twice as strong as an equivalent gain, psychologically.
- Scarcity: only claim urgency that is real (genuine first-order-only, genuine time limits) — fabricated countdowns produce a short-term lift and a lasting trust penalty once visitors notice the timer never actually runs out.
- Commitment & consistency: for goal "BOTH", the two-step teaser→capture flow converts better than a single flat form because the first CTA click is a free micro-yes that makes the email ask feel like a natural next step, not a cold request — write the teaser headline as an invitation to claim something already earned.
- Every additional required form field costs roughly 10-15% conversion — default to email-only unless there's a specific reason for more.

DESIGN BRIEFS (THE MOST IMPORTANT SECTION — READ IT BEFORE WRITING ANYTHING)
Each popup you are asked for comes with its own DESIGN BRIEF at the end of the user
message. The brief pre-selects the structural and visual choices — template, layout,
step flow, urgency treatment, theme, density, button treatment, form layout, and the
copy angle and voice. Those choices are re-applied server-side after you respond, so a
brief you ignore does not become a popup you designed; it becomes a popup whose copy no
longer matches its own structure.

Your job is NOT to pick the structure. Your job is to write copy and fill in the
remaining DNA so that the given structure works as well as it possibly can.

- Populate the \`dna\` object on every spec. Every field is required.
- Honour every "REQUIRED STRUCTURE" line in the brief exactly.
- The brief tells you whether to write an eyebrow, a social proof line, a privacy note,
  and an opt-out link. "null" means the element is not rendered at all — do not write a
  placeholder, and do not write "none" as a string.
- \`capture_headline\`/\`capture_subhead\`/\`capture_cta\`, \`reveal_*\` and \`success_*\` are
  the copy for the later steps. Write them properly. They are shown to real visitors.
  Do NOT fall back on "Almost there" or "Your code is ready" — those were the old
  hardcoded strings and they are the single most repetitive thing in the product.

BANNED PHRASES (these are what every popup used to say — never write them again):
- "Limited Time Offer", "Limited Time", "Don't Miss Out", "Wait!", "Hold On!"
- "Get 15% Off Your First Order" and every "Get N% Off Your First Order" variant
- "Enter your email below to unlock your exclusive discount code"
- "Claim My 15% Off", "Claim My Discount", "Almost there"
- "No thanks, I'll pay full price" and any other guilt-trip opt-out
Write something specific to THIS store instead. If your headline would work verbatim for
any other e-commerce store on earth, it is the wrong headline.

NOVELTY
The input includes \`novelty.recent_headlines\` and \`novelty.recent_fingerprints\` —
what this account has already been shown. Do not reproduce, lightly reword, or
structurally clone any of them. This is a hard requirement, not a stylistic preference:
a merchant who sees the same popup twice concludes the AI does nothing.

IMAGERY
- Set \`image_url\` to ONE exact URL from the library below. Each entry lists what is
  actually IN the photograph — choose on the description, not on the category heading.
  Do not invent an Unsplash URL — a fabricated photo ID will 404, and any URL not in
  this list is discarded server-side.
- Set it to null when the brief's \`dna.image_treatment\` is "none".
- **Default to null.** An image is only worth including when the photo's own subject
  would look deliberate on this specific store's site. A picture that merely shares a
  category with the store is worse than no picture: it tells the visitor the popup was
  assembled by a machine that has never seen the shop. The popup renders well without
  one, so when in doubt, null.
- This library CANNOT serve the following store types. For any of them, image_url MUST
  be null — there is no acceptable substitute, only a wrong one:
${UNSERVED_STORE_TYPES.map((t) => `    · ${t}`).join("\n")}
- Vary which exact image you pick across variants and generations rather than always
  reaching for the first one listed in a category:
${formatImageLibraryForPrompt()}

TRIGGERS
- Assign an integer to \`delay_seconds\` if the trigger involves time (e.g. 5, 10, 15).
  Leave it null for purely exit-intent or scroll-depth triggers.

POPUP DESIGN REQUIREMENTS
You must act as a master conversion copywriter.
Output the exact JSON spec configuring the popup based on the user's explicit goal (which is set in the input JSON).
- If goal is "BOTH": Write a headline offering the discount, subhead asking for email to unlock it, and CTA to submit.
- If goal is "EMAIL": Focus solely on the newsletter/community value. Do not offer a specific % off code. CTA should be "Subscribe".
- If goal is "DISCOUNT": Offer the discount immediately without requiring an email. CTA should be "Copy Code" or "Shop Now".
- headline: Max 6 words, highly compelling.
- subhead: 1 short sentence clarifying.
- cta: Short, action-oriented button text (e.g. "Claim Discount").
- coupon_code: E.g., "WELCOME10" or "FREESHIP". (Leave blank if goal is EMAIL)
- discount_percent: the numeric discount as a plain integer (e.g. 15 for "15% off"), matching whatever
  percentage you reference in headline/subhead/cta. Must never exceed constraints.max_discount_percent
  (see CONTENT & COMPLIANCE GUARDRAILS above). Null if this popup isn't offering a percentage discount.
Do not write any HTML. The server will inject your JSON into the template you chose via template_id.`;

// ─── Output Schema (tool call) ────────────────────────────────────────────────

const popupSpecSchema = {
  type: "object",
  properties: {
    trigger: { type: "string" },
    delay_seconds: { type: ["number", "null"] },
    frequency_cap: { type: "string" },
    headline: { type: "string" },
    subhead: { type: "string" },
    cta: { type: "string" },
    fields: { type: "array", items: { type: "string" } },
    coupon_code: { type: "string" },
    discount_percent: { type: ["number", "null"] },
    template_id: { type: "string", enum: ["split-screen", "corner-toast", "fullscreen-takeover"] },
    layout_style: { type: "string", enum: ["split-left", "split-right", "centered", "minimal"] },
    image_url: { type: ["string", "null"] },
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
    dna: popupDnaJsonSchema,
  },
  required: ["trigger", "delay_seconds", "frequency_cap", "headline", "subhead", "cta", "fields", "coupon_code", "discount_percent", "template_id", "layout_style", "image_url", "design_tokens", "dna"],
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
      },
      required: ["popup_id", "diagnosis", "spec"],
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
          spec: popupSpecSchema,
        },
        required: ["variant_id", "test_axis", "hypothesis", "motivating_metric", "diff_from_baseline", "spec"],
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

// ─── Failure-Pattern Taxonomy (AI popup variation roadmap, Phase 1) ───────────
//
// Turns the raw numbers in AnalyticsVariant into named, human-readable
// diagnoses — the difference between "conversion is low" and "people open it
// but only 1 in 20 ever reach the email field." Deliberately built only from
// signals we actually capture today (funnel steps, dismiss timing). Once
// Phase 1's session recording is enabled for an account, PostHog's own
// rage-click/dead-click events would sharpen "cant_find_or_use_cta" beyond
// this heuristic — that's a natural follow-up once real replay data exists,
// not something to fake from aggregate counts alone.

const MIN_SAMPLE_FOR_PATTERN = 30; // lower bar than significance — these are diagnostic hints, not a/b conclusions

export type FailurePattern =
  | "low_offer_appeal"      // shown a lot, almost nobody engages with the teaser/CTA at all
  | "form_friction"         // people reach the form, but don't complete it
  | "premature_dismissal"   // people close it almost immediately after it appears
  | "cant_find_the_cta"     // dead clicks: they click things that aren't clickable
  | "interaction_rage"      // rage clicks: they believe something is broken
  | "field_abandonment"     // they focus the email field, type nothing, leave
  | "cta_hesitation"        // they hover the button a long time and don't press it
  | "slow_to_engage"        // long delay before the first keystroke
  | "insufficient_data";

// Fraction of measured sessions exhibiting a UX signal before we call it a
// pattern rather than noise. Deliberately generous — these are diagnostic
// hints handed to a model that weighs them, not automated decisions.
const UX_SIGNAL_THRESHOLD = 0.12;
const MIN_SESSIONS_FOR_UX_PATTERN = 20;
const SLOW_FIRST_KEYSTROKE_MS = 12_000;

export function classifyFailurePatterns(v: Omit<AnalyticsVariant, "failure_patterns">): FailurePattern[] {
  if (v.impressions < MIN_SAMPLE_FOR_PATTERN) return ["insufficient_data"];

  const patterns: FailurePattern[] = [];

  const engagedCount = v.funnel.reduce((sum, f) => (f.step !== "1" ? sum + f.count : sum), 0);
  const engagementRate = v.impressions > 0 ? engagedCount / v.impressions : 0;
  const emailFocusCount = v.funnel.find((f) => f.step === "email_field_focus")?.count ?? 0;

  if (v.funnel.length > 0 && engagementRate < 0.1) {
    patterns.push("low_offer_appeal");
  }

  if (emailFocusCount >= MIN_SAMPLE_FOR_PATTERN && v.conversion_rate < 0.1) {
    patterns.push("form_friction");
  }

  if (v.avg_dismiss_after_ms !== null && v.avg_dismiss_after_ms < 2000 && v.dismiss_rate > 0.3) {
    patterns.push("premature_dismissal");
  }

  // ── UX signals ──
  // These are the "silly things" class of problem: nothing is wrong with the
  // offer, the interface is just getting in the way. They're invisible to
  // conversion rate, which is precisely why they went undiagnosed.
  const ux = v.ux ?? EMPTY_UX;
  const n = ux.sessions_with_signals;
  if (n >= MIN_SESSIONS_FOR_UX_PATTERN) {
    const rate = (count: number) => count / n;

    if (rate(ux.dead_click_sessions) > UX_SIGNAL_THRESHOLD) patterns.push("cant_find_the_cta");
    if (rate(ux.rage_click_sessions) > UX_SIGNAL_THRESHOLD / 2) patterns.push("interaction_rage");
    if (rate(ux.field_abandon_sessions) > UX_SIGNAL_THRESHOLD) patterns.push("field_abandonment");
    if (rate(ux.cta_hesitation_sessions) > UX_SIGNAL_THRESHOLD * 1.5) patterns.push("cta_hesitation");
    if (
      ux.median_time_to_first_keystroke_ms !== null &&
      ux.median_time_to_first_keystroke_ms > SLOW_FIRST_KEYSTROKE_MS
    ) {
      patterns.push("slow_to_engage");
    }
  }

  return patterns;
}

// ─── UX signal aggregation ───────────────────────────────────────────────────

type SessionSummary = {
  deadClicks?: number;
  rageClicks?: number;
  abandonedField?: boolean;
  ctaHoverNoClickMs?: number;
  timeToFirstKeystrokeMs?: number | null;
};

const CTA_HESITATION_MS = 2500;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/**
 * Rolls the per-session summaries emitted by the popup runtime (one
 * `INTERACTION` event with `step: "session_summary"` per popup view) into the
 * counts the failure-pattern classifier reads.
 */
export function aggregateUxSignals(summaries: SessionSummary[]): UxSignals {
  if (summaries.length === 0) return EMPTY_UX;

  const keystrokeTimes = summaries
    .map((s) => s.timeToFirstKeystrokeMs)
    .filter((ms): ms is number => typeof ms === "number" && ms >= 0);

  return {
    dead_click_sessions: summaries.filter((s) => (s.deadClicks ?? 0) > 0).length,
    rage_click_sessions: summaries.filter((s) => (s.rageClicks ?? 0) > 0).length,
    field_abandon_sessions: summaries.filter((s) => s.abandonedField === true).length,
    cta_hesitation_sessions: summaries.filter((s) => (s.ctaHoverNoClickMs ?? 0) > CTA_HESITATION_MS).length,
    median_time_to_first_keystroke_ms: median(keystrokeTimes),
    sessions_with_signals: summaries.length,
  };
}

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

async function postHogQuery<T = unknown>(hogql: string): Promise<T[]> {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`PostHog query failed: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []) as T[];
}

async function fetchFromPostHog(campaignId: string): Promise<AnalyticsVariant[]> {
  // Use PostHog Events API to aggregate asmos_popup_* events per variant.
  // avg_dismiss_ms added for the AI popup variation roadmap (Phase 0) —
  // dismiss_after_ms is only present on asmos_popup_dismissed events, so
  // avgIf naturally ignores rows where it's null.
  const rows = await postHogQuery<[string, number, number, number, number | null]>(`
    SELECT
      properties.variant_id AS variant_id,
      countIf(event = 'asmos_popup_shown') AS impressions,
      countIf(event = 'asmos_popup_converted') AS conversions,
      countIf(event = 'asmos_popup_dismissed') AS dismissals,
      avgIf(toFloat(properties.dismiss_after_ms), event = 'asmos_popup_dismissed') AS avg_dismiss_ms
    FROM events
    WHERE
      properties.campaign_id = '${campaignId}'
      AND event IN ('asmos_popup_shown', 'asmos_popup_converted', 'asmos_popup_dismissed')
      AND timestamp > now() - interval 90 day
    GROUP BY variant_id
  `);

  if (rows.length === 0) return [];

  // Funnel-step breakdown: widget_interaction is fired (see
  // /api/widget/events) whenever a template reports a step transition or
  // field-level engagement (funnel_step property). Separate query since it's
  // a different event name/shape than the asmos_popup_* aggregate above.
  let funnelRows: Array<[string, string, number]> = [];
  try {
    funnelRows = await postHogQuery<[string, string, number]>(`
      SELECT
        properties.variant_id AS variant_id,
        properties.funnel_step AS step,
        count() AS n
      FROM events
      WHERE
        properties.campaign_id = '${campaignId}'
        AND event = 'widget_interaction'
        AND properties.funnel_step IS NOT NULL
        AND timestamp > now() - interval 90 day
      GROUP BY variant_id, step
    `);
  } catch (err) {
    console.warn("[popupGeneration] PostHog funnel query failed, continuing without it:", err);
  }
  const funnelByVariant = new Map<string, FunnelStepCount[]>();
  for (const [variantId, step, n] of funnelRows) {
    const list = funnelByVariant.get(variantId) ?? [];
    list.push({ step: String(step), count: n });
    funnelByVariant.set(variantId, list);
  }

  // UX signals always come from Postgres even on the PostHog path: the widget
  // writes every event to CampaignEvent first, and the per-session summary is
  // a nested JSON blob that's far cheaper to aggregate here than in HogQL.
  const uxByVariant = await fetchUxSignalsFromPostgres(campaignId);

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

  return rows.map(([variant_id, impressions, conversions, dismissals, avg_dismiss_ms]) => {
    const v = variantMap.get(variant_id) as { id: string; testAxis: string | null; design: unknown } | undefined;
    const conversion_rate = impressions > 0 ? conversions / impressions : 0;
    const dismiss_rate = impressions > 0 ? dismissals / impressions : 0;
    const significance_flag = computeSignificanceFlag(
      { impressions: controlImpressions, conversions: controlConversions },
      { impressions, conversions },
    );
    const base = {
      variant_id,
      test_axis: (v?.testAxis ?? null) as TestAxis | null,
      config: (v?.design ?? {}) as Record<string, unknown>,
      impressions,
      conversion_rate,
      dismiss_rate,
      significance_flag,
      avg_dismiss_after_ms: typeof avg_dismiss_ms === "number" ? Math.round(avg_dismiss_ms) : null,
      funnel: funnelByVariant.get(variant_id) ?? [],
      ux: uxByVariant.get(variant_id) ?? EMPTY_UX,
    };
    return { ...base, failure_patterns: classifyFailurePatterns(base) };
  });
}

/**
 * Rolls up the popup runtime's per-session summary events into UxSignals per
 * variant. Bounded to the most recent events per campaign so a high-traffic
 * store doesn't turn this into an unbounded scan.
 */
const MAX_SESSION_SUMMARIES_PER_CAMPAIGN = 5000;

async function fetchUxSignalsFromPostgres(campaignId: string): Promise<Map<string, UxSignals>> {
  const rows = await prisma.campaignEvent
    .findMany({
      where: { variant: { campaignId }, type: "INTERACTION" },
      orderBy: { createdAt: "desc" },
      take: MAX_SESSION_SUMMARIES_PER_CAMPAIGN,
      select: { variantId: true, details: true },
    })
    .catch((err: unknown) => {
      // UX signals are diagnostic enrichment; a query failure should degrade
      // the diagnosis, never block a campaign from generating.
      console.warn("[popupGeneration] UX signal query failed, continuing without it:", err);
      return [] as { variantId: string; details: unknown }[];
    });

  // Filtering on the JSON `step` in JS rather than with a Prisma JSON-path
  // predicate: the path filter is provider-specific, and INTERACTION volume
  // is already bounded by the `take` above.
  const byVariant = new Map<string, SessionSummary[]>();
  for (const row of rows) {
    const details = (row.details ?? {}) as SessionSummary & { step?: number | string };
    if (details.step !== "session_summary") continue;
    const list = byVariant.get(row.variantId) ?? [];
    list.push(details);
    byVariant.set(row.variantId, list);
  }

  const out = new Map<string, UxSignals>();
  for (const [variantId, summaries] of byVariant) {
    out.set(variantId, aggregateUxSignals(summaries));
  }
  return out;
}

async function fetchFromPostgres(campaignId: string): Promise<AnalyticsVariant[]> {
  const variants = await prisma.variant.findMany({
    where: { campaignId, status: { not: "ELIMINATED" } },
    select: {
      id: true,
      testAxis: true,
      design: true,
      isControl: true,
      events: { select: { type: true, details: true } },
    },
  });

  if (variants.length === 0) return [];

  const controlVariant = variants.find((v) => v.isControl);
  const controlImpressions = controlVariant?.events.filter((e) => e.type === "IMPRESSION").length ?? 0;
  const controlConversions = controlVariant?.events.filter((e) => e.type === "SUBMISSION").length ?? 0;

  return variants.map((v) => {
    const impressions = v.events.filter((e) => e.type === "IMPRESSION").length;
    const conversions = v.events.filter((e) => e.type === "SUBMISSION").length;
    const dismissedEvents = v.events.filter((e) => e.type === "DISMISSED");
    const dismissals = dismissedEvents.length;
    const conversion_rate = impressions > 0 ? conversions / impressions : 0;
    const dismiss_rate = impressions > 0 ? dismissals / impressions : 0;
    const significance_flag = computeSignificanceFlag(
      { impressions: controlImpressions, conversions: controlConversions },
      { impressions, conversions },
    );

    const dismissTimings = dismissedEvents
      .map((e) => (e.details as { dismissAfterMs?: number } | null)?.dismissAfterMs)
      .filter((ms): ms is number => typeof ms === "number");
    const avg_dismiss_after_ms = dismissTimings.length > 0
      ? Math.round(dismissTimings.reduce((sum, ms) => sum + ms, 0) / dismissTimings.length)
      : null;

    const funnelCounts = new Map<string, number>();
    const sessionSummaries: SessionSummary[] = [];
    for (const e of v.events) {
      if (e.type !== "INTERACTION") continue;
      const details = e.details as (SessionSummary & { step?: number | string }) | null;
      const step = details?.step;
      if (step === undefined || step === null) continue;
      // The per-session summary is a rollup, not a funnel milestone — counting
      // it as a funnel step would double-count every view.
      if (step === "session_summary") {
        sessionSummaries.push(details ?? {});
        continue;
      }
      const key = String(step);
      funnelCounts.set(key, (funnelCounts.get(key) ?? 0) + 1);
    }
    const funnel: FunnelStepCount[] = Array.from(funnelCounts.entries()).map(([step, count]) => ({ step, count }));

    const base = {
      variant_id: v.id,
      test_axis: (v.testAxis ?? null) as TestAxis | null,
      config: (v.design ?? {}) as Record<string, unknown>,
      impressions,
      conversion_rate,
      dismiss_rate,
      significance_flag,
      avg_dismiss_after_ms,
      funnel,
      ux: aggregateUxSignals(sessionSummaries),
    };
    return { ...base, failure_patterns: classifyFailurePatterns(base) };
  });
}

// ─── Input Builder ────────────────────────────────────────────────────────────

// Default cap on any AI-suggested percentage discount when the merchant
// hasn't set their own — not a platform-wide ceiling. Merchants can set
// max_discount_percent to anything they want via the campaign creation
// form's "Percentage off" option (buildPopupInput's maxDiscountPercent);
// whatever they choose (or this default, if they didn't) is what
// applyContentGuardrails enforces server-side against the model's output.
export const DEFAULT_MAX_DISCOUNT_PERCENT = 15;

// Basic sanity bounds on the discount input itself — not a business rule,
// just rejecting nonsensical values (negative, or literally "unlimited%").
const MIN_SANE_DISCOUNT_PERCENT = 1;
const MAX_SANE_DISCOUNT_PERCENT = 100;

export function buildPopupInput(opts: {
  domain: string;
  category: string;
  brandTokens: BrandTokens;
  existingPopup: ExistingPopupExtracted;
  computedStyles: ComputedStyles;
  analyticsVariants: AnalyticsVariant[];
  variantCount: number;
  multivariate?: boolean;
  goal?: "EMAIL" | "DISCOUNT" | "BOTH";
  maxDiscountPercent?: number;
  offerPreference?: {
    type: "ai_choice" | "percentage" | "free_shipping" | "fixed_prize";
    fixedPrizeDescription?: string;
  };
  testingMode?: "explore" | "exploit";
  novelty?: { recentHeadlines?: string[]; recentFingerprints?: string[] };
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
      max_discount_percent: Math.min(
        Math.max(opts.maxDiscountPercent ?? DEFAULT_MAX_DISCOUNT_PERCENT, MIN_SANE_DISCOUNT_PERCENT),
        MAX_SANE_DISCOUNT_PERCENT,
      ),
      offer_preference: {
        type: opts.offerPreference?.type ?? "ai_choice",
        fixed_prize_description: opts.offerPreference?.fixedPrizeDescription,
      },
    },
    goal: opts.goal ?? "BOTH",
    testing_mode: opts.testingMode ?? (opts.analyticsVariants.length > 0 ? "exploit" : "explore"),
    novelty: {
      recent_headlines: opts.novelty?.recentHeadlines ?? [],
      recent_fingerprints: opts.novelty?.recentFingerprints ?? [],
    },
    current_date: new Date().toISOString().slice(0, 10),
  };
}

// ─── Novelty memory ──────────────────────────────────────────────────────────

const NOVELTY_LOOKBACK = 25;

/**
 * The headlines and structural fingerprints this account has already seen.
 *
 * Fed to the model as a do-not-repeat list, and to the design-brief sampler as
 * fingerprints to steer away from. The sampler is the guarantee; the prompt is
 * the polish (it stops near-duplicate *copy*, which the sampler can't see).
 */
export async function fetchNoveltyMemory(accountId: string): Promise<{
  recentHeadlines: string[];
  recentFingerprints: string[];
}> {
  try {
    const variants = await prisma.variant.findMany({
      where: { campaign: { accountId } },
      orderBy: { createdAt: "desc" },
      take: NOVELTY_LOOKBACK,
      select: { popupSpec: true },
    });

    const headlines: string[] = [];
    const fingerprints = new Set<string>();

    for (const v of variants) {
      const spec = v.popupSpec as Partial<PopupSpec> | null;
      if (!spec) continue;
      if (typeof spec.headline === "string" && spec.headline.trim()) headlines.push(spec.headline.trim());
      fingerprints.add(dnaFingerprint(spec.template_id, spec.layout_style, normalizeDna(spec.dna)));
    }

    return {
      recentHeadlines: Array.from(new Set(headlines)).slice(0, 15),
      recentFingerprints: Array.from(fingerprints).slice(0, 15),
    };
  } catch (err) {
    // Novelty is an optimization, not a correctness requirement — a DB hiccup
    // here should degrade variety, never block a campaign from generating.
    console.warn("[popupGeneration] novelty memory lookup failed, continuing without it:", err);
    return { recentHeadlines: [], recentFingerprints: [] };
  }
}

// ─── Generation — Claude Haiku ────────────────────────────────────────────────

async function generateWithClaude(
  input: PopupGenerationInput,
  systemPrompt: string,
  userMessage: string,
): Promise<PopupGenerationOutput> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    temperature: 1,
    system: systemPrompt,
    tools: [GENERATE_POPUP_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
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

async function generateWithGemini(
  input: PopupGenerationInput,
  systemPrompt: string,
  userMessage: string,
): Promise<PopupGenerationOutput> {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: `${systemPrompt}\n\n${userMessage}` },
        ],
      },
    ],
    config: {
      temperature: 1,
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

async function generateWithBedrock(
  input: PopupGenerationInput,
  systemPrompt: string,
  userMessage: string,
): Promise<PopupGenerationOutput> {
  const client = new BedrockRuntimeClient({ region: AWS_REGION });

  // Bedrock uses the same Anthropic message format but via InvokeModel
  const bedrockBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8000,
    temperature: 1,
    system: systemPrompt,
    tools: [GENERATE_POPUP_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
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

// None of the SDK calls below set their own timeout, and the AWS SDK's default
// Node HTTP handler in particular has no request timeout — a Bedrock access/
// networking misconfiguration can hang instead of erroring. This whole function
// runs inside a single Inngest step.run() (see lib/inngest/generateCampaign.ts);
// if it hangs long enough, the Vercel function gets killed by its maxDuration
// before our own try/catch ever runs, leaving the campaign stuck in GENERATING
// forever with no error surfaced. Bounding each provider attempt keeps the
// worst case (all three time out) well under that limit, so a real failure
// always reaches the caller's catch block and marks the campaign FAILED fast.
const PROVIDER_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`[popupGeneration] ${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// AI popup variation roadmap, Phase 4: append human-approved cross-account
// patterns (see lib/inngest/mineCrossAccountPatterns.ts and
// /admin/learned-patterns) to the base system prompt at generation time.
// Best-effort — a DB hiccup here should never block generation, it just
// means this call runs on the base prompt without the extra patterns.
async function getLearnedPatternsSection(): Promise<string> {
  try {
    const patterns = await prisma.learnedPattern.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { description: true },
    });
    if (patterns.length === 0) return "";
    return (
      "\n\nLEARNED PATTERNS (mined across all Asmos accounts, human-approved — treat as extra prior\n" +
      "knowledge to weigh alongside this store's own analytics, not a replacement for them; this\n" +
      "store's own data always wins if it conflicts with a pattern below):\n" +
      patterns.map((p) => `- ${p.description}`).join("\n")
    );
  } catch (err) {
    console.warn("[popupGeneration] failed to fetch learned patterns, continuing without them:", err);
    return "";
  }
}

// Real popups scraped from high-traffic live sites (see lib/popupScraping.ts
// and scripts/popup-scraper/), industry-matched — the model's only source of
// actual visual/structural grounding, instead of picking template_id and
// layout_style as blind enum names. No review gate, unlike learned patterns
// above: the source sites are hand-picked to already be high quality, so a
// captured row is trusted the moment it exists (see model comment on
// ScrapedPopupExample). Best-effort, same as getLearnedPatternsSection.
async function getScrapedExamplesSection(rawIndustry: string | null | undefined): Promise<string> {
  if (!rawIndustry) return "";
  try {
    const industry = normalizeIndustry(rawIndustry);
    const examples = await prisma.scrapedPopupExample.findMany({
      where: { industry, present: true },
      orderBy: { scrapedAt: "desc" },
      take: 5,
      select: { design: true },
    });
    if (examples.length === 0) return ""; // no off-industry examples — same "when in doubt, null" rule as imagery
    // Deliberately NOT including these examples' own colours: brand_tokens.palette
    // (the merchant's own analyzed site) is the one and only colour source and is
    // explicitly locked/never-invented elsewhere in this prompt. Showing a
    // second, concrete set of hex codes here — even captioned "don't copy
    // this" — is a strictly weaker instruction than a lock, and risks exactly
    // the failure this section should never cause: the model reaching for
    // some other store's colour instead of this merchant's own.
    const lines = examples
      .map((e) => e.design as Partial<ScrapedPopupDesign> | null)
      .filter((d): d is Partial<ScrapedPopupDesign> => d !== null)
      .map((d) => {
        const shape = [d.buttonShape, d.buttonFill].filter(Boolean).join("/");
        const extras = [d.density, shape].filter(Boolean).join(", ");
        return `- ${d.template ?? "unknown"}/${d.layout ?? "unknown"}${extras ? ` (${extras})` : ""}: "${d.headline}" / "${d.subhead}" / CTA "${d.ctaText}"`;
      });
    if (lines.length === 0) return "";
    return (
      "\n\nREAL EXAMPLES FROM THIS INDUSTRY (scraped from high-traffic live sites — for structural and\n" +
      "tonal grounding only; never take colour from these, only from brand_tokens.palette above; do not\n" +
      "copy any of these verbatim):\n" +
      lines.join("\n")
    );
  } catch (err) {
    console.warn("[popupGeneration] failed to fetch scraped examples, continuing without them:", err);
    return "";
  }
}

// ─── Content & Compliance Guardrails (server-side safety net) ────────────────
//
// The prompt instructs the model not to suggest illegal/regulated/absurd
// rewards, not to borrow third-party IP, to keep seasonal copy in-season,
// and to respect max_discount_percent — but a prompt instruction is
// advisory, not enforcement. This is the actual enforcement: applied to
// every spec (baseline + every variant) from every provider, right before
// generatePopupWithVariants returns, so nothing downstream (DB, widget,
// merchant's live site) ever sees a spec that violates these regardless of
// what the model actually produced.
//
// The blocklist is intentionally short and scoped to genuinely
// non-negotiable categories (controlled substances, weapons/explosives,
// alcohol/tobacco as a giveaway) rather than an attempt at general content
// moderation — broad copyrighted-IP detection isn't something a static list
// can cover, so that's handled by the prompt instruction alone.
const BLOCKED_REWARD_TERMS = [
  "prescription", "opioid", "oxycontin", "xanax", "vicodin", "adderall",
  "morphine", "fentanyl", "cocaine", "heroin", "methamphetamine",
  "firearm", "handgun", "rifle", "ammunition", "explosive", "grenade",
  "cigarette", "vape", "e-cigarette",
];
const SAFE_FALLBACK_HEADLINE = "Get an exclusive offer";
const SAFE_FALLBACK_SUBHEAD = "Enter your email to unlock a special discount.";

function containsBlockedTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_REWARD_TERMS.some((term) => lower.includes(term));
}

// Downgrades any "NN%" mention in text that exceeds maxPercent to maxPercent
// — a defensive text-level backstop alongside clamping the structured
// discount_percent field, since the model could in principle state a bigger
// number in prose even if the structured field is clamped separately.
function clampPercentMentions(text: string, maxPercent: number): string {
  return text.replace(/(\d{1,3})\s*%/g, (match, digits) => {
    const n = parseInt(digits, 10);
    return n > maxPercent ? `${maxPercent}%` : match;
  });
}

function guardSpec(spec: PopupSpec, maxDiscountPercent: number): PopupSpec {
  let { headline, subhead, cta, coupon_code, discount_percent } = spec;

  if (typeof discount_percent === "number" && discount_percent > maxDiscountPercent) {
    discount_percent = maxDiscountPercent;
  }
  headline = clampPercentMentions(headline, maxDiscountPercent);
  subhead = clampPercentMentions(subhead, maxDiscountPercent);
  cta = clampPercentMentions(cta, maxDiscountPercent);

  if (containsBlockedTerm(headline) || containsBlockedTerm(subhead) || containsBlockedTerm(coupon_code)) {
    console.warn("[popupGeneration] guardSpec: blocked term detected, replacing with safe fallback copy", {
      headline: spec.headline,
    });
    headline = SAFE_FALLBACK_HEADLINE;
    subhead = SAFE_FALLBACK_SUBHEAD;
    coupon_code = "WELCOME10";
    discount_percent = Math.min(discount_percent ?? 10, maxDiscountPercent);
  }

  return { ...spec, headline, subhead, cta, coupon_code, discount_percent };
}

function applyContentGuardrails(
  output: PopupGenerationOutput,
  maxDiscountPercent: number,
): PopupGenerationOutput {
  return {
    ...output,
    baseline: { ...output.baseline, spec: guardSpec(output.baseline.spec, maxDiscountPercent) },
    variants: output.variants.map((v) => ({ ...v, spec: guardSpec(v.spec, maxDiscountPercent) })),
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export type GenerationBriefs = {
  control: DesignBrief;
  variants: DesignBrief[];
};

/**
 * Builds the user turn. The design briefs go *after* the store JSON and are
 * the last thing the model reads before answering, because they're the
 * constraints most likely to be dropped if buried.
 */
function buildUserMessage(input: PopupGenerationInput, briefs?: GenerationBriefs): string {
  const parts = [
    "Generate a popup design for this store. Return the result by calling generate_popup.",
    "",
    JSON.stringify(input, null, 2),
  ];

  if (briefs) {
    parts.push(
      "",
      "════════════════════════════════════════════════════════════════",
      "DESIGN BRIEFS — these are binding. Every locked value below is",
      "re-applied server-side after you respond, so copy that contradicts",
      "its own brief ships as a broken popup.",
      "════════════════════════════════════════════════════════════════",
      "",
      briefToPromptSection(briefs.control, "BRIEF FOR THE BASELINE (control):"),
    );

    briefs.variants.forEach((brief, i) => {
      parts.push("", briefToPromptSection(brief, `BRIEF FOR VARIANT ${i + 1}:`));
    });

    parts.push(
      "",
      input.testing_mode === "explore"
        ? "These briefs deliberately differ from each other. Do not try to normalise them into a house style — the divergence IS the experiment."
        : "These briefs differ from the control by exactly one knob each. Keep everything else, including the copy, as close to the control as the brief allows so the result is attributable.",
    );
  }

  return parts.join("\n");
}

/**
 * Applies the sampled design briefs to the model's output.
 *
 * The prompt asks the model to honour the brief; this makes it true. Without
 * enforcement a model that quietly reverts to its favourite layout takes the
 * product straight back to every popup looking identical, and we'd have no way
 * to tell from the outside.
 */
function applyBriefs(output: PopupGenerationOutput, briefs: GenerationBriefs): PopupGenerationOutput {
  return {
    ...output,
    baseline: {
      ...output.baseline,
      spec: enforceBrief(output.baseline.spec, briefs.control) as PopupSpec,
    },
    variants: output.variants.map((v, i) => {
      const brief = briefs.variants[i];
      return brief ? { ...v, spec: enforceBrief(v.spec, brief) as PopupSpec } : v;
    }),
  };
}

/**
 * Drops any image that isn't from our own curated library.
 *
 * `image_url` is typed as a free string in the tool schema, so nothing stopped
 * the model returning a hallucinated photo ID (404s on the merchant's site) or
 * a URL recalled from training — uncurated, and quite possibly carrying text or
 * a percentage burned into the pixels. That last case is the one that bit:
 * imagery is generated independently of copy, so a photo with "50%" in it will
 * happily sit above a 10% offer.
 *
 * When the URL is rejected the popup renders with no image at all rather than
 * substituting a stock fallback, so image_treatment is forced to "none" to keep
 * the spec internally consistent.
 */
function sanitizeSpecImage(spec: PopupSpec): PopupSpec {
  if (spec.image_url === null || isLibraryImage(spec.image_url)) return spec;
  console.warn(`[popupGeneration] discarding off-library image_url: ${spec.image_url}`);
  return {
    ...spec,
    image_url: null,
    dna: { ...spec.dna, image_treatment: "none" },
  };
}

/** Normalizes every spec's DNA so downstream renderers never see a partial. */
function normalizeOutputDna(output: PopupGenerationOutput): PopupGenerationOutput {
  return {
    ...output,
    baseline: {
      ...output.baseline,
      spec: sanitizeSpecImage({ ...output.baseline.spec, dna: normalizeDna(output.baseline.spec.dna) }),
    },
    variants: output.variants.map((v) => ({
      ...v,
      spec: sanitizeSpecImage({ ...v.spec, dna: normalizeDna(v.spec.dna) }),
    })),
  };
}

export async function generatePopupWithVariants(
  input: PopupGenerationInput,
  briefs?: GenerationBriefs,
): Promise<PopupGenerationOutput> {
  // Generation is scraped-data-only now: no merchant site extraction, no
  // generic default. Resolved before any provider call, both to fail fast
  // and so a missing-coverage failure never costs an AI call.
  const scrapedDesigns = await pickScrapedDesigns(input.store.category, input.constraints.variant_count + 1);
  if (scrapedDesigns.length === 0) {
    throw new Error(
      `No scraped popup examples available for industry "${normalizeIndustry(input.store.category)}" — cannot generate without scraped design data. Scrape some sites in this industry first.`,
    );
  }

  // Colour/font ground truth now comes from the scraped design, not the
  // merchant's own analyzed site — overrides whatever the caller computed
  // via brandTokensFromAnalyzeResult before calling here. The existing
  // prompt language ("brand_tokens.palette are LOCKED... use as ground
  // truth") is unchanged; what it describes now is just different.
  const primary = scrapedDesigns[0];
  input.brand_tokens = {
    palette: [primary.accentColor, primary.backgroundColor, primary.textColor].filter(
      (c): c is string => Boolean(c),
    ),
    type_display: primary.headlineFont ?? "system-ui, -apple-system, sans-serif",
    type_body: primary.bodyFont ?? "system-ui, -apple-system, sans-serif",
    imagery_style: primary.hasImage ? "product-forward" : "minimal",
    signature_element_suggestion: "match the reference popup's own visual treatment",
  };

  const systemPrompt =
    POPUP_GENERATION_SYSTEM_PROMPT +
    (await getLearnedPatternsSection()) +
    (await getScrapedExamplesSection(input.store?.category));
  const userMessage = buildUserMessage(input, briefs);
  // Whatever the merchant configured (or DEFAULT_MAX_DISCOUNT_PERCENT if
  // they didn't) — already sanity-bounded in buildPopupInput, not re-capped
  // against a platform ceiling here.
  const maxDiscountPercent = input.constraints.max_discount_percent;

  const finish = (result: PopupGenerationOutput): PopupGenerationOutput => {
    const briefed = briefs ? applyBriefs(result, briefs) : result;
    // Structure/shape/density/imagery forced from real scraped designs —
    // cycling through the pool so baseline and each variant can still read
    // as visually distinct from each other, even though every value traces
    // back to a real scraped popup rather than the model's own invention.
    // Copy is untouched. Applied before normalizeOutputDna so its safety net
    // still coerces anything this step left alone.
    const designed: PopupGenerationOutput = {
      ...briefed,
      baseline: {
        ...briefed.baseline,
        spec: applyScrapedDesign(briefed.baseline.spec, scrapedDesigns[0]),
      },
      variants: briefed.variants.map((v, i) => ({
        ...v,
        spec: applyScrapedDesign(v.spec, scrapedDesigns[(i + 1) % scrapedDesigns.length]),
      })),
    };
    return applyContentGuardrails(normalizeOutputDna(designed), maxDiscountPercent);
  };

  // Provider priority: Bedrock (AWS) → Anthropic direct → Gemini
  let lastError: unknown;

  if (HAS_AWS_KEY) {
    try {
      return finish(
        await withTimeout(generateWithBedrock(input, systemPrompt, userMessage), PROVIDER_TIMEOUT_MS, "Bedrock"),
      );
    } catch (err) {
      console.warn("[popupGeneration] Bedrock failed, falling back to next provider:", err);
      lastError = err;
    }
  }

  if (HAS_ANTHROPIC_KEY) {
    try {
      return finish(
        await withTimeout(generateWithClaude(input, systemPrompt, userMessage), PROVIDER_TIMEOUT_MS, "Anthropic"),
      );
    } catch (err) {
      console.warn("[popupGeneration] Anthropic failed, falling back to Gemini:", err);
      lastError = err;
    }
  }

  try {
    return finish(
      await withTimeout(generateWithGemini(input, systemPrompt, userMessage), PROVIDER_TIMEOUT_MS, "Gemini"),
    );
  } catch (err) {
    console.error("[popupGeneration] Gemini failed too.", err);
    throw lastError ?? err;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive sensible brand tokens from the data /api/analyze already returns. */
/**
 * The true last-resort colour: nothing was measured on the store's own site
 * and no brandColor was ever chosen. Used to default every such store to
 * Asmos's own brand blue, which meant any store whose extraction genuinely
 * failed rendered a popup that visibly matched *our* brand, not theirs, by
 * sheer coincidence of failure. Reaches into the same scraped-popup-by-
 * industry data getScrapedExamplesSection uses, and takes a real dominant
 * colour from a real popup in that industry instead — still not this
 * specific merchant's own colour (nothing can substitute for that), but a
 * plausible one for their kind of store rather than a generic default that's
 * secretly Asmos's. Falls back to Asmos's blue only when there's no scraped
 * data for that industry either — the one case nothing real is available.
 */
const HEX_RE = /^#[0-9a-f]{6}$/i;

export async function industryFallbackColor(industry: string | undefined): Promise<string> {
  const ASMOS_BLUE = "#165DFF";
  if (!industry) return ASMOS_BLUE;
  try {
    const bucket = normalizeIndustry(industry);
    const examples = await prisma.scrapedPopupExample.findMany({
      where: { industry: bucket, present: true },
      orderBy: { scrapedAt: "desc" },
      take: 10,
      select: { design: true },
    });
    for (const e of examples) {
      const design = e.design as Partial<ScrapedPopupDesign> | null;
      if (!design) continue;
      // The CTA button's own colour is the most deliberately "brand" choice
      // in a popup — merchants pick that colour on purpose, whereas the
      // overall painted-area palette below is just as likely to be a large
      // neutral background or body-text colour with nothing brand-like
      // about it. Prefer it; fall back to the palette only if no button was
      // captured on that particular popup.
      if (typeof design.accentColor === "string" && HEX_RE.test(design.accentColor)) {
        return design.accentColor;
      }
      const palette = design.palette;
      if (!Array.isArray(palette) || palette.length === 0) continue;
      const sorted = [...palette].sort((a, b) => {
        const aShare = (a as { areaShare?: number })?.areaShare ?? 0;
        const bShare = (b as { areaShare?: number })?.areaShare ?? 0;
        return bShare - aShare;
      });
      const hex = (sorted[0] as { hex?: unknown })?.hex;
      if (typeof hex === "string" && HEX_RE.test(hex)) return hex;
    }
  } catch (err) {
    console.warn("[popupGeneration] failed to fetch industry fallback colour, using default:", err);
  }
  return ASMOS_BLUE;
}

/**
 * Real scraped popup designs for a merchant's industry — up to `count`
 * distinct ones, most recent first. Generation is now scraped-data-only: no
 * merchant's own site extraction, no generic default. Callers are expected
 * to throw when this comes back empty (see generatePopupWithVariants) rather
 * than degrading to anything else.
 */
async function pickScrapedDesigns(industry: string | null | undefined, count: number): Promise<ScrapedPopupDesign[]> {
  const bucket = normalizeIndustry(industry ?? "");
  const rows = await prisma.scrapedPopupExample.findMany({
    where: { industry: bucket, present: true },
    orderBy: { scrapedAt: "desc" },
    take: Math.max(count, 10), // a pool bigger than needed, so baseline/variants can draw distinct ones
    select: { design: true },
  });
  return rows.map((r) => r.design as ScrapedPopupDesign).filter((d): d is ScrapedPopupDesign => Boolean(d));
}

/**
 * Forces a spec's structure/shape/density/imagery to match a real scraped
 * design — the same "code-level enforcement, not just a prompt instruction"
 * lesson the colour lock already applies, extended to everything visual.
 * Copy (headline/subhead/cta/etc.) is untouched: that stays the model's own
 * work, informed but not dictated by scraped examples.
 */
function applyScrapedDesign(spec: PopupSpec, d: ScrapedPopupDesign): PopupSpec {
  const cornerBucket = (px: string | null): CornerRadius => {
    const n = px ? parseFloat(px) : 0;
    if (!Number.isFinite(n) || n <= 0) return "sharp";
    return n < 14 ? "soft" : n < 28 ? "rounded" : "pill";
  };
  const layout = d.layout;
  const validLayout = layout === "split-left" || layout === "split-right" || layout === "centered" || layout === "minimal";
  const palette = [d.accentColor, d.backgroundColor, d.textColor].filter((c): c is string => Boolean(c));

  return {
    ...spec,
    template_id: d.template ?? spec.template_id,
    layout_style: validLayout ? (layout as PopupSpec["layout_style"]) : spec.layout_style,
    design_tokens: {
      palette: palette.length > 0 ? palette : spec.design_tokens.palette,
      type_display: d.headlineFont ?? spec.design_tokens.type_display,
      type_body: d.bodyFont ?? spec.design_tokens.type_body,
    },
    dna: {
      ...spec.dna,
      corner_radius: cornerBucket(d.cornerRadius),
      button_shape: d.buttonShape ?? spec.dna.button_shape,
      button_fill: d.buttonFill === "solid" || d.buttonFill === "outline" ? d.buttonFill : spec.dna.button_fill,
      density: d.density ?? spec.dna.density,
      image_treatment: !d.hasImage
        ? "none"
        : d.imagePosition === "top"
          ? "top_band"
          : d.imagePosition === "background"
            ? "background"
            : "side",
      elevation: d.hasShadow ? "raised" : "flat",
    },
  };
}

export async function brandTokensFromAnalyzeResult(result: {
  brandTokens?: BrandTokens;
  computedStyles?: ComputedStyles;
  storeName?: string;
  industry?: string;
}): Promise<BrandTokens> {
  // brandColor (an account-level field a merchant can manually set, or that
  // analysis may have written there) is deliberately NOT a colour source
  // here anymore — only a genuinely measured palette counts. It used to be:
  // any account whose colour got stuck on a stale or placeholder value (see
  // the onboarding/settings fixes earlier this session) would keep feeding
  // that value into every future generation regardless of what the store's
  // own site actually measures to. Colour now comes exclusively from what
  // was actually measured, or — failing that — a real colour from a scraped
  // popup in the same industry, never from this account-level field.
  if (result.brandTokens?.palette?.length) return result.brandTokens;

  // No measured palette. brandTokensFromStoreProfile can still return a real
  // (non-null) object here whenever type_display was measured even if the
  // colour-by-painted-area pass came up empty (a plausible split — reading a
  // font off getComputedStyle is far more reliable than measuring dominant
  // colour) — preserve whatever WAS measured, just fill in the colour.
  const primaryColor = await industryFallbackColor(result.industry);
  if (result.brandTokens) {
    return { ...result.brandTokens, palette: [primaryColor] };
  }
  return {
    palette: [primaryColor],
    type_display: "system-ui, -apple-system, sans-serif",
    type_body: "system-ui, -apple-system, sans-serif",
    imagery_style: "clean and minimal",
    signature_element_suggestion: "subtle brand accent bar at popup top",
  };
}

export async function computedStylesFromAnalyzeResult(result: {
  computedStyles?: ComputedStyles;
  industry?: string;
}): Promise<ComputedStyles> {
  if (result.computedStyles) return result.computedStyles;
  return {
    colors_in_use: [await industryFallbackColor(result.industry)],
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
