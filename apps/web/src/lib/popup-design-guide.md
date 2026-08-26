# High-Converting Popup Design Library
### Email Capture & % Off Deal Modals - Design, UX, and Build Guide

Built from analysis of 8 live examples (Pact, mindbodygreen, Bloom, HexClad, Beckett Simonon, Princess Polly, Camilla, and a publisher signup flow) plus current conversion-rate optimization research.

---

## 0. How This Library Is Organized

1. **Psychology** - why these patterns work
2. **Pattern taxonomy** - the 4 popup archetypes, with when to use each
3. **Anatomy & layout system** - the reusable skeleton every high-performer shares
4. **Copywriting formulas** - headline/CTA/microcopy templates
5. **Motion & interaction design** - timers, scratch, spin, transitions
6. **UX rules, triggers & accessibility** - timing, frequency capping, a11y
7. **Build from scratch - vanilla HTML/CSS/JS**
8. **Build from scratch - React**
9. **Discount-code reveal patterns**
10. **QA checklist + A/B testing roadmap**
11. **Annotated reference gallery** (15 examples)
12. **Ethical guardrails**

---

## 1. The Psychology Underneath Every High-Converting Popup

Every pattern in this library is a delivery mechanism for one or more of these five triggers. If a popup you're designing doesn't map to at least one, cut it.

| Trigger | Mechanism | Popup expression |
|---|---|---|
| **Reciprocity** | Give something small before asking for something | "You've got a gift" / "Here's 10% off" framing *before* the email field appears |
| **Loss aversion** | Losing feels ~2x stronger than an equivalent gain | Countdown timers, "your discount expires," loss-framed copy over gain-framed copy |
| **Scarcity** | Cialdini's principle - rare = valuable | "First order only," genuine stock/time limits |
| **Commitment & consistency (micro-yes)** | A small first "yes" (closing a quiz question, starting a scratch) increases follow-through on the bigger ask (email) | Two-step flows, quiz-gated popups, scratch/spin mechanics |
| **Curiosity gap / variable reward** | Unknown outcomes trigger dopamine more than known ones | "Mystery discount," spin wheels, scratch cards |

**Benchmark conversion rates** (blended from multiple 2026 industry studies - use as directional, not guaranteed):

| Format | Typical conversion rate | Notes |
|---|---|---|
| Static single-step popup ("enter email for 10% off") | 3–5% | Baseline |
| Well-optimized ecommerce popup (any format) | 6–7% average | Industry-wide blended average |
| Two-step email → SMS popup | +30–67% signups vs. single ask | Progressive disclosure reduces perceived friction |
| Exit-intent popup | 3–4% | Lower intent, but recovers otherwise-lost visitors |
| Scroll-triggered popup | ~5% | Visitor is already engaged when it fires |
| Quiz / segmentation popup | 8–9% | Micro-commitment before the ask |
| Scratch-card popup | 7–10% | Reads as more premium than a wheel |
| Spin-to-win popup | 8–15% (top performers 20–30%+) | Highest-converting single mechanic available |
| Daily-offer / rotating gamified popup | Up to ~29% | Highest of all formats in some studies, but suffers fastest fatigue |

Two consistent findings worth designing around:
- Every additional required form field reduces conversion by roughly 10–15%, so ask for the absolute minimum on step one.
- Fabricated urgency (timers that reset, "3 left" that never runs out) produces a short-term lift and a long-term trust penalty - a meaningful share of shoppers say they now discount urgency messaging outright because they've been burned before.

---

## 2. Pattern Taxonomy - 4 Popup Archetypes

### A. Single-Step Direct Offer
Headline + one or two fields + CTA, no gating. Fastest to build, lowest ceiling.

**Anatomy:** Eyebrow/logo → headline (offer-led) → subheadline (1 sentence) → email input → CTA button → dismiss link → fine print.

**Use when:** brand voice is minimal/premium (Camilla, Princess Polly), or the offer itself is simple enough not to need staging.

### B. Two-Step Gated Reveal ("teaser → capture → code")
This is the dominant pattern across Pact, mindbodygreen, Bloom, and HexClad. Three screens:

1. **Teaser screen** - "You've got X" / "You've got $Y off," countdown starts, single CTA ("Claim," "Join for Access") - no field yet. This is a reciprocity + curiosity hook with zero friction.
2. **Capture screen** - one field (email or phone), countdown still visible and now lower, CTA restates the benefit ("Continue," "Join for Access").
3. **Reveal screen** - code shown in a dashed "coupon" box, copy button, CTA to shop ("Shop Now").

