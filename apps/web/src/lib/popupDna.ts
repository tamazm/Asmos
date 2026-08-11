/**
 * lib/popupDna.ts
 *
 * The "design DNA" of a popup — the composable knobs that make two popups
 * genuinely different from each other rather than the same skeleton with
 * different words in it.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this module, `PopupSpec` carried six meaningful fields (headline,
 * subhead, cta, template_id, layout_style, image_url). Everything else that a
 * visitor actually perceives — the countdown timer, the "LIMITED TIME OFFER"
 * eyebrow, the step-2 copy, the button shape, the density, whether there's a
 * dismiss link — was a string literal hardcoded inside the template files.
 * That made "test different layouts and variants" structurally impossible:
 * the model had no vocabulary to express a different popup, so every campaign
 * and every variant rendered the same chrome.
 *
 * Every field below is (a) chosen by the model per popup, (b) rendered by all
 * three templates, and (c) safe to omit — `normalizeDna` fills any missing
 * key, so a Variant row written before this module existed still renders.
 *
 * Rough combinatorial size (structure x visual x flow, ignoring free text):
 * 3 templates x 4 layout styles x 2 flows x 3 timers x 4 radii x 3 button
 * shapes x 3 fills x 4 accent placements x 3 densities x 3 type scales x
 * 4 overlay weights x 4 image treatments x 4 entrances x 3 themes x
 * 2 form layouts x 4 close affordances — on the order of 10^8 distinct
 * renderable popups before a single word of copy changes.
 */

// ─── Enumerated knobs ────────────────────────────────────────────────────────

export const STEP_FLOWS = ["one_step", "two_step"] as const;
export const TIMER_MODES = ["none", "countdown", "static_badge"] as const;
export const TIMER_STYLES = ["digits", "bar", "pill"] as const;
export const FORM_LAYOUTS = ["stacked", "inline"] as const;
export const CORNER_RADII = ["sharp", "soft", "rounded", "pill"] as const;
export const BUTTON_SHAPES = ["rect", "rounded", "pill"] as const;
export const BUTTON_FILLS = ["solid", "outline", "dark"] as const;
export const ACCENT_PLACEMENTS = ["button_only", "headline", "top_border", "background_block"] as const;
export const DENSITIES = ["compact", "regular", "airy"] as const;
export const TYPE_SCALES = ["small", "medium", "large"] as const;
export const OVERLAY_WEIGHTS = ["none", "light", "medium", "heavy"] as const;
export const IMAGE_TREATMENTS = ["none", "side", "background", "top_band"] as const;
export const ENTRANCES = ["fade", "slide_up", "scale", "slide_side"] as const;
export const THEMES = ["light", "dark", "brand"] as const;
export const CLOSE_AFFORDANCES = ["x_corner", "x_outside", "text_link", "both"] as const;

/**
 * The aesthetic school the popup belongs to. Distinct from every knob above:
 * those describe *structure* (where things sit, how many steps), this describes
 * *taste* (what the thing feels like to look at). Before it existed the visual
 * vocabulary was three flat themes, one box-shadow and system-ui, which is why
 * a "different" popup still meant "the same card with different words".
 *
 * Treated as a first-class test axis rather than a global setting: which school
 * converts is a property of the store's niche, not of good taste in general —
 * a supplements brand and a ceramics studio should not land in the same place.
 */
export const ART_DIRECTIONS = ["editorial", "bold", "glass", "minimal"] as const;
export const TYPE_PAIRINGS = ["editorial", "bold", "geometric", "grotesque", "brand", "system"] as const;
export const ELEVATIONS = ["flat", "raised", "floating"] as const;
export const SURFACE_TREATMENTS = ["plain", "paper", "glow", "block", "mesh"] as const;

/**
 * Which axis the composition is built on.
 *
 * This exists because centring everything is the single loudest tell that a
 * layout was generated rather than designed. Centre alignment is what you get
 * when nothing decided where the text should go — it has no left edge for the
 * eye to return to, so a stack of centred elements reads as a list of unrelated
 * things rather than as a composition. Real layouts commit to an axis.
 */
