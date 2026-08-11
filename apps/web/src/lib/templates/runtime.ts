import { DEFAULT_DNA, type PopupDna } from "@/lib/popupDna";
import type { PopupTemplateProps } from "./types";

/**
 * lib/templates/runtime.ts
 *
 * The shared markup + behaviour for every popup template.
 *
 * Previously each of the three templates carried its own near-identical copy
 * of the step machine, timer, form handler and tracking hooks — about 150
 * duplicated lines apiece, which is why the hardcoded "10:00" countdown and
 * "Limited Time Offer" eyebrow survived three separate "make popups vary"
 * passes. Templates now own *structure* only; everything below is written once.
 *
 * Telemetry contract: the runtime calls `window.__asmos_track_event(type, extra)`
 * when widget.js has installed it, and no-ops otherwise (dashboard preview,
 * /store-preview, standalone render).
 */

// ─── Escaping ────────────────────────────────────────────────────────────────

/**
 * Model-authored copy is interpolated into HTML that runs on a merchant's
 * production site. Escaping isn't optional here even though the source is our
 * own model: a store name or fixed-prize description echoed back through the
 * prompt is genuinely user-controlled input.
 */
export function esc(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Flow resolution ─────────────────────────────────────────────────────────

export type ResolvedFlow = {
  /** Teaser step exists (goal BOTH + two_step only). */
  hasTeaser: boolean;
  /** Email capture step exists. */
  hasCapture: boolean;
  /** Coupon reveal step exists. */
  hasReveal: boolean;
  /** Success confirmation step exists (EMAIL goal). */
  hasSuccess: boolean;
  /** Step the popup opens on. */
  startingStep: number;
  /** Step to advance to after a successful submit. */
  postSubmitStep: number;
};

export function resolveFlow(goal: PopupTemplateProps["goal"], dna: PopupDna): ResolvedFlow {
  const g = goal ?? "BOTH";
  const hasCapture = g === "BOTH" || g === "EMAIL";
  const hasReveal = g === "BOTH" || g === "DISCOUNT";
  const hasSuccess = g === "EMAIL";
  // The teaser only exists for the two-step BOTH flow. "one_step" is the real
  // structural fork: offer and email field on a single screen.
  const hasTeaser = g === "BOTH" && dna.step_flow === "two_step";

  // Derive the opening step from which steps actually exist, never from the
  // goal alone. The previous form (`g === "BOTH" ? 1 : 2`) opened a BOTH popup
  // on step 1 even when step_flow was "one_step" — and in that flow no step 1
  // is rendered at all. Every remaining section kept its `hidden` attribute,
  // `.popup-step[hidden] { display: none !important }` did its job, and the
  // popup shipped as an empty card with nothing but a close button in it.
  const startingStep = hasTeaser ? 1 : hasCapture ? 2 : 3;
  const postSubmitStep = hasReveal ? 3 : 4;

  return { hasTeaser, hasCapture, hasReveal, hasSuccess, startingStep, postSubmitStep };
}

// ─── Fallback copy rotation ──────────────────────────────────────────────────

/**
 * Copy shown when a spec carries no step copy of its own — i.e. a Variant row
 * written before the DNA existed, or a model response that came back empty.
 *
 * These rotate on a hash of the popup's own headline rather than being fixed
 * strings, because a constant fallback is exactly how "Almost there" and
 * "Your code is ready" ended up on every popup in the product. A fallback that
 * is identical everywhere is a fallback that eventually becomes the product.
 */
const FALLBACK_CAPTURE: { headline: string; subhead: string; cta: string }[] = [
  { headline: "One last step", subhead: "Tell us where to send it.", cta: "Send it over" },
  { headline: "Where should we send it?", subhead: "Drop your email and it's yours.", cta: "Claim it" },
  { headline: "Nearly yours", subhead: "Add your email to finish up.", cta: "Finish up" },
  { headline: "Let's get this to you", subhead: "We'll email it straight over.", cta: "Email it to me" },
];

const FALLBACK_REVEAL: { headline: string; subhead: string; cta: string }[] = [
  { headline: "Here it is", subhead: "Apply this at checkout.", cta: "Start shopping" },
  { headline: "All yours", subhead: "Paste this code at checkout.", cta: "Browse now" },
  { headline: "Ready when you are", subhead: "Use it on your next order.", cta: "Have a look" },
  { headline: "Done", subhead: "Your code works at checkout.", cta: "Shop the range" },
];

function stableIndex(input: string, modulo: number): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % modulo;
}

