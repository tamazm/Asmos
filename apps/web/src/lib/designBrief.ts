/**
 * lib/designBrief.ts
 *
 * Guarantees that two popups are different, rather than hoping they will be.
 *
 * THE PROBLEM THIS SOLVES
 * ----------------------
 * Every cold-start generation used to send byte-identical input to the model:
 * empty analytics, the same variant count, the same goal, the same fallback
 * category and palette, the same system prompt. Identical input plus a
 * heavily-constrained tool schema means an LLM returns the mode of its
 * distribution every time - which is exactly why every store got
 * "Get 15% Off Your First Order" with a 10-minute timer, forever. Temperature
 * doesn't fix that; the distribution is genuinely peaked.
 *
 * THE FIX
 * -------
 * Don't ask the model to be creative. Pre-sample the structural design space
 * ourselves with a seeded RNG, hand the model a *brief* it must design within,
 * and enforce the locked knobs server-side afterwards. Variety then comes from
 * arithmetic rather than from sampling luck, and the model does the thing it's
 * actually good at: writing copy that fits a given structure.
 *
 * Novelty memory closes the loop across campaigns: the account's recently
 * generated fingerprints and headlines are passed in as an explicit
 * do-not-repeat list, and the sampler avoids re-drawing a recent fingerprint.
 */

import {
  ACCENT_PLACEMENTS,
  ART_DIRECTIONS,
  BUTTON_SHAPES,
  CLOSE_AFFORDANCES,
  COLOR_USAGES,
  OFFER_DISPLAYS,
  DENSITIES,
  ENTRANCES,
  FORM_LAYOUTS,
  IMAGE_TREATMENTS,
  OVERLAY_WEIGHTS,
  STEP_FLOWS,
  THEMES,
  TIMER_MODES,
  TIMER_STYLES,
  TYPE_SCALES,
  dnaDistance,
  type ArtDirection,
  type PopupDna,
} from "@/lib/popupDna";

export type TemplateId = "split-screen" | "corner-toast" | "fullscreen-takeover";
export type LayoutStyle = "split-left" | "split-right" | "centered" | "minimal";

const TEMPLATE_IDS: readonly TemplateId[] = ["split-screen", "corner-toast", "fullscreen-takeover"];
const LAYOUT_STYLES: readonly LayoutStyle[] = ["split-left", "split-right", "centered", "minimal"];

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