export const TEXT_ALIGNS = ["left", "center"] as const;

export type StepFlow = (typeof STEP_FLOWS)[number];
export type TimerMode = (typeof TIMER_MODES)[number];
export type TimerStyle = (typeof TIMER_STYLES)[number];
export type FormLayout = (typeof FORM_LAYOUTS)[number];
export type CornerRadius = (typeof CORNER_RADII)[number];
export type ButtonShape = (typeof BUTTON_SHAPES)[number];
export type ButtonFill = (typeof BUTTON_FILLS)[number];
export type AccentPlacement = (typeof ACCENT_PLACEMENTS)[number];
export type Density = (typeof DENSITIES)[number];
export type TypeScale = (typeof TYPE_SCALES)[number];
export type OverlayWeight = (typeof OVERLAY_WEIGHTS)[number];
export type ImageTreatment = (typeof IMAGE_TREATMENTS)[number];
export type Entrance = (typeof ENTRANCES)[number];
export type Theme = (typeof THEMES)[number];
export type CloseAffordance = (typeof CLOSE_AFFORDANCES)[number];
export type ArtDirection = (typeof ART_DIRECTIONS)[number];
export type TypePairing = (typeof TYPE_PAIRINGS)[number];
export type Elevation = (typeof ELEVATIONS)[number];
export type SurfaceTreatment = (typeof SURFACE_TREATMENTS)[number];
export type TextAlign = (typeof TEXT_ALIGNS)[number];

// ─── The DNA ─────────────────────────────────────────────────────────────────

export type PopupDna = {
  // ── Structure ──
  /**
   * "two_step" shows a teaser, then the email field after a click (the
   * commitment-and-consistency play). "one_step" puts the offer and the email
   * field on one screen — fewer clicks, colder ask. This is a real, testable
   * fork, not a cosmetic one, and it was previously hardwired to two_step for
   * every goal="BOTH" popup ever generated.
   */
  step_flow: StepFlow;

  // ── Urgency ──
  timer_mode: TimerMode;
  /** Countdown duration. Ignored unless timer_mode is "countdown". */
  timer_seconds: number | null;
  timer_style: TimerStyle;
  /** Text for a static urgency badge, e.g. "Today only". Used when timer_mode is "static_badge". */
  timer_label: string | null;

  // ── Supporting copy (null means "don't render this element at all") ──
  /** Small uppercase kicker above the headline. NULL is a legitimate, common choice. */
  eyebrow: string | null;
  /** e.g. "Join 12,000 subscribers". Only write one if it would be truthful for this store. */
  social_proof: string | null;
  /** Reassurance under the form, e.g. "No spam. Unsubscribe anytime." */
  privacy_note: string | null;

  // ── Form ──
  form_layout: FormLayout;
  email_placeholder: string;
  /** Render a visible field label instead of a placeholder-only field. */
  show_field_label: boolean;
  field_label: string;

  // ── Aesthetic ──
  /**
   * The school. Sets the taste-level defaults (typography, depth, surface) and
   * biases the structural knobs below toward what that school actually does —
   * an editorial popup with pill buttons and a 28px radius isn't editorial.
   */
  art_direction: ArtDirection;
  /** Which typeface pair to serve. "brand" uses the store's own, when Google serves it. */
  type_pairing: TypePairing;
  /** Shadow language. "flat" is a real choice, not an absence of one. */
  elevation: Elevation;
  /** What happens on the surface behind the copy: paper tone, accent glow, colour block, mesh. */
  surface_treatment: SurfaceTreatment;
  /** The axis the composition is built on. Left is the considered default; centre is a choice. */
  text_align: TextAlign;

  // ── Visual ──
  corner_radius: CornerRadius;
  button_shape: ButtonShape;
  button_fill: ButtonFill;
  accent_placement: AccentPlacement;
  density: Density;
  type_scale: TypeScale;
  overlay_weight: OverlayWeight;
  image_treatment: ImageTreatment;
  entrance: Entrance;
  theme: Theme;

  // ── Exits ──
  close_affordance: CloseAffordance;
  /** Opt-out link text, e.g. "No thanks". NULL renders no opt-out link. */
  dismiss_text: string | null;

  // ── Step copy (previously hardcoded in every template) ──
  capture_headline: string;
  capture_subhead: string;
  capture_cta: string;
  reveal_headline: string;
  reveal_subhead: string;
  reveal_cta: string;
  success_headline: string;
  success_subhead: string;
};