/** Substitutes rotating copy only where the DNA still holds the module default. */
function resolveStepCopy(dna: PopupDna, headline: string) {
  const capture = FALLBACK_CAPTURE[stableIndex(headline || "asmos", FALLBACK_CAPTURE.length)];
  const reveal = FALLBACK_REVEAL[stableIndex((headline || "asmos") + "r", FALLBACK_REVEAL.length)];

  const orRotate = (value: string, fallbackValue: string, rotated: string) =>
    value === fallbackValue ? rotated : value;

  return {
    captureHeadline: orRotate(dna.capture_headline, DEFAULT_DNA.capture_headline, capture.headline),
    captureSubhead: orRotate(dna.capture_subhead, DEFAULT_DNA.capture_subhead, capture.subhead),
    captureCta: orRotate(dna.capture_cta, DEFAULT_DNA.capture_cta, capture.cta),
    revealHeadline: orRotate(dna.reveal_headline, DEFAULT_DNA.reveal_headline, reveal.headline),
    revealSubhead: orRotate(dna.reveal_subhead, DEFAULT_DNA.reveal_subhead, reveal.subhead),
    revealCta: orRotate(dna.reveal_cta, DEFAULT_DNA.reveal_cta, reveal.cta),
  };
}

// ─── Markup partials ─────────────────────────────────────────────────────────

export function timerMarkup(dna: PopupDna): string {
  if (dna.timer_mode === "none") return "";
  if (dna.timer_mode === "static_badge") {
    const label = dna.timer_label ?? "Limited time";
    return `<p class="asmos-timer" data-timer="static">${esc(label)}</p>`;
  }
  const label = dna.timer_label ? `<span>${esc(dna.timer_label)}</span>` : "";
  return `<p class="asmos-timer" data-timer="countdown">
      ${label}<span class="asmos-timer-value"></span>
      <span class="asmos-timer-bar"><i></i></span>
    </p>`;
}

export function eyebrowMarkup(dna: PopupDna): string {
  return dna.eyebrow ? `<p class="asmos-eyebrow">${esc(dna.eyebrow)}</p>` : "";
}

/**
 * The discount rendered as a graphic rather than as a sentence.
 *
 * `discount_percent` has been in the spec since generation existed and no
 * template ever drew it, so every popup was 100% text on a flat field with no
 * element heavy enough to anchor the composition. At display size the number is
 * the design — and it's also the single piece of information a visitor needs,
 * which is a rare case of the most legible element also being the most useful.
 *
 * Renders nothing without a real percentage, so a popup with no numeric offer
 * (an EMAIL-goal signup, a free-shipping reward) degrades to its headline
 * rather than showing a bare "%".
 */
export function offerMarkup(dna: PopupDna, discountPercent?: number | null): string {
  if (dna.offer_display !== "hero") return "";
  if (typeof discountPercent !== "number" || !Number.isFinite(discountPercent)) return "";
  const value = Math.round(discountPercent);
  if (value <= 0 || value >= 100) return "";

  return `<p class="asmos-offer" aria-label="${value} percent off">
      <span class="asmos-offer-value" aria-hidden="true">${value}</span>
      <span class="asmos-offer-unit" aria-hidden="true">%</span>
      <span class="asmos-offer-label" aria-hidden="true">off</span>
    </p>`;
}

export function proofMarkup(dna: PopupDna): string {
  return dna.social_proof ? `<p class="asmos-proof">${esc(dna.social_proof)}</p>` : "";
}

export function privacyMarkup(dna: PopupDna): string {
  return dna.privacy_note ? `<p class="asmos-privacy">${esc(dna.privacy_note)}</p>` : "";
}

