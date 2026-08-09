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
 * distribution every time — which is exactly why every store got
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
  BUTTON_SHAPES,
  CLOSE_AFFORDANCES,
  CORNER_RADII,
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
  type PopupDna,
} from "@/lib/popupDna";

export type TemplateId = "split-screen" | "corner-toast" | "fullscreen-takeover";
export type LayoutStyle = "split-left" | "split-right" | "centered" | "minimal";

const TEMPLATE_IDS: readonly TemplateId[] = ["split-screen", "corner-toast", "fullscreen-takeover"];
const LAYOUT_STYLES: readonly LayoutStyle[] = ["split-left", "split-right", "centered", "minimal"];

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

/**
 * mulberry32 — small, fast, good enough for design sampling. Seeded so a
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

/** Weighted choice — for knobs where the options aren't equally sensible. */
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
 * every store from getting the same "Get 15% Off Your First Order" —
 * the model isn't choosing an angle any more, it's writing to one.
 */
export const COPY_ANGLES = [
  "reciprocity — lead with the gift as already given, not as something to earn",
  "loss aversion — frame it as something they'd be walking away from",
  "genuine scarcity — a real, honest limit (first order only, limited stock), never a fabricated countdown",
  "curiosity — hint at the value without fully revealing it, so opening it is the payoff",
  "insider/community — framed as joining something, not receiving a coupon",
  "plain utility — no persuasion theatre at all, just a clear, useful exchange stated once",
  "concierge — a helpful, service-first offer that happens to include a discount",
  "celebration — tied to a genuine store milestone or a new arrival, not a fake holiday",
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

// ─── The brief ───────────────────────────────────────────────────────────────

export type DesignBrief = {
  seed: number;
  /** Knobs the model must honour and which are re-applied server-side afterwards. */
  locked: {
    template_id: TemplateId;
    layout_style: LayoutStyle;
  } & Pick<
    PopupDna,
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

function briefFingerprint(locked: DesignBrief["locked"], wantsEyebrow: boolean, wantsProof: boolean): string {
  return [
    locked.template_id,
    locked.layout_style,
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
   * Corner toasts are a poor fit for a discount-reveal flow on a high-intent
   * page, and fullscreen takeovers are hostile on mobile-heavy stores. Callers
   * can narrow the pool without giving up sampling.
   */
  allowedTemplates?: readonly TemplateId[];
  /** Fingerprints this brief should avoid reproducing (novelty memory). */
  avoid?: readonly string[];
  /** Max resample attempts before accepting the closest available draw. */
  maxAttempts?: number;
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

  const theme = weighted(rng, { light: 5, dark: 3, brand: 2 } as Record<PopupDna["theme"], number>);

  // Timers are a genuine lever but a fabricated countdown carries a real trust
  // cost, so "none" is deliberately the most likely draw rather than the
  // always-on default it used to be.
  const timer_mode = weighted(rng, { none: 6, static_badge: 2, countdown: 2 } as Record<PopupDna["timer_mode"], number>);

  const image_treatment: PopupDna["image_treatment"] =
    template_id === "corner-toast"
      ? weighted(rng, { none: 6, top_band: 4, side: 0, background: 0 } as Record<PopupDna["image_treatment"], number>)
      : template_id === "fullscreen-takeover"
      ? weighted(rng, { background: 7, none: 3, side: 0, top_band: 0 } as Record<PopupDna["image_treatment"], number>)
      : layout_style === "minimal"
      ? "none"
      : weighted(rng, { side: 5, top_band: 3, none: 2, background: 0 } as Record<PopupDna["image_treatment"], number>);

  const locked: DesignBrief["locked"] = {
    template_id,
    layout_style,
    step_flow: choose(rng, STEP_FLOWS),
    timer_mode,
    timer_style: choose(rng, TIMER_STYLES),
    corner_radius: choose(rng, CORNER_RADII),
    button_shape: choose(rng, BUTTON_SHAPES),
    button_fill: weighted(rng, { solid: 6, dark: 2, outline: 2 } as Record<PopupDna["button_fill"], number>),
    accent_placement: choose(rng, ACCENT_PLACEMENTS),
    density: choose(rng, DENSITIES),
    type_scale: choose(rng, TYPE_SCALES),
    overlay_weight: choose(rng, OVERLAY_WEIGHTS),
    image_treatment,
    entrance: choose(rng, ENTRANCES),
    theme,
    form_layout: weighted(rng, { stacked: 7, inline: 3 } as Record<PopupDna["form_layout"], number>),
    close_affordance: choose(rng, CLOSE_AFFORDANCES),
  };

  const wants_eyebrow = rng() < 0.45;
  const wants_social_proof = rng() < 0.35;
  const wants_privacy_note = rng() < 0.5;
  const wants_dismiss_link = rng() < 0.4;

  return {
    seed,
    locked,
    copy_angle: choose(rng, COPY_ANGLES),
    copy_mood: choose(rng, COPY_MOODS),
    cta_shape: choose(rng, CTA_SHAPES),
    wants_eyebrow,
    wants_social_proof,
    wants_privacy_note,
    wants_dismiss_link,
    fingerprint: briefFingerprint(locked, wants_eyebrow, wants_social_proof),
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

    // Distance to the *nearest* thing we're avoiding is what matters — being
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

  const control =
    mode === "exploit" && opts.baseBrief
      ? opts.baseBrief
      : buildDesignBrief(hashSeed(seed, "control"), { avoid, allowedTemplates });

  const variants: DesignBrief[] = [];
  const taken = [...avoid, control.fingerprint];

  for (let i = 0; i < variantCount; i++) {
    if (mode === "explore") {
      const brief = buildDesignBrief(hashSeed(seed, "variant", i), { avoid: taken, allowedTemplates });
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

  const locked = { ...base.locked, [knob]: next } as DesignBrief["locked"];

  return {
    ...base,
    seed,
    locked,
    fingerprint: briefFingerprint(locked, base.wants_eyebrow, base.wants_social_proof),
  };
}

/**
 * Reconstructs a brief from a popup that already shipped.
 *
 * Exploit mode perturbs the *current control*, not a freshly sampled design —
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

/** Renders a brief as the instruction block appended to the model's input. */
export function briefToPromptSection(brief: DesignBrief, label: string): string {
  const l = brief.locked;
  return `${label}
  REQUIRED STRUCTURE (these are not suggestions — they are re-applied server-side, so
  write copy that actually fits them):
  - template_id: ${l.template_id}
  - layout_style: ${l.layout_style}
  - dna.step_flow: ${l.step_flow}${l.step_flow === "one_step" ? " (the offer and the email field share ONE screen — there is no teaser click, so the headline must carry the whole ask)" : " (teaser screen first, email field after the click)"}
  - dna.timer_mode: ${l.timer_mode}${l.timer_mode === "none" ? " (no countdown at all — do NOT write copy that references a ticking clock)" : l.timer_mode === "countdown" ? " (choose a believable timer_seconds and only claim urgency you'd honour)" : " (a static urgency badge — write timer_label, no countdown)"}
  - dna.timer_style: ${l.timer_style}
  - dna.theme: ${l.theme}
  - dna.image_treatment: ${l.image_treatment}${l.image_treatment === "none" ? " (text-only — image_url should be null)" : ""}
  - dna.corner_radius: ${l.corner_radius}
  - dna.button_shape: ${l.button_shape}
  - dna.button_fill: ${l.button_fill}
  - dna.accent_placement: ${l.accent_placement}
  - dna.density: ${l.density}
  - dna.type_scale: ${l.type_scale}${l.type_scale === "large" ? " (large type means FEWER words — keep the headline to 4 words or under)" : ""}
  - dna.overlay_weight: ${l.overlay_weight}
  - dna.entrance: ${l.entrance}
  - dna.form_layout: ${l.form_layout}${l.form_layout === "inline" ? " (input and button sit side by side — the button label must be 1-2 words)" : ""}
  - dna.close_affordance: ${l.close_affordance}

  COPY DIRECTION:
  - Angle: ${brief.copy_angle}
  - Voice: ${brief.copy_mood}
  - CTA shape: ${brief.cta_shape}
  - dna.eyebrow: ${brief.wants_eyebrow ? "write a short kicker (2-4 words) that is NOT \"Limited Time Offer\" or any variation of it" : "null — no kicker on this popup"}
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