// ─── Defaults / normalization ────────────────────────────────────────────────

/**
 * The shape a pre-DNA Variant row degrades to. Deliberately quiet: no timer,
 * no eyebrow, no fabricated social proof. A row written before this module
 * existed has no way to say "the timer was intentional", so the safe reading
 * is that it wasn't.
 */
export const DEFAULT_DNA: PopupDna = {
  step_flow: "two_step",
  timer_mode: "none",
  timer_seconds: null,
  timer_style: "digits",
  timer_label: null,
  eyebrow: null,
  social_proof: null,
  privacy_note: null,
  form_layout: "stacked",
  email_placeholder: "Your email address",
  show_field_label: false,
  field_label: "Email address",
  // A pre-aesthetic row has no opinion about taste, so it degrades to the one
  // school that adds nothing: no webfont, no shadow language, no surface.
  art_direction: "minimal",
  type_pairing: "system",
  elevation: "raised",
  surface_treatment: "plain",
  text_align: "center",
  corner_radius: "soft",
  button_shape: "rounded",
  button_fill: "solid",
  accent_placement: "button_only",
  density: "regular",
  type_scale: "medium",
  overlay_weight: "medium",
  image_treatment: "side",
  entrance: "scale",
  theme: "light",
  close_affordance: "x_corner",
  dismiss_text: null,
  capture_headline: "Almost there",
  capture_subhead: "Enter your email to unlock your code.",
  capture_cta: "Continue",
  reveal_headline: "Your code is ready",
  reveal_subhead: "Use this code at checkout.",
  reveal_cta: "Shop now",
  success_headline: "You're on the list",
  success_subhead: "Thanks for subscribing. Keep an eye on your inbox.",
};

function pick<T extends readonly string[]>(
  allowed: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

/** Optional copy: an empty string, "none", or "null" all mean "omit this element". */
function optionalStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (/^(none|null|n\/a)$/i.test(trimmed)) return null;
  return trimmed;
}

const MIN_TIMER_SECONDS = 30;
const MAX_TIMER_SECONDS = 3600;

/**
 * Coerces whatever the model produced (or whatever an old DB row holds) into a
 * complete, renderable DNA. Never throws — a bad value degrades to the default
 * for that one knob rather than failing the whole popup.
 */