/**
 * mulberry32 - small, fast, good enough for design sampling. Seeded so a
 * generation can be replayed exactly from the seed we persist alongside the
 * spec, which is the difference between "the popup looked wrong" and "here is
 * the popup that looked wrong".
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: (string | number)[]): number {
  const input = parts.join("::");
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function choose<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

/** Weighted choice - for knobs where the options aren't equally sensible. */
function weighted<T extends string>(rng: () => number, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// ─── Copy angles and moods ───────────────────────────────────────────────────

/**
 * The persuasion angle the headline should take. Sampling this is what stops
 * every store from getting the same "Get 15% Off Your First Order" -
 * the model isn't choosing an angle any more, it's writing to one.
 */
export const COPY_ANGLES = [
  "reciprocity - lead with the gift as already given, not as something to earn",
  "loss aversion - frame it as something they'd be walking away from",
  "genuine scarcity - a real, honest limit (first order only, limited stock), never a fabricated countdown",
  "curiosity - hint at the value without fully revealing it, so opening it is the payoff",
  "insider/community - framed as joining something, not receiving a coupon",
  "plain utility - no persuasion theatre at all, just a clear, useful exchange stated once",
  "concierge - a helpful, service-first offer that happens to include a discount",
  "celebration - tied to a genuine store milestone or a new arrival, not a fake holiday",
] as const;

export const COPY_MOODS = [
  "warm and conversational, like a note from the founder",
  "crisp and premium, minimal words, no exclamation marks",
  "playful and light, but never gimmicky",
  "direct and unadorned, verging on blunt",
  "editorial and considered, magazine-like",
  "quietly confident, understated, zero hype",
] as const;

export const CTA_SHAPES = [
  "first person, e.g. 'Send me the code'",
  "imperative verb + object, e.g. 'Unlock my offer'",
  "single word, e.g. 'Continue'",
  "benefit-restating, e.g. 'Start saving'",
  "plain and functional, e.g. 'Subscribe'",
] as const;

// ─── Art direction ───────────────────────────────────────────────────────────

/**
 * An art direction is a *coherent* set of choices, not an independent knob.
 *
 * Sampling every knob uniformly and calling the result a design is how you get
 * a serif editorial headline sitting on a pill button with a 28px radius - each
 * choice defensible, the combination incoherent. So the school is drawn first
 * and then constrains the draw: it fixes the aesthetic primitives outright
 * (typography, depth, surface) and narrows the pools the structural knobs are
 * sampled from.
 *
 * Crucially it *narrows* rather than fixes those - two editorial popups still
 * differ in density, flow, timer and layout. The combinatorics survive; they
 * just stop producing combinations no designer would ship.
 */
type ArtPreset = {
  typePairings: Partial<Record<PopupDna["type_pairing"], number>>;
  elevation: PopupDna["elevation"];
  surfaces: Partial<Record<PopupDna["surface_treatment"], number>>;
  themes: Record<PopupDna["theme"], number>;
  radii: readonly PopupDna["corner_radius"][];
  buttonShapes: readonly PopupDna["button_shape"][];
  buttonFills: Record<PopupDna["button_fill"], number>;
  densities: readonly PopupDna["density"][];
  typeScales: readonly PopupDna["type_scale"][];
  /** Odds of a left-axis composition. Centre is the exception, not the default. */
  leftAxisOdds: number;
  /** How much brand colour reaches the surface. No school is offered "accent_only". */
  colorUsages: readonly PopupDna["color_usage"][];
  /** Odds the discount renders as a display-size figure rather than a sentence. */
  heroOfferOdds: number;
  /** Photographic treatments this school will accept. */
  imageStyles: readonly PopupDna["image_style"][];
  /** Forced on for schools where the element is structural rather than optional. */
  requiresEyebrow?: boolean;
  /**
   * How many *optional* supporting elements this school will tolerate, counting
   * timer, social proof, privacy note and dismiss link.
   *
   * This is the restraint budget, and it is the most important field here.
   * Generated design is recognisable mainly by what it fails to leave out: the
   * model has an eyebrow field, a proof field, a privacy field and a dismiss
   * field, so it fills all four, and the result is eight stacked elements that
   * each dilute the one above. A designer's first move on this brief is to
   * delete three of them. Sampling each independently at ~40% put an average of
   * 1.7 on every popup and all four on roughly one in twenty - this caps it.
   */
  maxSupporting: number;
};

const ART_PRESETS: Record<ArtDirection, ArtPreset> = {
  // Print logic: paper surface, display serif, hard corners, ink-solid button,
  // and space. The eyebrow is required because the rule beneath it is what
  // carries the layout.
  editorial: {
    // A weighted SET, not one value.
    //
    // `type_pairing` used to be hard-assigned from art_direction, which made
    // it an alias rather than an axis and - far worse - made
    // `type_pairing: "brand"` unreachable. fonts.ts carries a 24-family match
    // table and resolveBrandPairing exists precisely to serve the store's own
    // typeface; nothing could ever select it, so the entire brand-font
    // pipeline (scrape in /api/analyze, carry through design_tokens, match in
    // fonts.ts) terminated in dead code. That is the strongest "this popup
    // belongs to this store" signal available, and it was switched off.
    //
    // `brand` is re-weighted upward at draw time whenever the store actually
    // has a servable typeface - see drawBrief.
    typePairings: { editorial: 6, brand: 3, grotesque: 1 },
    elevation: "raised",
    surfaces: { paper: 7, plain: 3 },
    themes: { light: 8, dark: 2, brand: 0 },
    radii: ["sharp", "soft"],
    buttonShapes: ["rect", "rounded"],
    buttonFills: { dark: 7, outline: 3, solid: 0 },
    densities: ["airy", "regular"],
    typeScales: ["large", "medium"],
    leftAxisOdds: 0.92,
    // Editorial carries colour quietly - a paper surface with a whisper of
    // accent in it, not a colour field.
    colorUsages: ["tinted_surface", "duo_accent"],
    // A 96px numeral is a poster device. Editorial states the offer in words.
    heroOfferOdds: 0.15,
    imageStyles: ["duotone", "mono"],
    requiresEyebrow: true,
    // The rule under the eyebrow and the space are the design. One more line
    // anywhere and it stops being editorial and starts being a newsletter box.
    maxSupporting: 1,
  },

  // Poster logic: the offer is the object. Heavy face, colour block, no radius,
  // no shadow - flatness is the statement.
  bold: {
    typePairings: { bold: 6, brand: 3, geometric: 1 },
    elevation: "flat",
    surfaces: { block: 7, mesh: 2, plain: 1 },
    themes: { dark: 7, light: 3, brand: 0 },
    radii: ["sharp"],
    buttonShapes: ["rect"],
    buttonFills: { solid: 7, dark: 3, outline: 0 },
    densities: ["regular", "compact"],
    typeScales: ["large"],
    leftAxisOdds: 0.85,
    colorUsages: ["saturated", "duo_accent"],
    // The number *is* the poster. This is the school the hero offer was built for.
    heroOfferOdds: 0.9,
    imageStyles: ["duotone"],
    requiresEyebrow: true,
    maxSupporting: 1,
  },

  // Software logic: layered depth, ambient accent light, generous radii, a
  // button that glows in its own colour.
  glass: {
    typePairings: { grotesque: 6, brand: 3, geometric: 1 },
    elevation: "floating",
    surfaces: { glow: 6, mesh: 3, plain: 1 },
    themes: { light: 8, brand: 2, dark: 0 },
    radii: ["rounded", "pill"],
    buttonShapes: ["rounded", "pill"],
    buttonFills: { solid: 9, outline: 1, dark: 0 },
    densities: ["regular", "airy"],
    typeScales: ["medium", "large"],
    // The one school where centring is a legitimate design choice rather than
    // a default - a glow has a centre, and the composition can sit on it.
    leftAxisOdds: 0.5,
    colorUsages: ["tinted_surface", "duo_accent"],
    heroOfferOdds: 0.55,
    imageStyles: ["duotone", "tinted", "photo"],
    maxSupporting: 2,
  },

  // Sticker logic: bright, rounded, centred, a little bouncy. The energy a
  // consumer/DTC or kids' brand has and the other three schools don't - none
  // of editorial/bold/glass will ever draw a pill radius AND a saturated
  // block surface AND a real product photo at once, and that combination is
  // exactly what "fun" looks like.
  playful: {
    typePairings: { geometric: 5, grotesque: 3, brand: 2 },
    elevation: "raised",
    surfaces: { block: 6, mesh: 4 },
    themes: { light: 9, brand: 1, dark: 0 },
    radii: ["rounded", "pill"],
    buttonShapes: ["pill", "rounded"],
    buttonFills: { solid: 9, outline: 1, dark: 0 },
    densities: ["compact", "regular"],
    typeScales: ["medium", "large"],
    // A badge has a centre. Playful is the second school (with glass) willing
    // to centre by default rather than treating it as the exception.
    leftAxisOdds: 0.35,
    colorUsages: ["saturated", "duo_accent"],
    heroOfferOdds: 0.5,
    // Real photography reads as approachable here, not stocky - a hand
    // holding the product, not a moody duotone. Tinted keeps the brand
    // palette present when there's no usable photo.
    imageStyles: ["photo", "tinted"],
    maxSupporting: 2,
  },

  // Quiet-luxury logic: the opposite instinct from every school above. Where
  // bold makes the discount the whole poster, luxury barely mentions it -
  // color_usage is the ONE place "accent_only" is the right call rather than
  // the generic-popup default it usually is, because restraint said once, on
  // purpose, is the entire brief. No pill radius, no saturated colour, almost
  // never a hero numeral: the things that read as "sale" are exactly what
  // this school exists to avoid.
  luxury: {
    typePairings: { grotesque: 5, editorial: 4, brand: 2 },
    elevation: "flat",
    surfaces: { plain: 7, paper: 3 },
    // The one school evenly split between light and dark by design - both are
    // legitimate premium looks (paper-white restraint, or black-box restraint)
    // and neither should dominate the draw the way it does elsewhere.
    themes: { light: 5, dark: 5, brand: 0 },
    radii: ["sharp", "soft"],
    buttonShapes: ["rect", "rounded"],
    // Almost never the brand's own saturated colour as a filled button - that
    // reads as a sale banner. An outline or a near-ink button is what a brand
    // that isn't trying to convince you looks like.
    buttonFills: { outline: 6, dark: 4, solid: 0 },
    densities: ["airy"],
    typeScales: ["small", "medium"],
    leftAxisOdds: 0.4,
    colorUsages: ["accent_only"],
    heroOfferOdds: 0.05,
    imageStyles: ["mono", "duotone"],
    maxSupporting: 1,
  },
};

// ─── The brief ───────────────────────────────────────────────────────────────

export type DesignBrief = {
  seed: number;
  /** Knobs the model must honour and which are re-applied server-side afterwards. */
  locked: {
    template_id: TemplateId;
    layout_style: LayoutStyle;
  } & Pick<
    PopupDna,
    | "art_direction"
    | "type_pairing"
    | "elevation"
    | "surface_treatment"
    | "text_align"
    | "color_usage"
    | "offer_display"
    | "image_style"
    | "step_flow"
    | "timer_mode"
    | "timer_style"
    | "corner_radius"
    | "button_shape"
    | "button_fill"
    | "accent_placement"
    | "density"
    | "type_scale"
    | "overlay_weight"
    | "image_treatment"
    | "entrance"
    | "theme"
    | "form_layout"
    | "close_affordance"
  >;
  /** Soft guidance the model interprets in its own words. */
  copy_angle: string;
  copy_mood: string;
  cta_shape: string;
  /** Whether the model should write an eyebrow / social proof / privacy line at all. */
  wants_eyebrow: boolean;
  wants_social_proof: boolean;
  wants_privacy_note: boolean;
  wants_dismiss_link: boolean;
  /** Structural signature, used to keep briefs apart from each other. */
  fingerprint: string;
};

/**
 * NOTE ON WHAT IS AND ISN'T IN HERE
 *
 * `elevation` is a pure function of `art_direction` (each school has one depth
 * language), so including both counts the same decision twice and inflates
 * dnaDistance - which is what decides whether two variants are "different
 * enough" to be worth testing. `type_pairing` and `surface_treatment` are now
 * genuinely independent draws, so they stay.
 */
function briefFingerprint(locked: DesignBrief["locked"], wantsEyebrow: boolean, wantsProof: boolean): string {
  return [
    locked.template_id,
    locked.layout_style,
    locked.art_direction,
    locked.type_pairing,
    locked.surface_treatment,
    locked.step_flow,
    locked.timer_mode,
    locked.image_treatment,
    locked.theme,
    locked.accent_placement,
    locked.button_shape,
    locked.density,
    locked.form_layout,
    wantsEyebrow ? "eyebrow" : "no-eyebrow",
    wantsProof ? "proof" : "no-proof",
  ].join("|");
}

export type BriefOptions = {
  /**
   * Whether the store has a display typeface we can actually serve. Gates
   * `type_pairing: "brand"` - drawing it for a store whose font we cannot load
   * produces an arm identical to the school default, which is a wasted test.
   */
  hasBrandFont?: boolean;
  /**
   * Whether the store's accent can carry white text at button size.
   *
   * When it cannot, `button_fill: "solid"` is withheld. The renderer will now
   * always produce a *readable* button (see lib/color.ts), but the honest fix
   * for a pale yellow or lime brand is not black-on-yellow - that reads as a
   * warning label, not as a brand. A dark neutral button carrying the accent on
   * its border is the design the DNA already has vocabulary for.
   */
  accentCarriesWhiteText?: boolean;
  /**
   * Corner toasts are a poor fit for a discount-reveal flow on a high-intent
   * page, and fullscreen takeovers are hostile on mobile-heavy stores. Callers
   * can narrow the pool without giving up sampling.
   */
  allowedTemplates?: readonly TemplateId[];
  /** Fingerprints this brief should avoid reproducing (novelty memory). */
  avoid?: readonly string[];
  /** Max resample attempts before accepting the closest available draw. */
  maxAttempts?: number;
  /**
   * Pin the art direction instead of drawing one. Used by explore mode to deal
   * the schools out across a variant set, so a cold-start campaign tests four
   * aesthetics head-to-head rather than four draws that might all land on the
   * same one.
   */
  artDirection?: ArtDirection;
};

function drawBrief(seed: number, opts: BriefOptions): DesignBrief {
  const rng = makeRng(seed);

  const template_id = choose(rng, opts.allowedTemplates?.length ? opts.allowedTemplates : TEMPLATE_IDS);

  // Not every layout reads well on every template: a "minimal" fullscreen
  // takeover is a contradiction in terms, and a split layout on a 340px toast
  // just means "which corner".
  const layout_style =
    template_id === "fullscreen-takeover"
      ? choose(rng, ["centered", "split-left", "split-right"] as const)
      : choose(rng, LAYOUT_STYLES);

  // The school is drawn before anything aesthetic, because everything
  // aesthetic is downstream of it.
  const art_direction = opts.artDirection ?? choose(rng, ART_DIRECTIONS);
  const preset = ART_PRESETS[art_direction];

  const theme = weighted(rng, preset.themes);

  // Timers are a genuine lever but a fabricated countdown carries a real trust
  // cost, so "none" is deliberately the most likely draw rather than the
  // always-on default it used to be.
  const timer_mode = weighted(rng, { none: 6, static_badge: 2, countdown: 2 } as Record<PopupDna["timer_mode"], number>);

  const image_treatment: PopupDna["image_treatment"] =
    template_id === "corner-toast"
      ? weighted(rng, { none: 6, top_band: 4, side: 0, background: 0 } as Record<PopupDna["image_treatment"], number>)
      : template_id === "fullscreen-takeover"
      ? weighted(rng, { background: 7, none: 3, side: 0, top_band: 0 } as Record<PopupDna["image_treatment"], number>)
      : art_direction === "bold" || layout_style === "minimal"
      ? // Bold is a type-and-colour school. An added photograph competes with
        // the number for the one piece of attention the popup gets.
        "none"
      : weighted(rng, { side: 5, top_band: 3, none: 2, background: 0 } as Record<PopupDna["image_treatment"], number>);

  // Bias toward the store's own typeface when there actually is one that
  // Google serves - otherwise `brand` degrades to the school's default anyway
  // (see resolveFonts), so drawing it would just be a wasted arm.
  const pairingWeights = { ...preset.typePairings } as Record<string, number>;
  if (opts.hasBrandFont) pairingWeights.brand = (pairingWeights.brand ?? 0) * 2;
  else delete pairingWeights.brand;

  const type_pairing = weighted(rng, pairingWeights as Record<PopupDna["type_pairing"], number>);

  const fillWeights = { ...preset.buttonFills } as Record<string, number>;
  if (opts.accentCarriesWhiteText === false && (fillWeights.dark ?? 0) + (fillWeights.outline ?? 0) > 0) {
    delete fillWeights.solid;
  }
  const surface_treatment = weighted(rng, preset.surfaces as Record<PopupDna["surface_treatment"], number>);

  const locked: DesignBrief["locked"] = {
    template_id,
    layout_style,
    art_direction,
    type_pairing,
    elevation: preset.elevation,
    surface_treatment,
    text_align: rng() < preset.leftAxisOdds ? "left" : "center",
    color_usage: choose(rng, preset.colorUsages),
    offer_display: rng() < preset.heroOfferOdds ? "hero" : "inline",
    image_style: choose(rng, preset.imageStyles),
    step_flow: choose(rng, STEP_FLOWS),
    timer_mode,
    timer_style: choose(rng, TIMER_STYLES),
    corner_radius: choose(rng, preset.radii),
    button_shape: choose(rng, preset.buttonShapes),
    button_fill: weighted(rng, fillWeights as Record<PopupDna["button_fill"], number>),
    // "background_block" fights a surface treatment that already paints the
    // content area, so it's only offered to schools that leave it alone.
    accent_placement:
      surface_treatment === "plain"
        ? choose(rng, ACCENT_PLACEMENTS)
        : choose(rng, ["button_only", "headline", "top_border"] as const),
    density: choose(rng, preset.densities),
    type_scale: choose(rng, preset.typeScales),
    // A corner toast has no backdrop, so its overlay_weight is inert and can be
    // drawn freely. For the two overlay templates it is load-bearing, and
    // drawing it uniformly meant a quarter of them shipped with a backdrop of
    // "none" - a card sitting on live, undimmed page content. Bias hard toward
    // a scrim that actually separates figure from ground.
    overlay_weight:
      template_id === "corner-toast"
        ? choose(rng, OVERLAY_WEIGHTS)
        : weighted(rng, { medium: 6, heavy: 3, light: 1, none: 0 } as Record<
            PopupDna["overlay_weight"],
            number
          >),
    image_treatment,
    entrance: choose(rng, ENTRANCES),
    theme,
    form_layout: weighted(rng, { stacked: 7, inline: 3 } as Record<PopupDna["form_layout"], number>),
    close_affordance: choose(rng, CLOSE_AFFORDANCES),
  };

  const wants_eyebrow = preset.requiresEyebrow ? true : rng() < 0.45;

  // Draw the optional elements, then spend the restraint budget on them in
  // priority order and drop the rest. Priority is by conversion value, not by
  // decorative value: a privacy line under an email field removes a real
  // objection, a social-proof line only works if it's true, and a dismiss link
  // is the first thing to cut when space is tight.
  const drawn: { key: "privacy" | "proof" | "dismiss"; on: boolean }[] = [
    { key: "privacy", on: rng() < 0.55 },
    { key: "proof", on: rng() < 0.3 },
    { key: "dismiss", on: rng() < 0.3 },
  ];

  // The timer is an optional element too, and it was never counted as one -
  // which is how a popup ended up with a countdown, an eyebrow, a proof line,
  // a privacy line and a dismiss link all at once.
  let budget = preset.maxSupporting - (timer_mode === "none" ? 0 : 1);
  const kept = new Set<string>();
  for (const item of drawn) {
    if (!item.on || budget <= 0) continue;
    kept.add(item.key);
    budget -= 1;
  }

  return {
    seed,
    locked,
    copy_angle: choose(rng, COPY_ANGLES),
    copy_mood: choose(rng, COPY_MOODS),
    cta_shape: choose(rng, CTA_SHAPES),
    wants_eyebrow,
    wants_social_proof: kept.has("proof"),
    wants_privacy_note: kept.has("privacy"),
    wants_dismiss_link: kept.has("dismiss"),
    fingerprint: briefFingerprint(locked, wants_eyebrow, kept.has("proof")),
  };
}

/**
 * Draws a brief that is structurally unlike anything in `avoid`. Resamples with
 * a derived seed rather than mutating the draw, so the result stays a
 * reproducible function of the original seed.
 */
export function buildDesignBrief(seed: number, opts: BriefOptions = {}): DesignBrief {
  const avoid = opts.avoid ?? [];
  const maxAttempts = opts.maxAttempts ?? 12;

  let best: DesignBrief | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = drawBrief(hashSeed(seed, attempt), opts);
    if (avoid.length === 0) return candidate;

    // Distance to the *nearest* thing we're avoiding is what matters - being
    // far from one recent popup is worthless if it's a clone of another.
    const nearest = Math.min(...avoid.map((f) => dnaDistance(candidate.fingerprint, f)));
    if (nearest >= 0.6) return candidate;
    if (nearest > bestScore) {
      bestScore = nearest;
      best = candidate;
    }
  }

  return best ?? drawBrief(seed, opts);
}