export function dismissMarkup(dna: PopupDna): string {
  if (!dna.dismiss_text) return "";
  if (dna.close_affordance === "x_corner") return "";
  return `<button type="button" class="asmos-dismiss" data-dismiss>${esc(dna.dismiss_text)}</button>`;
}

export function closeMarkup(dna: PopupDna): string {
  if (dna.close_affordance === "text_link") return "";
  return `<button type="button" class="asmos-close" id="asmosPopupClose" aria-label="Close">&times;</button>`;
}

function formMarkup(dna: PopupDna, submitLabel: string): string {
  const label = dna.show_field_label
    ? `<label class="asmos-field-label" for="asmosPopupEmail">${esc(dna.field_label)}</label>`
    : `<label class="visually-hidden" for="asmosPopupEmail">${esc(dna.field_label)}</label>`;

  return `<form class="asmos-form" id="asmosPopupForm" novalidate>
      ${label}
      <input type="email" id="asmosPopupEmail" name="email" class="asmos-email-input"
             placeholder="${esc(dna.email_placeholder)}" autocomplete="email" required />
      <button type="submit" class="asmos-cta">${esc(submitLabel)}</button>
    </form>`;
}

/**
 * The full step stack. Templates wrap this in their own container; they no
 * longer author any of the copy inside it.
 */
export function stepsMarkup(props: PopupTemplateProps, dna: PopupDna, flow: ResolvedFlow): string {
  const { headline, subhead, cta, couponCode, discountPercent } = props;
  const goal = props.goal ?? "BOTH";
  const copy = resolveStepCopy(dna, headline);
  const offer = offerMarkup(dna, discountPercent);

  const teaser = flow.hasTeaser
    ? `<section class="popup-step" data-step="1" ${flow.startingStep !== 1 ? "hidden" : ""}>
        ${timerMarkup(dna)}
        ${eyebrowMarkup(dna)}
        ${offer}
        <h2 id="asmosPopupHeadline" class="asmos-headline">${esc(headline)}</h2>
        <p class="asmos-sub">${esc(subhead)}</p>
        <button type="button" class="asmos-cta" data-next="2">${esc(cta)}</button>
        ${proofMarkup(dna)}
        ${dismissMarkup(dna)}
      </section>`
    : "";

  // In the one-step flow (or an EMAIL-goal popup) this section carries the
  // real offer copy, not the "Almost there" hand-off copy — the hand-off only
  // makes sense when a teaser preceded it.
  const captureIsPrimary = !flow.hasTeaser;
  const captureHeadline = captureIsPrimary ? headline : copy.captureHeadline;
  const captureSubhead = captureIsPrimary ? subhead : copy.captureSubhead;
  const captureCta = captureIsPrimary ? cta : copy.captureCta;

  const capture = flow.hasCapture
    ? `<section class="popup-step" data-step="2" ${flow.startingStep !== 2 ? "hidden" : ""}>
        ${captureIsPrimary ? timerMarkup(dna) : ""}
        ${captureIsPrimary ? eyebrowMarkup(dna) : ""}
        ${captureIsPrimary ? offer : ""}
        <h2 ${captureIsPrimary ? 'id="asmosPopupHeadline"' : ""} class="asmos-headline">${esc(captureHeadline)}</h2>
        <p class="asmos-sub">${esc(captureSubhead)}</p>
        ${formMarkup(dna, captureCta)}
        ${privacyMarkup(dna)}
        ${captureIsPrimary ? proofMarkup(dna) : ""}
        ${dismissMarkup(dna)}
      </section>`
    : "";

  const revealHeadline = goal === "DISCOUNT" ? headline : copy.revealHeadline;
  const revealSubhead = goal === "DISCOUNT" ? subhead : copy.revealSubhead;

  const reveal = flow.hasReveal
    ? `<section class="popup-step" data-step="3" ${flow.startingStep !== 3 ? "hidden" : ""}>
        <h2 class="asmos-headline">${esc(revealHeadline)}</h2>
        <p class="asmos-sub">${esc(revealSubhead)}</p>
        <div class="asmos-code">
          <span id="asmosPopupCodeValue">${esc(couponCode || "WELCOME10")}</span>
          <button type="button" id="asmosPopupCopy" aria-label="Copy code">Copy</button>
        </div>
        <button type="button" class="asmos-cta" data-dismiss>${esc(copy.revealCta)}</button>
      </section>`
    : "";

  const success = flow.hasSuccess
    ? `<section class="popup-step" data-step="4" hidden>
        <h2 class="asmos-headline">${esc(dna.success_headline)}</h2>
        <p class="asmos-sub">${esc(dna.success_subhead)}</p>
        <button type="button" class="asmos-cta" data-dismiss>Continue</button>
      </section>`
    : "";

  return `${teaser}${capture}${reveal}${success}`;
}