export function normalizeDna(raw: unknown): PopupDna {
  const d = (raw ?? {}) as Partial<Record<keyof PopupDna, unknown>>;

  const timerMode = pick(TIMER_MODES, d.timer_mode, DEFAULT_DNA.timer_mode);
  const rawSeconds = typeof d.timer_seconds === "number" && Number.isFinite(d.timer_seconds)
    ? Math.round(d.timer_seconds)
    : null;
  const timerSeconds =
    timerMode === "countdown"
      ? Math.min(Math.max(rawSeconds ?? 600, MIN_TIMER_SECONDS), MAX_TIMER_SECONDS)
      : null;

  return {
    step_flow: pick(STEP_FLOWS, d.step_flow, DEFAULT_DNA.step_flow),

    timer_mode: timerMode,
    timer_seconds: timerSeconds,
    timer_style: pick(TIMER_STYLES, d.timer_style, DEFAULT_DNA.timer_style),
    timer_label: optionalStr(d.timer_label),

    eyebrow: optionalStr(d.eyebrow),
    social_proof: optionalStr(d.social_proof),
    privacy_note: optionalStr(d.privacy_note),

    form_layout: pick(FORM_LAYOUTS, d.form_layout, DEFAULT_DNA.form_layout),
    email_placeholder: str(d.email_placeholder, DEFAULT_DNA.email_placeholder),
    show_field_label: typeof d.show_field_label === "boolean" ? d.show_field_label : DEFAULT_DNA.show_field_label,
    field_label: str(d.field_label, DEFAULT_DNA.field_label),

    art_direction: pick(ART_DIRECTIONS, d.art_direction, DEFAULT_DNA.art_direction),
    type_pairing: pick(TYPE_PAIRINGS, d.type_pairing, DEFAULT_DNA.type_pairing),
    elevation: pick(ELEVATIONS, d.elevation, DEFAULT_DNA.elevation),
    surface_treatment: pick(SURFACE_TREATMENTS, d.surface_treatment, DEFAULT_DNA.surface_treatment),
    text_align: pick(TEXT_ALIGNS, d.text_align, DEFAULT_DNA.text_align),

    corner_radius: pick(CORNER_RADII, d.corner_radius, DEFAULT_DNA.corner_radius),
    button_shape: pick(BUTTON_SHAPES, d.button_shape, DEFAULT_DNA.button_shape),
    button_fill: pick(BUTTON_FILLS, d.button_fill, DEFAULT_DNA.button_fill),
    accent_placement: pick(ACCENT_PLACEMENTS, d.accent_placement, DEFAULT_DNA.accent_placement),
    density: pick(DENSITIES, d.density, DEFAULT_DNA.density),
    type_scale: pick(TYPE_SCALES, d.type_scale, DEFAULT_DNA.type_scale),
    overlay_weight: pick(OVERLAY_WEIGHTS, d.overlay_weight, DEFAULT_DNA.overlay_weight),
    image_treatment: pick(IMAGE_TREATMENTS, d.image_treatment, DEFAULT_DNA.image_treatment),
    entrance: pick(ENTRANCES, d.entrance, DEFAULT_DNA.entrance),
    theme: pick(THEMES, d.theme, DEFAULT_DNA.theme),

    close_affordance: pick(CLOSE_AFFORDANCES, d.close_affordance, DEFAULT_DNA.close_affordance),
    dismiss_text: optionalStr(d.dismiss_text),

    capture_headline: str(d.capture_headline, DEFAULT_DNA.capture_headline),
    capture_subhead: str(d.capture_subhead, DEFAULT_DNA.capture_subhead),
    capture_cta: str(d.capture_cta, DEFAULT_DNA.capture_cta),
    reveal_headline: str(d.reveal_headline, DEFAULT_DNA.reveal_headline),
    reveal_subhead: str(d.reveal_subhead, DEFAULT_DNA.reveal_subhead),
    reveal_cta: str(d.reveal_cta, DEFAULT_DNA.reveal_cta),
    success_headline: str(d.success_headline, DEFAULT_DNA.success_headline),
    success_subhead: str(d.success_subhead, DEFAULT_DNA.success_subhead),
  };
}

// ─── JSON Schema fragment (shared by Anthropic / Bedrock / Gemini tools) ─────

