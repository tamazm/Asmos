/**
 * lib/color.ts
 *
 * Colour arithmetic for the popup renderer.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every popup used to put `#ffffff` on the store's brand colour and hope. For a
 * navy or forest-green brand that is fine. For a yellow, coral, lime or cyan
 * brand it is unreadable: an audit of 400 generated popups (16 realistic brand
 * colours x 25 seeded design briefs) measured 34.5% of CTA labels below the
 * WCAG AA 4.5:1 threshold and 15% below 1.6:1, which is invisible.
 *
 * That is not only an accessibility failure, it is a measurement failure. An
 * unreadable button is an arm the bandit has to spend thousands of real
 * impressions learning to avoid. Contrast is a deterministic property of a
 * popup; it should be decided at render time, for free, rather than discovered
 * by Thompson sampling at the cost of live traffic.
 *
 * Everything here is dependency-free and runs on both the server (token
 * generation) and in Node during tests.
 */

export type Rgb = { r: number; g: number; b: number };

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parses `#rgb` / `#rrggbb`. Returns null for anything else (incl. rgb(), color-mix()). */
export function parseHex(value: string | null | undefined): Rgb | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!HEX_RE.test(v)) return null;
  let hex = v.slice(1);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Parses the `rgba(r, g, b, a)` form the theme tables use for muted ink and
 * hairlines. Returns the colour plus its alpha so it can be composited.
 */
export function parseRgba(value: string | null | undefined): { rgb: Rgb; alpha: number } | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return null;
  const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
  return {
    rgb: { r: parts[0], g: parts[1], b: parts[2] },
    alpha: parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1,
  };
}

/**
 * Resolves any token the theme tables emit - hex or rgba - to an opaque hex,
 * compositing over `backdrop` when it is translucent. Returns null for anything
 * else (a `color-mix()` string, a CSS variable), so callers can skip rather
 * than guess.
 */
export function resolveToHex(value: string, backdrop: string): string | null {
  const direct = parseHex(value);
  if (direct) return toHex(direct);
  const rgba = parseRgba(value);
  const bd = parseHex(backdrop);
  if (!rgba || !bd) return null;
  return toHex(flatten(rgba.rgb, rgba.alpha, bd));
}

/**
 * The numeric equivalent of the renderer's `color-mix(in srgb, accent P%, base)`.
 *
 * Needed because contrast has to be measured against the surface that actually
 * paints. Measuring against the untinted base leaves a 5-12% error, which is
 * exactly enough to let a pair land at 4.2:1 while the maths believed it was at
 * 4.6:1 - the whole residual failure band after the first pass of this fix.
 */