// ─── Runtime script ──────────────────────────────────────────────────────────

export type RuntimeOptions = {
  dna: PopupDna;
  flow: ResolvedFlow;
  goal: NonNullable<PopupTemplateProps["goal"]>;
  /** Class toggled on the root element while the popup is visible. */
  openClass?: string;
  /** Lock page scroll while open (overlay templates yes, corner toast no). */
  lockScroll?: boolean;
  /** Close when the backdrop itself is clicked. */
  closeOnBackdrop?: boolean;
  /** Trap Tab focus inside the popup (modal templates only). */
  trapFocus?: boolean;
  /** Delay before the popup reveals itself, ms. */
  openDelayMs?: number;
};

/**
 * Behaviour shared by all templates: step machine, timer, form submission,
 * dismissal, and the full behavioural-telemetry suite.
 *
 * The telemetry here is the thing that answers "why isn't this converting" —
 * impressions and conversions alone can't distinguish "the offer is weak" from
 * "they can't find the email field". Each signal maps to a failure pattern in
 * lib/popupGeneration.ts's classifyFailurePatterns.
 */
export function runtimeScript(opts: RuntimeOptions): string {
  const {
    dna,
    flow,
    goal,
    openClass = "is-open",
    lockScroll = true,
    closeOnBackdrop = true,
    trapFocus = true,
    openDelayMs = 400,
  } = opts;

  const config = JSON.stringify({
    goal,
    openClass,
    lockScroll,
    closeOnBackdrop,
    trapFocus,
    openDelayMs,
    timerMode: dna.timer_mode,
    timerSeconds: dna.timer_seconds,
    startingStep: flow.startingStep,
    postSubmitStep: flow.postSubmitStep,
    hasSuccess: flow.hasSuccess,
  });

  return `
<script>
(function () {
  var CFG = ${config};
  var STORAGE_KEY = 'asmos_popup_last_seen';
  var SUPPRESS_DAYS = 14;
  var RAGE_CLICK_COUNT = 3;
  var RAGE_CLICK_WINDOW_MS = 1200;
  var HOVER_INTENT_MS = 900;

  var root = document.getElementById('asmosPopupOverlay');
  if (!root) return;

  var closeBtn = root.querySelector('#asmosPopupClose');
  var form = root.querySelector('#asmosPopupForm');
  var copyBtn = root.querySelector('#asmosPopupCopy');
  var emailInput = root.querySelector('#asmosPopupEmail');

  var openedAt = null;
  var converted = false;
  var timerInterval = null;
  var remaining = CFG.timerSeconds || 0;
  var lastFocused = null;

  // ── Behavioural counters, flushed as one summary on close ────────────────
  var telemetry = {
    deadClicks: 0,
    rageClicks: 0,
    fieldFocusCount: 0,
    timeToFirstKeystrokeMs: null,
    typedChars: 0,
    abandonedField: false,
    ctaHoverNoClickMs: 0,
    scrolledInside: false,
    reachedStep: CFG.startingStep || 1
  };

  // Failsafe: a popup that renders with every step hidden is indistinguishable
  // from a broken install to the visitor, and produces zero leads while still
  // counting impressions. If the markup and the flow ever disagree again, show
  // the intended step — or, failing that, the first one — rather than nothing.
  function ensureVisibleStep() {
    var steps = root.querySelectorAll('.popup-step');
    if (!steps.length) return;
    if (root.querySelector('.popup-step:not([hidden])')) return;
    var target = root.querySelector('.popup-step[data-step="' + CFG.startingStep + '"]') || steps[0];
    target.hidden = false;
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[asmos] no visible popup step for startingStep=' + CFG.startingStep + '; recovered');
    }
  }

  function track(type, extra) {
    if (typeof window.__asmos_track_event === 'function') {
      try { window.__asmos_track_event(type, extra); } catch (e) {}
    }
  }

  // ── Visibility gate ──────────────────────────────────────────────────────
  function isPreviewContext() {
    return window.self !== window.top
      || window.__asmos_preview_mode === true
      || (window.location && String(window.location.pathname).indexOf('/store-preview') !== -1);
  }

  function shouldShow() {
    if (isPreviewContext()) return true;
    try {
      var last = localStorage.getItem(STORAGE_KEY);
      if (!last) return true;
      return (Date.now() - Number(last)) / 86400000 > SUPPRESS_DAYS;
    } catch (e) { return true; }
  }

  function markSeen() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
  }

  // ── Timer ────────────────────────────────────────────────────────────────
  function formatTime(sec) {
    var m = String(Math.floor(sec / 60));
    var s = String(sec % 60);
    if (s.length < 2) s = '0' + s;
    return m + ':' + s;
  }

  function startTimer() {
    if (CFG.timerMode !== 'countdown' || !CFG.timerSeconds) return;
    var valueEls = root.querySelectorAll('.asmos-timer-value');
    var barEls = root.querySelectorAll('.asmos-timer-bar > i');
    var total = CFG.timerSeconds;

    function paint() {
      for (var i = 0; i < valueEls.length; i++) valueEls[i].textContent = formatTime(Math.max(remaining, 0));
      var pct = Math.max(0, Math.min(100, (remaining / total) * 100));
      for (var j = 0; j < barEls.length; j++) barEls[j].style.width = pct + '%';
    }
    paint();
    timerInterval = setInterval(function () {
      remaining -= 1;
      paint();
      if (remaining <= 0) clearInterval(timerInterval);
    }, 1000);
  }

  // ── Open / close ─────────────────────────────────────────────────────────
  function openPopup() {
    openedAt = Date.now();
    lastFocused = document.activeElement;
    ensureVisibleStep();
    root.hidden = false;
    requestAnimationFrame(function () { root.classList.add(CFG.openClass); });
    if (CFG.lockScroll) document.body.style.overflow = 'hidden';

    var focusTarget = root.querySelector('input, button:not(.asmos-close)');
    if (focusTarget && !isPreviewContext()) {
      try { focusTarget.focus({ preventScroll: true }); } catch (e) {}
    }
    document.addEventListener('keydown', onKeydown);
    startTimer();
  }

  function flushTelemetry() {
    // One summary event rather than a stream: enough to diagnose *why* a
    // popup failed without multiplying request volume on a merchant's site.
    track('INTERACTION', {
      step: 'session_summary',
      deadClicks: telemetry.deadClicks,
      rageClicks: telemetry.rageClicks,
      fieldFocusCount: telemetry.fieldFocusCount,
      timeToFirstKeystrokeMs: telemetry.timeToFirstKeystrokeMs,
      typedChars: telemetry.typedChars,
      abandonedField: telemetry.abandonedField,
      ctaHoverNoClickMs: Math.round(telemetry.ctaHoverNoClickMs),
      scrolledInside: telemetry.scrolledInside,
      reachedStep: telemetry.reachedStep,
      converted: converted
    });
  }

  function closePopup() {
    if (!converted) {
      track('DISMISSED', { dismissAfterMs: openedAt ? Date.now() - openedAt : undefined });
    }
    flushTelemetry();
    root.classList.remove(CFG.openClass);
    if (CFG.lockScroll) document.body.style.overflow = '';
    if (timerInterval) clearInterval(timerInterval);
    document.removeEventListener('keydown', onKeydown);
    setTimeout(function () { root.hidden = true; }, 260);
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
    markSeen();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { closePopup(); return; }
    if (!CFG.trapFocus || e.key !== 'Tab') return;
    var focusable = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ── Step machine ─────────────────────────────────────────────────────────
  function goToStep(stepNum) {
    var current = root.querySelector('.popup-step:not([hidden])');
    var next = root.querySelector('.popup-step[data-step="' + stepNum + '"]');
    if (!current || !next || current === next) return;

    telemetry.reachedStep = Math.max(telemetry.reachedStep, stepNum);
    track('INTERACTION', { step: stepNum });

    current.classList.add('is-exiting');
    setTimeout(function () {
      current.hidden = true;
      current.classList.remove('is-exiting');
      next.hidden = false;
      next.classList.add('is-entering');
      void next.offsetWidth;
      next.classList.remove('is-entering');
      var input = next.querySelector('input');
      if (input) { try { input.focus({ preventScroll: true }); } catch (e) {} }
    }, 220);
  }

  var nextBtns = root.querySelectorAll('[data-next]');
  for (var n = 0; n < nextBtns.length; n++) {
    (function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        goToStep(Number(btn.getAttribute('data-next')));
      });
    })(nextBtns[n]);
  }

  // ── Field-level telemetry ────────────────────────────────────────────────
  // "People can't find where to type" and "people start typing then give up"
  // are invisible to conversion rate alone. These three listeners are what
  // make form_friction diagnosable rather than merely detectable.
  if (emailInput) {
    emailInput.addEventListener('focus', function () {
      telemetry.fieldFocusCount += 1;
      if (telemetry.fieldFocusCount === 1) {
        track('INTERACTION', { step: 'email_field_focus' });
      }
    });

    emailInput.addEventListener('input', function () {
      telemetry.typedChars = emailInput.value.length;
      if (telemetry.timeToFirstKeystrokeMs === null && openedAt) {
        telemetry.timeToFirstKeystrokeMs = Date.now() - openedAt;
        track('INTERACTION', { step: 'email_first_keystroke', msSinceOpen: telemetry.timeToFirstKeystrokeMs });
      }
    });

    emailInput.addEventListener('blur', function () {
      // Focused the field, typed nothing, left. The single clearest signal
      // that the ask itself is the problem, not the offer.
      if (emailInput.value.length === 0 && telemetry.fieldFocusCount > 0 && !converted) {
        telemetry.abandonedField = true;
      }
    });
  }

  // CTA hover-without-click: hesitation. High values alongside low conversion
  // means the offer reads as unconvincing rather than unfindable.
  var ctas = root.querySelectorAll('.asmos-cta');
  for (var c = 0; c < ctas.length; c++) {
    (function (btn) {
      var enteredAt = null;
      var clicked = false;
      btn.addEventListener('mouseenter', function () { enteredAt = Date.now(); });
      btn.addEventListener('click', function () { clicked = true; enteredAt = null; });
      btn.addEventListener('mouseleave', function () {
        if (enteredAt && !clicked) {
          var dwell = Date.now() - enteredAt;
          if (dwell > HOVER_INTENT_MS) telemetry.ctaHoverNoClickMs += dwell;
        }
        enteredAt = null;
      });
    })(ctas[c]);
  }

  // Dead clicks + rage clicks: clicking something that isn't interactive, or
  // hammering the same spot. Both mean the visitor believes an element should
  // do something and it doesn't — the "silly things" class of problem.
  var recentClicks = [];
  root.addEventListener('click', function (e) {
    var t = e.target;
    var interactive = t.closest && t.closest('button, a, input, label, [data-next], [data-dismiss], form');
    if (!interactive) {
      telemetry.deadClicks += 1;
      track('INTERACTION', { step: 'dead_click', targetTag: (t.tagName || '').toLowerCase() });
    }
    var now = Date.now();
    recentClicks.push(now);
    recentClicks = recentClicks.filter(function (ts) { return now - ts < RAGE_CLICK_WINDOW_MS; });
    if (recentClicks.length >= RAGE_CLICK_COUNT) {
      telemetry.rageClicks += 1;
      recentClicks = [];
      track('INTERACTION', { step: 'rage_click', targetTag: (t.tagName || '').toLowerCase() });
    }
  }, true);

  root.addEventListener('scroll', function () { telemetry.scrolledInside = true; }, { passive: true, capture: true });

  // ── Dismissal ────────────────────────────────────────────────────────────
  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  var dismissEls = root.querySelectorAll('[data-dismiss]');
  for (var d = 0; d < dismissEls.length; d++) {
    dismissEls[d].addEventListener('click', function (e) { e.preventDefault(); closePopup(); });
  }
  if (CFG.closeOnBackdrop) {
    root.addEventListener('click', function (e) { if (e.target === root) closePopup(); });
  }

  // ── Submission ───────────────────────────────────────────────────────────
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = emailInput ? emailInput.value.trim() : '';
      if (!email || email.indexOf('@') === -1) {
        if (emailInput) {
          emailInput.style.borderColor = '#dc2626';
          emailInput.focus();
        }
        track('INTERACTION', { step: 'invalid_email_submit' });
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      var originalLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

      var variant = window.__asmos_active_variant;
      var apiBase = window.__asmos_api_base || '';

      function finish() {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
        goToStep(CFG.hasSuccess ? 4 : CFG.postSubmitStep);
      }

      // A failed capture that still shows the success screen is the worst
      // possible outcome: the visitor believes they subscribed, the merchant
      // never gets the address, and nothing anywhere records that it happened.
      // Ask again instead, and leave a breadcrumb in the event stream.
      function fail(reason) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
        if (emailInput) { emailInput.style.borderColor = '#dc2626'; }
        var err = root.querySelector('.asmos-error');
        if (!err) {
          err = document.createElement('p');
          err.className = 'asmos-error';
          err.setAttribute('role', 'alert');
          err.style.cssText = 'margin:10px 0 0;font-size:12px;color:#dc2626;';
          if (form.parentNode) form.parentNode.insertBefore(err, form.nextSibling);
        }
        err.textContent = "That didn't go through — please try again.";
        track('INTERACTION', { step: 'lead_submit_failed', reason: reason });
      }

      if (window.__asmos_preview_mode) {
        converted = true;
        setTimeout(finish, 250);
        return;
      }

      if (!variant) { fail('no_active_variant'); return; }

      var behavioral = typeof window.__asmos_behavioral_context === 'function'
        ? window.__asmos_behavioral_context()
        : {};
      var payload = { variantId: variant.id, email: email, consentGiven: true };
      for (var k in behavioral) { if (Object.prototype.hasOwnProperty.call(behavioral, k)) payload[k] = behavioral[k]; }
      payload.timeToFirstKeystrokeMs = telemetry.timeToFirstKeystrokeMs;
      payload.fieldFocusCount = telemetry.fieldFocusCount;

      fetch(apiBase + '/api/widget/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('lead endpoint returned ' + res.status);
          return res.json();
        })
        .then(function (data) {
          converted = true;
          if (data && data.reward && data.reward.couponCode) {
            var codeEl = root.querySelector('#asmosPopupCodeValue');
            if (codeEl) codeEl.textContent = data.reward.couponCode;
          }
          finish();
        })
        .catch(function (err) {
          console.error('[asmos] lead submission failed', err);
          fail('request_failed');
        });
    });
  }

  // ── Copy code ────────────────────────────────────────────────────────────
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var codeEl = root.querySelector('#asmosPopupCodeValue');
      if (!codeEl) return;
      var original = copyBtn.textContent;
      try { navigator.clipboard.writeText(codeEl.textContent); } catch (e) {}
      copyBtn.textContent = 'Copied';
      track('INTERACTION', { step: 'code_copied' });
      setTimeout(function () { copyBtn.textContent = original; }, 2000);
    });
  }

  // Flush counters if the visitor navigates away without closing the popup —
  // otherwise every abandoned session silently loses its diagnostic data.
  window.addEventListener('pagehide', function () { if (openedAt && !root.hidden) flushTelemetry(); }, { once: true });

  setTimeout(function () { if (shouldShow()) openPopup(); }, CFG.openDelayMs);
})();
</script>`;
}