export const popupDnaJsonSchema = {
  type: "object",
  properties: {
    step_flow: { type: "string", enum: STEP_FLOWS },
    timer_mode: { type: "string", enum: TIMER_MODES },
    timer_seconds: { type: ["number", "null"] },
    timer_style: { type: "string", enum: TIMER_STYLES },
    timer_label: { type: ["string", "null"] },
    eyebrow: { type: ["string", "null"] },
    social_proof: { type: ["string", "null"] },
    privacy_note: { type: ["string", "null"] },
    form_layout: { type: "string", enum: FORM_LAYOUTS },
    email_placeholder: { type: "string" },
    show_field_label: { type: "boolean" },
    field_label: { type: "string" },
    art_direction: { type: "string", enum: ART_DIRECTIONS },
    type_pairing: { type: "string", enum: TYPE_PAIRINGS },
    elevation: { type: "string", enum: ELEVATIONS },
    surface_treatment: { type: "string", enum: SURFACE_TREATMENTS },
    text_align: { type: "string", enum: TEXT_ALIGNS },
    corner_radius: { type: "string", enum: CORNER_RADII },
    button_shape: { type: "string", enum: BUTTON_SHAPES },
    button_fill: { type: "string", enum: BUTTON_FILLS },
    accent_placement: { type: "string", enum: ACCENT_PLACEMENTS },
    density: { type: "string", enum: DENSITIES },
    type_scale: { type: "string", enum: TYPE_SCALES },
    overlay_weight: { type: "string", enum: OVERLAY_WEIGHTS },
    image_treatment: { type: "string", enum: IMAGE_TREATMENTS },
    entrance: { type: "string", enum: ENTRANCES },
    theme: { type: "string", enum: THEMES },
    close_affordance: { type: "string", enum: CLOSE_AFFORDANCES },
    dismiss_text: { type: ["string", "null"] },
    capture_headline: { type: "string" },
    capture_subhead: { type: "string" },
    capture_cta: { type: "string" },
    reveal_headline: { type: "string" },
    reveal_subhead: { type: "string" },
    reveal_cta: { type: "string" },
    success_headline: { type: "string" },
    success_subhead: { type: "string" },
  },
  required: [
    "step_flow", "timer_mode", "timer_seconds", "timer_style", "timer_label",
    "eyebrow", "social_proof", "privacy_note",
    "form_layout", "email_placeholder", "show_field_label", "field_label",
    "art_direction", "type_pairing", "elevation", "surface_treatment", "text_align",
    "corner_radius", "button_shape", "button_fill", "accent_placement",
    "density", "type_scale", "overlay_weight", "image_treatment", "entrance", "theme",
    "close_affordance", "dismiss_text",
    "capture_headline", "capture_subhead", "capture_cta",
    "reveal_headline", "reveal_subhead", "reveal_cta",
    "success_headline", "success_subhead",
  ],
  additionalProperties: false,
} as const;

// ─── Fingerprinting (used for novelty enforcement + variant divergence) ──────

/**
 * A short, comparable signature of the *structural* choices in a popup — the
 * things a visitor would notice before reading a word. Two popups sharing a
 * fingerprint look like the same popup; that's exactly what we want to detect
 * and avoid, both across campaigns (novelty memory) and within a campaign's
 * variant set during the explore phase.
 *
 * Deliberately excludes copy: two popups with different headlines but the same
 * fingerprint still *look* identical, which was the original complaint.
 */
export function dnaFingerprint(
  templateId: string | null | undefined,
  layoutStyle: string | null | undefined,
  dna: PopupDna,
): string {
  return [
    templateId ?? "split-screen",
    layoutStyle ?? "split-left",
    // Art direction leads: it's the first thing a visitor perceives and the
    // largest single difference between two popups, so two designs that share
    // it are far more interchangeable than two that merely share a density.
    dna.art_direction,
    dna.type_pairing,
    dna.surface_treatment,
    dna.step_flow,
    dna.timer_mode,
    dna.image_treatment,
    dna.theme,
    dna.accent_placement,
    dna.button_shape,
    dna.density,
    dna.form_layout,
    dna.eyebrow ? "eyebrow" : "no-eyebrow",
    dna.social_proof ? "proof" : "no-proof",
  ].join("|");
}

/**
 * How structurally different two popups are, 0..1. Used to reject a variant
 * set whose members are visually interchangeable (the exact failure mode where
 * a "trigger" variant differed from control only by `delay_seconds`).
 */
export function dnaDistance(a: string, b: string): number {
  const left = a.split("|");
  const right = b.split("|");
  const len = Math.max(left.length, right.length);
  let differing = 0;
  for (let i = 0; i < len; i++) if (left[i] !== right[i]) differing++;
  return differing / len;
}