export function mixHex(base: string, accent: string, percent: number): string {
  if (percent <= 0) return base;
  const b = parseHex(base);
  const a = parseHex(accent);
  if (!b || !a) return base;
  const t = Math.max(0, Math.min(100, percent)) / 100;
  return toHex({
    r: a.r * t + b.r * (1 - t),
    g: a.g * t + b.g * (1 - t),
    b: a.b * t + b.b * (1 - t),
  });
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(rgb: Rgb): number {
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Convenience: contrast between two hex strings. Returns null if either is unparseable. */
export function contrastHex(a: string, b: string): number | null {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return null;
  return contrastRatio(ra, rb);
}

/**
 * Composites a translucent colour over an opaque backdrop so the result can be
 * measured. Token values like `rgba(255,255,255,0.56)` are common for muted
 * text, and measuring them against the surface without compositing overstates
 * their contrast.
 */
export function flatten(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  const a = Math.max(0, Math.min(1, alpha));
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

/**
 * The ink to place on a given surface.
 *
 * Deliberately returns one of two supplied tokens rather than pure black or
 * pure white: a popup's near-black is part of its art direction (editorial
 * uses a warm `#22201C`, glass a cool `#141428`), and swapping in `#000000`
 * because a contrast check failed would undo the school it belongs to.
 *
 * Picks whichever of `ink` / `paper` has more contrast, so it degrades sanely
 * even when neither clears 4.5:1 (see `ensureContrast` for that case).
 */
export function onColor(surface: string, ink = "#141417", paper = "#ffffff"): string {
  const s = parseHex(surface);
  const i = parseHex(ink);
  const p = parseHex(paper);
  if (!s || !i || !p) return ink;
  return contrastRatio(i, s) >= contrastRatio(p, s) ? ink : paper;
}

/** True when the surface is light enough that dark ink is the right choice. */
export function isLightSurface(surface: string): boolean {
  const s = parseHex(surface);
  if (!s) return true;
  return relativeLuminance(s) > 0.42;
}

/**
 * Nudges `fg` along the lightness axis until it clears `target` against `bg`.
 *
 * Works in sRGB rather than OKLCH on purpose: the whole module has to run
 * inside the template renderer with no dependencies, and for the narrow job of
 * "make this text legible without changing its hue" a gamma-aware scale toward
 * black or white is indistinguishable from the perceptual version at the sizes
 * involved. Hue and relative saturation are preserved because all three
 * channels move by the same factor.
 *
 * Returns `fg` untouched when it already clears, and gives up gracefully at
 * pure black/white rather than looping.
 */
export function ensureContrast(fg: string, bg: string, target = 4.5): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return fg;
  if (contrastRatio(f, b) >= target) return fg;

  // Decide which direction has headroom: if the backdrop is light we darken the
  // foreground, otherwise we lighten it.
  const towardBlack = relativeLuminance(b) > 0.18;
  const at = (t: number): Rgb =>
    towardBlack
      ? { r: f.r * (1 - t), g: f.g * (1 - t), b: f.b * (1 - t) }
      : { r: f.r + (255 - f.r) * t, g: f.g + (255 - f.g) * t, b: f.b + (255 - f.b) * t };

  // Contrast is monotonic in t here (we are moving strictly toward one
  // luminance extreme), so binary search converges exactly. A fixed-step scan
  // stops at whichever step first clears, which lands a little under target
  // once quantised back to 8-bit - the difference between shipping 4.48:1 and
  // 4.5:1, which is the difference between failing and passing the check.
  if (contrastRatio(at(1), b) < target) return toHex(at(1)); // no headroom; give the best there is

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(at(mid), b) >= target) hi = mid;
    else lo = mid;
  }
  // Step out until the *rounded* colour also clears, so what ships passes.
  for (let t = hi; t <= 1.0001; t += 0.01) {
    const candidate = parseHex(toHex(at(Math.min(t, 1))));
    if (candidate && contrastRatio(candidate, b) >= target) return toHex(at(Math.min(t, 1)));
  }
  return toHex(at(1));
}

/**
 * Whether a brand colour can carry white text at button size.
 *
 * Used to constrain the design-brief sampler: a store whose accent fails this
 * should never be dealt `button_fill: "solid"`, because the honest fix at
 * render time (black text on pale yellow) reads as a warning label rather than
 * as a brand. Those stores get a dark neutral button with the accent carried on
 * a border or the surface instead, which is a choice the DNA already has
 * vocabulary for.
 */
export function accentCarriesWhiteText(accent: string, target = 4.5): boolean {
  const ratio = contrastHex("#ffffff", accent);
  return ratio !== null && ratio >= target;
}

/** How readable an accent is as *text* on a light card. Drives eyebrow/headline accent use. */
export function accentReadableAsText(accent: string, surface: string, target = 4.5): boolean {
  const ratio = contrastHex(accent, surface);
  return ratio !== null && ratio >= target;
}

// ─── Render-time assertion ───────────────────────────────────────────────────

export type ContrastPair = { role: string; fg: string; bg: string; target: number };
export type ContrastViolation = ContrastPair & { ratio: number };

/**
 * Checks the resolved token set and returns anything that would ship unreadable.
 *
 * Called from `renderPopupTemplate`. Pairs whose colours aren't plain hex (a
 * `color-mix()` surface, say) are skipped rather than guessed at: this is a
 * backstop for the arithmetic above, not a substitute for it.
 */
export function findContrastViolations(pairs: ContrastPair[]): ContrastViolation[] {
  const out: ContrastViolation[] = [];
  for (const pair of pairs) {
    const ratio = contrastHex(pair.fg, pair.bg);
    if (ratio === null) continue;
    if (ratio < pair.target) out.push({ ...pair, ratio: Math.round(ratio * 100) / 100 });
  }
  return out;
}