**Why it outperforms single-step:** the visitor has already taken one free micro-action (clicking "Claim") before being asked for information - commitment & consistency plus a live countdown compounding loss aversion.

**Use when:** you want to combine urgency + reciprocity, or you're capturing both email and phone in sequence.

### C. Segmentation / Quiz Gate
Adds one question before the offer: "What brings you to Pact?" / "What are you looking for?" (Bloom). Visitor picks a tile, *then* proceeds into the capture step.

**Why it works:** it's a zero-cost micro-commitment, and it gives you first-party segmentation data for the welcome flow that follows (e.g., send fitness-goal shoppers different follow-up emails than skincare shoppers).

**Use when:** you have genuinely different follow-up flows/products per segment - don't add this step just for the conversion lift if you can't act on the data.

### D. Gamified Interaction (spin wheel / scratch card / pick-a-box)
Replaces a static claim button with a small game. Scratch card (Beckett Simonon) reveals text/prize under a canvas-drawn "foil" layer; spin wheel reveals a randomized prize behind a pointer.

**Why it works:** variable reward + play framing lowers the perceived cost of giving up an email address - users report the exchange as "fun" rather than "transactional," which is why this format posts the highest raw conversion numbers of any pattern.

**Use when:** brand tone is casual/fun (fashion, beauty, food, fitness); avoid for luxury or clinical/medical brands where a "game" undercuts trust.

---

## 3. Anatomy & Layout System

Every high-performing popup in the reference set (regardless of archetype) is built from the same 8 slots. Treat this as your component checklist.

```
┌───────────────────────────────────────────┐
│  [1] Close (×)                              │  ← always top-right, 44×44px min tap target
│  [2] Eyebrow / logo                         │  ← small, centered or top-left
│  [3] Countdown (optional)                   │  ← mm:ss, monospace, centered
│  [4] Headline                               │  ← the offer, largest text on screen
│  [5] Subheadline                            │  ← 1 sentence, states the mechanism
│  [6] Input field(s) / choice tiles           │  ← never more than 1 field on step 1
│  [7] CTA button                             │  ← full-width or near-full-width, high contrast
│  [8] Dismiss link + fine print              │  ← low-emphasis, loss-framed ("No thanks")
└───────────────────────────────────────────┘
```

### Layout shells (two dominant shapes across the reference set)