/** Seeded shuffle of the art directions - the deal order for an explore round. */
function dealArtDirections(seed: number): ArtDirection[] {
  const rng = makeRng(seed);
  const deck = [...ART_DIRECTIONS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Briefs for one control plus N variants, guaranteed to be mutually distinct.
 *
 * `mode` is the two-tier policy:
 * - "explore" (cold start, no meaningful traffic): variants are drawn
 *   independently, so they diverge structurally. You learn which *region* of
 *   the design space this store responds to, fast.
 * - "exploit" (a leader has emerged from real data): variants inherit the
 *   control's brief and differ on exactly one knob, so a conversion delta is
 *   attributable to that knob rather than to twelve simultaneous changes.
 */
export function buildVariantBriefs(opts: {
  seed: number;
  variantCount: number;
  mode: "explore" | "exploit";
  avoid?: readonly string[];
  allowedTemplates?: readonly TemplateId[];
  /** In exploit mode, the winning brief that variants should perturb. */
  baseBrief?: DesignBrief;
}): { control: DesignBrief; variants: DesignBrief[] } {
  const { seed, variantCount, mode, avoid = [], allowedTemplates } = opts;

  // Explore mode deals the art directions out rather than drawing each one
  // independently. With 5 schools and 3 variants, independent draws collide on
  // the same school about half the time - and a campaign that happens to test
  // "glass vs glass vs glass" learns nothing about which aesthetic this
  // store's visitors respond to, which is the whole question at cold start.
  const schoolOrder = mode === "explore" ? dealArtDirections(hashSeed(seed, "schools")) : [];

  const control =
    mode === "exploit" && opts.baseBrief
      ? opts.baseBrief
      : buildDesignBrief(hashSeed(seed, "control"), {
          avoid,
          allowedTemplates,
          artDirection: schoolOrder[0],
        });

  const variants: DesignBrief[] = [];
  const taken = [...avoid, control.fingerprint];

  for (let i = 0; i < variantCount; i++) {
    if (mode === "explore") {
      const brief = buildDesignBrief(hashSeed(seed, "variant", i), {
        avoid: taken,
        allowedTemplates,
        artDirection: schoolOrder[(i + 1) % schoolOrder.length],
      });
      taken.push(brief.fingerprint);
      variants.push(brief);
    } else {
      variants.push(perturbBrief(control, hashSeed(seed, "perturb", i), i));
    }
  }

  return { control, variants };
}

/**
 * Exploit-mode variant: the control's brief with exactly one knob changed.
 * Which knob rotates with the index so a round of variants doesn't all poke at
 * the same dimension.
 */
const PERTURBABLE = [
  // Art direction leads the rotation: it's the largest single visual difference
  // available, so it's the fastest thing to get a clean read on. Perturbing it
  // re-derives the whole preset - see perturbBrief.
  "art_direction",
  "color_usage",
  "offer_display",
  "timer_mode",
  "step_flow",
  "form_layout",
  "button_shape",
  "theme",
  "density",
  "accent_placement",
  "image_treatment",
  "type_scale",
  "close_affordance",
] as const;

const PERTURB_POOLS: Record<(typeof PERTURBABLE)[number], readonly string[]> = {
  art_direction: ART_DIRECTIONS,
  color_usage: COLOR_USAGES,
  offer_display: OFFER_DISPLAYS,
  timer_mode: TIMER_MODES,
  step_flow: STEP_FLOWS,
  form_layout: FORM_LAYOUTS,
  button_shape: BUTTON_SHAPES,
  theme: THEMES,
  density: DENSITIES,
  accent_placement: ACCENT_PLACEMENTS,
  image_treatment: IMAGE_TREATMENTS,
  type_scale: TYPE_SCALES,
  close_affordance: CLOSE_AFFORDANCES,
};

export function perturbBrief(base: DesignBrief, seed: number, index: number): DesignBrief {
  const rng = makeRng(seed);
  const knob = PERTURBABLE[index % PERTURBABLE.length];
  const pool = PERTURB_POOLS[knob].filter((v) => v !== (base.locked as Record<string, unknown>)[knob]);
  const next = pool.length > 0 ? choose(rng, pool) : (base.locked as Record<string, unknown>)[knob];

  let locked = { ...base.locked, [knob]: next } as DesignBrief["locked"];

  // Art direction isn't a knob you can swap in isolation - swapping it while
  // leaving the old preset's typography, depth and surface behind produces a
  // hybrid that belongs to no school and tests nothing. Re-derive the preset so
  // the perturbation is a coherent alternative design, which is what makes the
  // conversion delta attributable to "the aesthetic" at all.
  if (knob === "art_direction") {
    const preset = ART_PRESETS[next as ArtDirection];
    locked = {
      ...locked,
      type_pairing: weighted(rng, preset.typePairings as Record<PopupDna["type_pairing"], number>),
      elevation: preset.elevation,
      surface_treatment: weighted(rng, preset.surfaces as Record<PopupDna["surface_treatment"], number>),
      text_align: rng() < preset.leftAxisOdds ? "left" : "center",
      // Re-drawn from the new school's own pools - a bold popup that kept
      // editorial's quiet tint and inline offer isn't a bold popup.
      color_usage: choose(rng, preset.colorUsages),
      offer_display: rng() < preset.heroOfferOdds ? "hero" : "inline",
      image_style: choose(rng, preset.imageStyles),
      corner_radius: choose(rng, preset.radii),
      button_shape: choose(rng, preset.buttonShapes),
      button_fill: weighted(rng, preset.buttonFills),
      density: choose(rng, preset.densities),
      type_scale: choose(rng, preset.typeScales),
      theme: weighted(rng, preset.themes),
    };
  }

  const wants_eyebrow =
    ART_PRESETS[locked.art_direction].requiresEyebrow === true ? true : base.wants_eyebrow;

  return {
    ...base,
    seed,
    locked,
    wants_eyebrow,
    fingerprint: briefFingerprint(locked, wants_eyebrow, base.wants_social_proof),
  };
}

/**
 * Reconstructs a brief from a popup that already shipped.
 *
 * Exploit mode perturbs the *current control*, not a freshly sampled design -
 * otherwise "change one knob and measure" would be measuring against a popup
 * nobody has ever seen. Copy direction is re-sampled, since the structure is
 * what we're holding constant, not the wording.
 */
export function briefFromSpec(
  spec: { template_id?: string | null; layout_style?: string | null; dna?: unknown },
  seed: number,
): DesignBrief {
  const rng = makeRng(seed);
  const dna = (spec.dna ?? {}) as Partial<PopupDna>;
  const fallback = drawBrief(seed, {});

  const locked: DesignBrief["locked"] = {
    template_id: (TEMPLATE_IDS.includes(spec.template_id as TemplateId)
      ? spec.template_id
      : fallback.locked.template_id) as TemplateId,
    layout_style: (LAYOUT_STYLES.includes(spec.layout_style as LayoutStyle)
      ? spec.layout_style
      : fallback.locked.layout_style) as LayoutStyle,
    art_direction: dna.art_direction ?? fallback.locked.art_direction,
    type_pairing: dna.type_pairing ?? fallback.locked.type_pairing,
    elevation: dna.elevation ?? fallback.locked.elevation,
    surface_treatment: dna.surface_treatment ?? fallback.locked.surface_treatment,
    text_align: dna.text_align ?? fallback.locked.text_align,
    color_usage: dna.color_usage ?? fallback.locked.color_usage,
    offer_display: dna.offer_display ?? fallback.locked.offer_display,
    image_style: dna.image_style ?? fallback.locked.image_style,
    step_flow: dna.step_flow ?? fallback.locked.step_flow,
    timer_mode: dna.timer_mode ?? fallback.locked.timer_mode,
    timer_style: dna.timer_style ?? fallback.locked.timer_style,
    corner_radius: dna.corner_radius ?? fallback.locked.corner_radius,
    button_shape: dna.button_shape ?? fallback.locked.button_shape,
    button_fill: dna.button_fill ?? fallback.locked.button_fill,
    accent_placement: dna.accent_placement ?? fallback.locked.accent_placement,
    density: dna.density ?? fallback.locked.density,
    type_scale: dna.type_scale ?? fallback.locked.type_scale,
    overlay_weight: dna.overlay_weight ?? fallback.locked.overlay_weight,
    image_treatment: dna.image_treatment ?? fallback.locked.image_treatment,
    entrance: dna.entrance ?? fallback.locked.entrance,
    theme: dna.theme ?? fallback.locked.theme,
    form_layout: dna.form_layout ?? fallback.locked.form_layout,
    close_affordance: dna.close_affordance ?? fallback.locked.close_affordance,
  };

  const wants_eyebrow = Boolean(dna.eyebrow);
  const wants_social_proof = Boolean(dna.social_proof);

  return {
    seed,
    locked,
    copy_angle: choose(rng, COPY_ANGLES),
    copy_mood: choose(rng, COPY_MOODS),
    cta_shape: choose(rng, CTA_SHAPES),
    wants_eyebrow,
    wants_social_proof,
    wants_privacy_note: Boolean(dna.privacy_note),
    wants_dismiss_link: Boolean(dna.dismiss_text),
    fingerprint: briefFingerprint(locked, wants_eyebrow, wants_social_proof),
  };
}

// ─── Prompt rendering ────────────────────────────────────────────────────────

/**
 * What each school means *for the copy*. The model can't see the CSS, so
 * without this it writes the same sentence for a poster and for a piece of
 * editorial and the words fight the design they're sitting in.
 */
const ART_DIRECTION_BRIEF: Record<ArtDirection, string> = {
  editorial:
    "print sensibility, display serif on warm paper. Write like a magazine standfirst, not an ad: full sentences, no exclamation marks, no urgency theatre. The discount is mentioned plainly, once",
  bold:
    "poster. The discount NUMBER is the hero and the type is enormous, so the headline must be 3-5 words maximum and read as a statement, not a sentence. Uppercase-friendly. Blunt",
  glass:
    "modern software. Warm, plain-spoken, a little generous. Short sentences. Sounds like a helpful product, not a promotion",
  playful:
    "a brand you'd actually text back. Upbeat and a little cheeky, but never juvenile - no baby-talk, no excess exclamation. Says the deal plainly and moves on rather than over-explaining it",
  luxury:
    "quiet confidence, said once and left alone. No hype words, no urgency language, no exclamation marks. Speaks the way a brand that doesn't need to convince you would - understated and precise, never apologetic about how little it's saying",
};

/**
 * The rules that separate copy a person wrote from copy a model produced.
 *
 * Every one of these is a specific observed failure, not general advice. The
 * biggest by far is the first: the model's default is a headline that states
 * the offer and a subhead that states the same offer again in different words
 * ("Get 15% off your first order" / "Sign up and we'll send your code"). Two
 * lines carrying one idea is the clearest tell there is, and no amount of
 * typography rescues it.
 */
const COPY_DISCIPLINE = `  COPY DISCIPLINE (these are hard rules - a violation is a rewrite, not a preference):
  - The subhead must NOT restate the headline. If the headline names the offer,
    the subhead must add something the reader did not already know - what the
    products are, when the email arrives, why the offer exists. If you have
    nothing to add, write a shorter subhead rather than a paraphrase.
  - Headline: 8 words maximum. Under 5 for type_scale "large".
  - Subhead: one sentence. Never two.
  - Banned openings: "Get", "Unlock", "Don't miss", "Join thousands", "Hurry".
    Banned words anywhere: "exclusive", "amazing", "elevate", "seamless",
    "curated", "treat yourself", "levels up".
  - No exclamation marks anywhere, in any field.
  - Write for this specific store. A line that would work equally well for a
    coffee roaster and a phone-case shop is a line to throw away.
  - The CTA repeats the offer's verb, not the form's mechanics. "Send my code"
    over "Submit". Never "Subscribe" unless the whole popup is about a newsletter.`;

/** Renders a brief as the instruction block appended to the model's input. */
export function briefToPromptSection(brief: DesignBrief, label: string): string {
  const l = brief.locked;
  return `${label}
  REQUIRED STRUCTURE (these are not suggestions - they are re-applied server-side, so
  write copy that actually fits them):
  - template_id: ${l.template_id}
  - layout_style: ${l.layout_style}
  - dna.art_direction: ${l.art_direction} - ${ART_DIRECTION_BRIEF[l.art_direction]}
  - dna.type_pairing: ${l.type_pairing} (fixed by the art direction; do not restate it)
  - dna.elevation: ${l.elevation}
  - dna.surface_treatment: ${l.surface_treatment}
  - dna.color_usage: ${l.color_usage} (the card surface itself carries brand colour - do not describe the popup as "clean" or "white")
  - dna.offer_display: ${l.offer_display}${l.offer_display === "hero" ? " - THE DISCOUNT NUMBER IS RENDERED SEPARATELY at display size above the headline. Set discount_percent, and do NOT repeat the number in the headline; write a headline that works alongside a giant figure it must not duplicate" : " (no display figure - the headline carries the offer)"}
  - dna.image_style: ${l.image_style}
  - dna.text_align: ${l.text_align}${l.text_align === "left" ? " (left-axis composition - the headline sits against a left edge and is capped to a short measure, so write something that breaks naturally over 2-3 lines)" : " (centred composition - keep every line short; centred text with ragged long lines reads as broken)"}
  - dna.step_flow:${l.step_flow}${l.step_flow === "one_step" ? " (the offer and the email field share ONE screen - there is no teaser click, so the headline must carry the whole ask)" : " (teaser screen first, email field after the click)"}
  - dna.timer_mode: ${l.timer_mode}${l.timer_mode === "none" ? " (no countdown at all - do NOT write copy that references a ticking clock)" : l.timer_mode === "countdown" ? " (choose a believable timer_seconds and only claim urgency you'd honour)" : " (a static urgency badge - write timer_label, no countdown)"}
  - dna.timer_style: ${l.timer_style}
  - dna.theme: ${l.theme}
  - dna.image_treatment: ${l.image_treatment}${l.image_treatment === "none" ? " (text-only - image_url should be null)" : ""}
  - dna.corner_radius: ${l.corner_radius}
  - dna.button_shape: ${l.button_shape}
  - dna.button_fill: ${l.button_fill}
  - dna.accent_placement: ${l.accent_placement}
  - dna.density: ${l.density}
  - dna.type_scale: ${l.type_scale}${l.type_scale === "large" ? " (large type means FEWER words - keep the headline to 4 words or under)" : ""}
  - dna.overlay_weight: ${l.overlay_weight}
  - dna.entrance: ${l.entrance}
  - dna.form_layout: ${l.form_layout}${l.form_layout === "inline" ? " (input and button sit side by side - the button label must be 1-2 words)" : ""}
  - dna.close_affordance: ${l.close_affordance}

${COPY_DISCIPLINE}

  COPY DIRECTION:
  - Angle: ${brief.copy_angle}
  - Voice: ${brief.copy_mood}
  - CTA shape: ${brief.cta_shape}
  - dna.eyebrow: ${brief.wants_eyebrow ? "write a short kicker (2-4 words) that is NOT \"Limited Time Offer\" or any variation of it" : "null - no kicker on this popup"}
  - dna.social_proof: ${brief.wants_social_proof ? "write one short line, but ONLY if it would be plausibly true for this store; otherwise null" : "null"}
  - dna.privacy_note: ${brief.wants_privacy_note ? "write a short reassurance line under the form" : "null"}
  - dna.dismiss_text: ${brief.wants_dismiss_link ? "write a low-key opt-out link (do NOT use guilt-trip phrasing like \"No thanks, I'll pay full price\")" : "null"}`;
}

/**
 * Re-applies the locked knobs after generation. The prompt asks; this enforces.
 * Without it, a model that quietly ignores the brief takes us straight back to
 * every popup looking the same.
 */
export function enforceBrief<T extends { template_id?: string; layout_style?: string; dna?: unknown }>(
  spec: T,
  brief: DesignBrief,
): T {
  const l = brief.locked;
  const dna = (spec.dna ?? {}) as Record<string, unknown>;
  return {
    ...spec,
    template_id: l.template_id,
    layout_style: l.layout_style,
    dna: {
      ...dna,
      art_direction: l.art_direction,
      type_pairing: l.type_pairing,
      elevation: l.elevation,
      surface_treatment: l.surface_treatment,
      text_align: l.text_align,
      color_usage: l.color_usage,
      offer_display: l.offer_display,
      image_style: l.image_style,
      step_flow: l.step_flow,
      timer_mode: l.timer_mode,
      timer_style: l.timer_style,
      corner_radius: l.corner_radius,
      button_shape: l.button_shape,
      button_fill: l.button_fill,
      accent_placement: l.accent_placement,
      density: l.density,
      type_scale: l.type_scale,
      overlay_weight: l.overlay_weight,
      image_treatment: l.image_treatment,
      entrance: l.entrance,
      theme: l.theme,
      form_layout: l.form_layout,
      close_affordance: l.close_affordance,
      // Copy-bearing knobs stay as the model wrote them, but a brief that said
      // "no eyebrow" is honoured even if the model wrote one anyway.
      eyebrow: brief.wants_eyebrow ? dna.eyebrow ?? null : null,
      social_proof: brief.wants_social_proof ? dna.social_proof ?? null : null,
      privacy_note: brief.wants_privacy_note ? dna.privacy_note ?? null : null,
      dismiss_text: brief.wants_dismiss_link ? dna.dismiss_text ?? null : null,
    },
  };
}