**Shell 1 - Split screen (Pact, mindbodygreen, Camilla, Beckett Simonon)**
- 40–55% lifestyle photography (fixed, full-bleed, no crop artifacts) on one side
- 45–60% content panel on a flat/near-white background on the other
- On mobile: image collapses to a top band (30–40vh) or becomes a background image behind a translucent content panel (Bloom's approach)

**Shell 2 - Centered card over dimmed background (Princess Polly, publisher example)**
- Single centered card, 380–460px wide
- Page content dimmed behind a 50–70% opacity black/dark overlay
- Simpler to build, works for any brand, slightly lower visual impact than Shell 1

### Sizing & spacing scale
Use an 8px base unit throughout:
- Modal padding: 32–48px desktop / 24px mobile
- Vertical rhythm between elements: 16px (related items, e.g. label→input), 24px (section breaks), 32–40px (headline→body)
- Modal width: 420–520px (single card) / 800–1000px (split shell) desktop; 100vw minus 16–24px margin on mobile
- Border radius: 0px (editorial/heritage brands like Pact, Camilla) to 12–16px (modern DTC/supplement brands like Bloom)
- Close button: 32–40px hit area, positioned 16px from top/right edge, always visible (not hidden until hover)

### Typography pairing
Two patterns dominate:
1. **Serif headline + sans body** (Pact, Camilla) - signals heritage/craft, pair a display serif (e.g., a Georgia/Playfair-style face) at 28–36px with a clean grotesk body at 14–16px.
2. **Bold sans throughout** (mindbodygreen, Bloom, HexClad) - signals modern/energetic, use a single sans family with weight variation (800 for headline, 400–500 for body).

Rules that hold across every reference example:
- Headline: 24–40px, tight line-height (1.05–1.2), always the highest-contrast text on the screen
- Body/subhead: 13–16px, line-height 1.4–1.6, muted color (not pure black - use a dark gray)
- Never more than 2 type families in one popup

### Color & CTA contrast
- CTA button must be the single highest-contrast element after the headline - if your brand's primary color is muted, consider a secondary accent purely for CTAs (HexClad's red-on-black, mindbodygreen's orange-on-blue)
- Dark/moody backgrounds (HexClad) work for premium/technical products; light/neutral backgrounds (Pact, Camilla) work for soft/lifestyle products
- Countdown timers should be visually distinct from body text - monospace or tabular-nums, often boxed or circled

### Mobile-specific rules
- Fields and CTA buttons need 44×44px minimum tap targets (Apple/Google HIG minimum)
- Never let a modal exceed 100vh - if content is close, cap modal height and let the content panel (not the whole page) scroll
- Sticky-bottom CTA is acceptable on mobile if the offer/headline is visible above the fold of the modal itself

---

## 4. Copywriting Formulas

Across every top-performing example (yours and researched), 4 rules hold:

1. **Lead with the benefit, not the action.** "Get 15% off" outperforms "Sign up for updates."
2. **Clarity beats cleverness.** The value must be instantly parseable - "10% Off Your First Order" beats a vague teaser with no number.
3. **Urgency must be real.** A countdown tied to an actual session/campaign window, not a timer that silently resets on refresh.
4. **CTAs are actions, not labels.** "Claim My Discount" / "Unlock 10% Off" beats "Submit" or "Continue" wherever the offer can be restated in the button itself.

### Headline formula bank
| Formula | Example pattern |
|---|---|
| `You've got [reward]` | "You've got free shipping" / "You've got $75 off" |
| `[Benefit] on your first order` | "Free shipping on your first order" / "10% off your first purchase" |
| `For [benefit]` | "For free shipping" |
| `[Question hook]` | "What brings you to [brand]?" |
| `You've got a mystery [reward]` | "You've got a mystery discount" |
| `Unlock your [%] off` | "Unlock your 15% off discount" |

### Step-specific microcopy
- **Teaser step CTA:** "Claim Discount," "Join for Access," "Scratch Here," "Let's Go"
- **Capture step CTA:** "Continue," "Activate 10% Off," "Join for Access"
- **Reveal step CTA:** "Shop Now," "Start Shopping," "Continue"
- **Dismiss link (loss-framed, low emphasis):** "No thanks," "No, I'll pay full price" (use sparingly - the latter can feel aggressive/guilt-trippy; test it)
- **Fine print (always include if capturing phone/SMS):** consent language for recurring automated marketing messages, opt-out instructions, link to terms/privacy - this is a legal requirement in most jurisdictions (TCPA in the US), not optional styling.

---

## 5. Motion & Interaction Design

### Countdown timer
- Format: `mm:ss`, tabular/monospace numerals so digits don't jitter the layout as they change
- Duration: session-based (10–20 minutes) is most common and most defensible as "real" - avoid multi-hour timers on an email popup, they read as fake
- On expiry: don't just silently vanish the offer - either extend gracefully once, or swap to a non-urgent fallback message. A timer that hits zero and does nothing visible destroys trust for next time.

### Scratch-card reveal
- Implementation: `<canvas>` overlay drawn with a solid "foil" color, `globalCompositeOperation = 'destination-out'` erases pixels under the pointer/touch path
- Trigger reveal at ~40–60% area cleared (track via pixel sampling), then animate remaining foil away and show the prize
- Always provide a "reveal all" fallback tap/click for accessibility and impatient users

### Spin wheel
- Implementation: CSS `transform: rotate()` on an SVG or divided `<div>` wheel, eased with a long `cubic-bezier` timing function (3–5s spin) landing on a pre-determined segment
- Weight prizes server-side or in config - never let the visible spin be purely cosmetic if you're promising randomness; decide the outcome before or during the animation, not after
- Disable the spin button after use (one spin per session) and store result in `localStorage`/cookie to prevent repeat-spinning via refresh

### Step transitions
- Slide (translateX) or crossfade between steps, 200–300ms ease-out
- Keep the countdown and modal chrome (close button, brand mark) persistent across steps so the transition doesn't feel like a new popup

### Entry animation
- Modal: fade + slight scale-up (0.95 → 1) over 200–250ms
- Overlay: fade to 50–70% opacity black, ~150ms
- Avoid slide-in-from-edge for centered modals - it reads as an ad unit, not part of the site

---

## 6. UX Rules, Triggers & Accessibility

### Trigger timing (pick one, not several)
| Trigger | Recommended threshold | Best for |
|---|---|---|
| Time delay | 5–15 seconds | Simple content sites, blogs |
| Scroll depth | 25–50% of page | Product/landing pages - visitor has shown intent |
| Exit intent (desktop) | Mouse leaves viewport toward tab/URL bar | Recovering visitors who'd otherwise leave with zero capture |
| Exit intent (mobile) | Fast upward scroll / back-button press (mouse-based exit intent doesn't exist on touch) | Mobile-specific recovery |
| On-load | Immediate | Only for genuinely time-boxed campaigns (flash sale) - otherwise this is the most-hated pattern in usability research |

### Frequency capping (non-negotiable)
- Never show the same popup twice in one session
- Suppress for 7–30 days after a dismissal, and suppress permanently after a successful conversion
- Store state in `localStorage` (client-only) at minimum; back it with a server-side flag against the customer record once they've converted, since `localStorage` clears on new devices/incognito

### Modal vs. non-modal - pick correctly
Per Nielsen Norman Group's distinction: a **modal** blocks interaction with the page behind it; a **non-modal** (like a corner toast) does not. Email/discount capture popups should always be true modals - that's what makes the ask feel intentional rather than incidental - but that comes with obligations:
- Never stack a second modal on top of a first (e.g., don't chain a "sign up" modal into a "confirm your birthday" modal into a survey - dismissing one only to find another creates anxiety and makes users feel lost)
- Never put primary site navigation behind a modal-only interaction
- Never put long scrollable content (full T&Cs, full articles) inside a small modal - link out instead

### Accessibility checklist
- **Focus trap:** on open, move focus into the modal and trap Tab/Shift+Tab cycling within it; on close, return focus to the element that triggered it
- **ESC to close:** always wire the Escape key to the close action
- **ARIA:** `role="dialog"` (or `alertdialog` if it interrupts a critical flow), `aria-modal="true"`, `aria-labelledby` pointing at the headline
- **Touch targets:** 44×44px minimum for close button, CTA, and any tappable choice tile
- **Color contrast:** headline and CTA text must meet WCAG AA (4.5:1 for body text, 3:1 for large text ≥24px)
- **Screen readers:** the underlying page should get `aria-hidden="true"` (or `inert`) while the modal is open so screen reader users aren't reading through dimmed content behind it

---

## 7. Build From Scratch - Vanilla HTML / CSS / JS

This is a complete, dependency-free two-step gated-reveal popup (Pattern B) - the highest-value pattern to have as a reusable base, since single-step and quiz-gate are subsets of it.

### 7.1 HTML structure

```html
<div class="popup-overlay" id="popupOverlay" hidden>
  <div class="popup-modal" role="dialog" aria-modal="true" aria-labelledby="popupHeadline">
    <button class="popup-close" id="popupClose" aria-label="Close">&times;</button>

    <div class="popup-media" aria-hidden="true">
      <img src="/images/popup-hero.jpg" alt="" />
    </div>

    <div class="popup-content">
      <!-- STEP 1: Teaser -->
      <section class="popup-step" data-step="1">
        <p class="popup-timer" id="popupTimer">10:00</p>
        <p class="popup-eyebrow">A little gift to get you started</p>
        <h2 id="popupHeadline" class="popup-headline">You've got 10% off</h2>
        <p class="popup-sub">Claim your discount and start shopping.</p>
        <button class="popup-cta" data-next="2">Claim Discount</button>
      </section>

      <!-- STEP 2: Capture -->
      <section class="popup-step" data-step="2" hidden>
        <p class="popup-timer" id="popupTimerStep2">09:41</p>
        <h2 class="popup-headline">Almost there</h2>
        <p class="popup-sub">Enter your email to unlock your code.</p>
        <form id="popupForm" novalidate>
          <label class="visually-hidden" for="popupEmail">Email address</label>
          <input type="email" id="popupEmail" name="email" placeholder="Your email address" required />
          <button type="submit" class="popup-cta">Continue</button>
        </form>
      </section>

      <!-- STEP 3: Reveal -->
      <section class="popup-step" data-step="3" hidden>
        <h2 class="popup-headline">Your code is ready</h2>
        <p class="popup-sub">Use this code at checkout.</p>
        <div class="popup-code" id="popupCode">
          <span id="popupCodeValue">WELCOME10</span>
          <button id="popupCopy" aria-label="Copy code">Copy</button>
        </div>
        <a class="popup-cta popup-cta--link" href="/shop">Shop Now</a>
      </section>

      <button class="popup-dismiss" id="popupDismiss">No thanks</button>
    </div>
  </div>
</div>
```

### 7.2 CSS (core shell + variables)

```css
:root {
  --popup-radius: 4px;
  --popup-bg: #f7f5f2;
  --popup-fg: #1a1a1a;
  --popup-muted: #6b6b6b;
  --popup-accent: #1a1a1a;
  --popup-accent-fg: #ffffff;
  --popup-max-width: 900px;
  --popup-transition: 220ms ease-out;
}

.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 0;
  transition: opacity var(--popup-transition);
}
.popup-overlay.is-open { opacity: 1; }
.popup-overlay[hidden] { display: none; }

.popup-modal {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: min(var(--popup-max-width), 92vw);
  max-height: 90vh;
  overflow: hidden;
  background: var(--popup-bg);
  border-radius: var(--popup-radius);
  transform: scale(0.96);
  transition: transform var(--popup-transition);
}
.popup-overlay.is-open .popup-modal { transform: scale(1); }

.popup-media { position: relative; overflow: hidden; }
.popup-media img { width: 100%; height: 100%; object-fit: cover; }

.popup-content {
  position: relative;
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
}

.popup-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  color: var(--popup-fg);
}

.popup-timer {
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.popup-eyebrow {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--popup-muted);
  margin-bottom: 12px;
}

.popup-headline {
  font-size: 32px;
  line-height: 1.1;
  margin: 0 0 12px;
}

.popup-sub {
  font-size: 15px;
  color: var(--popup-muted);
  margin: 0 0 24px;
  max-width: 34ch;
}

.popup-cta {
  width: 100%;
  padding: 16px 24px;
  background: var(--popup-accent);
  color: var(--popup-accent-fg);
  border: 0;
  border-radius: var(--popup-radius);
  font-size: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  min-height: 44px;
}
.popup-cta:hover { opacity: 0.9; }

#popupEmail {
  width: 100%;
  padding: 14px 16px;
  margin-bottom: 12px;
  border: 1px solid #d8d5d0;
  border-radius: var(--popup-radius);
  font-size: 15px;
  min-height: 44px;
}

.popup-dismiss {
  margin-top: 16px;
  background: none;
  border: 0;
  color: var(--popup-muted);
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}

.popup-code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px dashed var(--popup-fg);
  padding: 14px 18px;
  border-radius: var(--popup-radius);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 20px;
}

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 640px) {
  .popup-modal { grid-template-columns: 1fr; max-height: 85vh; overflow-y: auto; }
  .popup-media { max-height: 32vh; }
}
```

### 7.3 JS (open/close, focus trap, timer, step logic, frequency cap)

```javascript
(function () {
  const STORAGE_KEY = 'popup_last_seen';
  const SUPPRESS_DAYS = 14;
  const DURATION_SECONDS = 600; // 10 minutes

  const overlay = document.getElementById('popupOverlay');
  const modal = overlay.querySelector('.popup-modal');
  const closeBtn = document.getElementById('popupClose');
  const dismissBtn = document.getElementById('popupDismiss');
  const form = document.getElementById('popupForm');
  const timerEls = overlay.querySelectorAll('.popup-timer');
  let lastFocusedEl = null;
  let timerInterval = null;
  let remaining = DURATION_SECONDS;

  function shouldShow() {
    const last = localStorage.getItem(STORAGE_KEY);
    if (!last) return true;
    const daysSince = (Date.now() - Number(last)) / 86400000;
    return daysSince > SUPPRESS_DAYS;
  }

  function markSeen() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  }

  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      remaining -= 1;
      timerEls.forEach((el) => (el.textContent = formatTime(Math.max(remaining, 0))));
      if (remaining <= 0) clearInterval(timerInterval);
    }, 1000);
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openPopup() {
    lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    document.getElementById('main')?.setAttribute('aria-hidden', 'true');
    modal.querySelector('button, input')?.focus();
    document.addEventListener('keydown', onKeydown);
    startTimer();
  }

  function closePopup() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    document.getElementById('main')?.removeAttribute('aria-hidden');
    clearInterval(timerInterval);
    document.removeEventListener('keydown', onKeydown);
    setTimeout(() => (overlay.hidden = true), 220);
    lastFocusedEl?.focus();
    markSeen();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') closePopup();
    trapFocus(e);
  }

  function goToStep(stepNum) {
    overlay.querySelectorAll('.popup-step').forEach((s) => {
      s.hidden = Number(s.dataset.step) !== stepNum;
    });
  }

  // Wire up navigation between steps
  overlay.querySelectorAll('[data-next]').forEach((btn) => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.next)));
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('popupEmail').value;
    // Replace with your real capture endpoint / Klaviyo / etc.
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {}); // fail open - still show the code
    goToStep(3);
  });

  document.getElementById('popupCopy')?.addEventListener('click', () => {
    const code = document.getElementById('popupCodeValue').textContent;
    navigator.clipboard.writeText(code);
  });

  closeBtn.addEventListener('click', closePopup);
  dismissBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });

  // Exit-intent trigger (desktop)
  function onMouseLeave(e) {
    if (e.clientY <= 0 && shouldShow()) {
      openPopup();
      document.removeEventListener('mouseleave', onMouseLeave);
    }
  }
  document.addEventListener('mouseleave', onMouseLeave);
})();
```

---

## 8. Build From Scratch - React

Component-based version of the same pattern, split into a reusable shell plus hooks. Style with your own CSS module or Tailwind - class names below are illustrative.

### 8.1 Hooks

```jsx
// useCountdown.js
import { useEffect, useRef, useState } from 'react';

export function useCountdown(startSeconds) {
  const [remaining, setRemaining] = useState(startSeconds);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  return { remaining, formatted: `${minutes}:${seconds}` };
}
```

```jsx
// useExitIntent.js
import { useEffect } from 'react';

export function useExitIntent(onTrigger, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handleMouseLeave(e) {
      if (e.clientY <= 0) onTrigger();
    }
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [enabled, onTrigger]);
}
```

```jsx
// useFrequencyCap.js
export function useFrequencyCap(key, suppressDays = 14) {
  function shouldShow() {
    const last = localStorage.getItem(key);
    if (!last) return true;
    return (Date.now() - Number(last)) / 86400000 > suppressDays;
  }
  function markSeen() {
    localStorage.setItem(key, String(Date.now()));
  }
  return { shouldShow, markSeen };
}
```

### 8.2 Main component

```jsx
// DiscountPopup.jsx
import { useEffect, useRef, useState } from 'react';
import { useCountdown } from './useCountdown';
import { useExitIntent } from './useExitIntent';
import { useFrequencyCap } from './useFrequencyCap';

const STEPS = { TEASER: 1, CAPTURE: 2, REVEAL: 3 };

export default function DiscountPopup({ code = 'WELCOME10', onSubscribe }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(STEPS.TEASER);
  const [email, setEmail] = useState('');
  const modalRef = useRef(null);
  const lastFocusRef = useRef(null);
  const { formatted } = useCountdown(600);
  const { shouldShow, markSeen } = useFrequencyCap('popup_last_seen');

  useExitIntent(() => {
    if (shouldShow()) open();
  });

  function open() {
    lastFocusRef.current = document.activeElement;
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    markSeen();
    lastFocusRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    function onKeydown(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeydown);
    modalRef.current?.querySelector('button, input')?.focus();
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
    };
  }, [isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubscribe?.(email).catch(() => {});
    setStep(STEPS.REVEAL);
  }

  if (!isOpen) return null;

  return (
    <div className="popup-overlay is-open" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="popup-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="popupHeadline">
        <button className="popup-close" aria-label="Close" onClick={close}>&times;</button>

        {step === STEPS.TEASER && (
          <section className="popup-step">
            <p className="popup-timer">{formatted}</p>
            <p className="popup-eyebrow">A little gift to get you started</p>
            <h2 id="popupHeadline" className="popup-headline">You've got 10% off</h2>
            <p className="popup-sub">Claim your discount and start shopping.</p>
            <button className="popup-cta" onClick={() => setStep(STEPS.CAPTURE)}>Claim Discount</button>
          </section>
        )}

        {step === STEPS.CAPTURE && (
          <section className="popup-step">
            <p className="popup-timer">{formatted}</p>
            <h2 className="popup-headline">Almost there</h2>
            <p className="popup-sub">Enter your email to unlock your code.</p>
            <form onSubmit={handleSubmit}>
              <label className="visually-hidden" htmlFor="popupEmail">Email address</label>
              <input
                id="popupEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
              />
              <button type="submit" className="popup-cta">Continue</button>
            </form>
          </section>
        )}

        {step === STEPS.REVEAL && (
          <section className="popup-step">
            <h2 className="popup-headline">Your code is ready</h2>
            <p className="popup-sub">Use this code at checkout.</p>
            <div className="popup-code">
              <span>{code}</span>
              <button onClick={() => navigator.clipboard.writeText(code)}>Copy</button>
            </div>
            <a className="popup-cta popup-cta--link" href="/shop">Shop Now</a>
          </section>
        )}

        <button className="popup-dismiss" onClick={close}>No thanks</button>
      </div>
    </div>
  );
}
```

### 8.3 Scratch-card reveal (canvas, framework-agnostic - usable inside a React `useRef` + `useEffect`)

```jsx
// ScratchCard.jsx
import { useEffect, useRef, useState } from 'react';

export default function ScratchCard({ width = 320, height = 160, onRevealed, revealThreshold = 0.5 }) {
  const canvasRef = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2e3b2f'; // "foil" color
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scratch Here', width / 2, height / 2);

    let isDrawing = false;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    }

    function scratch(e) {
      if (!isDrawing) return;
      const { x, y } = getPos(e);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
      checkRevealPercentage();
    }

    function checkRevealPercentage() {
      const pixels = ctx.getImageData(0, 0, width, height).data;
      let cleared = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) cleared++;
      }
      const pct = cleared / (pixels.length / 4);
      if (pct > revealThreshold && !revealed) {
        setRevealed(true);
        onRevealed?.();
      }
    }

    const start = () => (isDrawing = true);
    const stop = () => (isDrawing = false);

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mousemove', scratch);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchend', stop);
    canvas.addEventListener('touchmove', scratch);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mouseup', stop);
      canvas.removeEventListener('mousemove', scratch);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchend', stop);
      canvas.removeEventListener('touchmove', scratch);
    };
  }, [width, height, revealed, revealThreshold, onRevealed]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
        10% OFF
      </div>
      <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'pointer' }} />
    </div>
  );
}
```

### 8.4 Spin wheel (CSS transform, config-driven prizes)

```jsx
// SpinWheel.jsx
import { useRef, useState } from 'react';

const PRIZES = [
  { label: '5% OFF', weight: 30 },
  { label: '10% OFF', weight: 25 },
  { label: 'FREE SHIP', weight: 20 },
  { label: '15% OFF', weight: 10 },
  { label: 'TRY AGAIN', weight: 10 },
  { label: '20% OFF', weight: 5 },
];

function pickWeightedPrize() {
  const total = PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

export default function SpinWheel({ onResult }) {
  const wheelRef = useRef(null);
  const [spinning, setSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const segmentAngle = 360 / PRIZES.length;

  function spin() {
    if (spinning || hasSpun) return;
    setSpinning(true);
    const prizeIndex = pickWeightedPrize();
    // Land the pointer (fixed at top) on the middle of the chosen segment,
    // plus several full extra rotations for visual effect.
    const targetAngle = 360 * 5 + (360 - prizeIndex * segmentAngle - segmentAngle / 2);
    wheelRef.current.style.transition = 'transform 4.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
    wheelRef.current.style.transform = `rotate(${targetAngle}deg)`;

    setTimeout(() => {
      setSpinning(false);
      setHasSpun(true);
      onResult?.(PRIZES[prizeIndex]);
    }, 4600);
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        ref={wheelRef}
        style={{
          width: 260,
          height: 260,
          borderRadius: '50%',
          margin: '0 auto',
          background: `conic-gradient(${PRIZES.map(
            (_, i) => `${i % 2 === 0 ? '#1a1a1a' : '#f0ede8'} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`
          ).join(', ')})`,
          position: 'relative',
        }}
      >
        {PRIZES.map((p, i) => (
          <span
            key={p.label}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `rotate(${i * segmentAngle + segmentAngle / 2}deg) translate(0, -100px) rotate(-90deg)`,
              fontSize: 11,
              fontWeight: 700,
              color: i % 2 === 0 ? '#fff' : '#1a1a1a',
            }}
          >
            {p.label}
          </span>
        ))}
      </div>
      <button className="popup-cta" onClick={spin} disabled={spinning || hasSpun} style={{ marginTop: 24, width: 200 }}>
        {hasSpun ? 'Already Spun' : spinning ? 'Spinning…' : 'Spin to Win'}
      </button>
    </div>
  );
}
```

---

## 9. Discount-Code Reveal Patterns

Two approaches seen in the reference set:

**1. Manual copy code** (Bloom, HexClad, publisher example) - code shown in a dashed/bordered box with a "Copy" button. Use when the storefront checkout requires a manually entered promo field.

**2. Auto-apply on click-through** (Camilla's second panel: "Use code WELCOME10" with a "Start Shopping" button that also sets a session cookie or query param your checkout reads) - removes a step at checkout, generally converts slightly better since it removes a manual paste step, but requires backend/platform support (Shopify Scripts, discount-link URLs like `?discount=CODE`).

**Code display component rules:**
- Monospace or letter-spaced font so the code is unambiguous (no confusing 0/O or 1/l)
- Copy button must give immediate feedback (checkmark icon or "Copied!" text swap for ~2 seconds)
- Always show the code as plain, selectable text as a fallback - don't render it only as an image or canvas element

---

## 10. QA Checklist + A/B Testing Roadmap

### Pre-launch QA
- [ ] Modal is keyboard-navigable start to finish (Tab, Shift+Tab, Enter, Escape)
- [ ] Focus returns to the triggering element on close
- [ ] Countdown timer doesn't reset on page refresh mid-session (persist start time in `sessionStorage`)
- [ ] Popup does not re-appear within the same session after dismissal or conversion
- [ ] All CTAs and inputs meet 44×44px touch target minimum
- [ ] Tested at 320px width (smallest common mobile viewport) through desktop
- [ ] Discount code actually applies at checkout (test the full path, not just the popup)
- [ ] SMS/phone capture includes required consent language and opt-out instructions
- [ ] Popup does not trigger on already-converted/logged-in customers

### What to A/B test, in priority order
1. **Offer type** - % off vs. free shipping vs. free gift (biggest lever, test first)
2. **Single-step vs. two-step** - does the extra step lift or suppress conversion for your specific audience?
3. **Headline copy** - benefit-led phrasing variants
4. **Trigger timing** - exit-intent vs. scroll-depth vs. time-delay
5. **Static vs. gamified** - only worth testing once the above are settled, since gamification adds build complexity
6. **CTA button copy** - smallest lever, test last

---

## 11. Annotated Reference Gallery

**From your screenshots:**

| Brand | Pattern | Notable technique |
|---|---|---|
| Pact | Two-step gated reveal + quiz option | Countdown starts at teaser step; serif headline over lifestyle photo; quiz variant segments by shopper motivation |
| mindbodygreen | Two-step, email → phone (SMS) | Product-in-hand photography; countdown visible through all 3 steps; dashed code box |
| Bloom | Quiz-gated + two-step | Segmentation tiles ("Fitness Fuel," "Got Health") before capture; gradient background matches product packaging |
| HexClad | Two-step, single field | Dark, moody background suits premium cookware positioning; large dollar-off amount as headline |
| Beckett Simonon | Gamified scratch card | Canvas-based foil reveal; product photography stays visible throughout, unscratched card as CTA itself |
| Princess Polly | Two-step, centered card | Simple centered-card shell (no split layout); confirmation screen sets expectation that code arrives by email |
| Camilla | Two-step, email + phone, dual exit paths | "No Thank You" explicit dismiss option; auto-styled code display on reveal ("Use code WELCOME10") |
| Publisher (book site) | Single-step, multi-field lead form | More fields than typical ecommerce (name, DOB) - justified by content personalization, not just a discount |

**Additional researched examples worth studying:**

| Brand / Source | Pattern | Notable technique |
|---|---|---|
| Gymshark | Non-modal corner popup | Deliberately non-intrusive top-corner placement, avoids blocking hero imagery - a useful contrast to full-modal patterns |
| Allbirds | Add-to-cart confirmation (non-modal) | Dual CTA ("View Cart" / "Continue Shopping") - shows the same shell system applies beyond capture/discount use cases |
| Boll & Branch | Full-screen popup | Full-viewport takeover matched to premium brand photography before showing the storefront |
| The New Yorker | Single-field minimalist | Zero discount - value proposition is editorial content alone, proving offer-led copy isn't mandatory if brand equity is strong |
| Morning Brew | Benefit-led, no discount | Headline states a specific outcome ("a smarter way to start your day") rather than a percentage |
| The Hustle | Social proof | Subscriber-count framing ("Join 2M+ readers") substitutes for a discount as the trust signal |
| HubSpot | Exit-intent lead magnet | Gated content offer (ebook/guide) instead of a discount - same two-step mechanics, different reward type |

---

## 12. Ethical Guardrails

- **Never fake a countdown.** A timer that silently resets on refresh is detectable by attentive users and, once caught, discounts every future urgency message from your brand.
- **Never fake scarcity.** "Only 3 left" that's static/permanent is a compliance risk in several jurisdictions and a trust risk everywhere.
- **Disclose SMS terms clearly.** Message frequency, "message and data rates may apply," and a clear opt-out method are legal requirements in the US (TCPA) and expected practice elsewhere - don't bury this in tiny gray text below the fold of the popup.
- **Respect exit-intent restraint.** One exit-intent popup per session, never chained into a second ask immediately after dismissal.
- **Don't gate core navigation.** A popup should always be closable and should never be the only path to browsing the site.

---

*This guide is a living reference - as you ship variants, extend Section 11 with your own performance notes (which pattern actually won for which traffic segment) so it compounds into a genuine internal playbook rather than a one-time brief.*
