import type { PopupTemplateProps } from "./types";

// AI popup variation roadmap (Phase 3): a small, non-blocking card anchored
// to a screen corner instead of a full-page overlay. Same teaser -> capture
// -> reveal flow and tracking hooks as splitScreen.ts (see that file's
// comments for the tracking-integration rationale), just a much gentler
// physical presentation — no dimmed backdrop, no page-lock.
export function renderCornerToastTemplate({
  headline,
  subhead,
  cta,
  primaryColor,
  couponCode,
  goal = "BOTH",
}: PopupTemplateProps): string {
  const ctaColor = primaryColor || "#165DFF";
  const hasCapture = goal === "BOTH" || goal === "EMAIL";
  const hasReveal = goal === "BOTH" || goal === "DISCOUNT";
  const startingStep = goal === "DISCOUNT" ? 3 : (goal === "EMAIL" ? 2 : 1);

  const emailHeadline = goal === "EMAIL" ? headline : "Almost there";
  const emailSubhead = goal === "EMAIL" ? subhead : "Enter your email to unlock your code.";
  const emailCta = goal === "EMAIL" ? cta : "Continue";

  const discountHeadline = goal === "DISCOUNT" ? headline : "Your code is ready";
  const discountSubhead = goal === "DISCOUNT" ? subhead : "Use this code at checkout.";

  return `
<!-- ASMOS POPUP TEMPLATE: CORNER TOAST -->
<div class="asmos-toast-wrap" id="asmosPopupOverlay" hidden>
  <style>
    :root {
      --asmos-radius: 12px;
      --asmos-bg: #ffffff;
      --asmos-fg: #1a1a1a;
      --asmos-muted: #6b7280;
      --asmos-accent: ${ctaColor};
      --asmos-accent-fg: #ffffff;
    }
    .asmos-toast-wrap {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483000;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .asmos-modal {
      width: min(340px, calc(100vw - 40px));
      background: var(--asmos-bg);
      border-radius: var(--asmos-radius);
      box-shadow: 0 10px 40px rgba(0,0,0,0.18);
      border: 1px solid rgba(0,0,0,0.06);
      padding: 20px 20px 18px;
      position: relative;
      transform: translateY(16px) scale(0.98);
      opacity: 0;
      transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .asmos-toast-wrap.is-open .asmos-modal {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    .asmos-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      border: 0;
      background: transparent;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      color: var(--asmos-muted);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .asmos-close:hover { color: var(--asmos-fg); }
    .asmos-eyebrow {
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--asmos-accent);
      font-weight: 700;
      margin: 0 0 6px;
    }
    .asmos-headline {
      font-size: 17px;
      line-height: 1.25;
      margin: 0 0 4px;
      color: var(--asmos-fg);
      font-weight: 800;
      padding-right: 20px;
    }
    .asmos-sub {
      font-size: 13px;
      color: var(--asmos-muted);
      margin: 0 0 14px;
      line-height: 1.4;
    }
    .asmos-cta {
      width: 100%;
      padding: 11px 16px;
      background: var(--asmos-accent);
      color: var(--asmos-accent-fg);
      border: 0;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      min-height: 40px;
      transition: opacity 0.2s;
    }
    .asmos-cta:hover { opacity: 0.9; }
    .asmos-email-input {
      width: 100%;
      padding: 10px 12px;
      margin-bottom: 8px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      min-height: 40px;
      color: var(--asmos-fg);
      outline: none;
      box-sizing: border-box;
    }
    .asmos-code {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 2px dashed var(--asmos-muted);
      padding: 10px 14px;
      border-radius: 8px;
      font-weight: 700;
      letter-spacing: 0.06em;
      margin: 0 0 12px;
      font-size: 13px;
      color: var(--asmos-fg);
      background: #f9fafb;
    }
    .asmos-code button {
      background: var(--asmos-fg);
      color: #fff;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
    }
    .popup-step { transition: opacity 200ms ease; }
    .popup-step[hidden] { display: none !important; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    @media (max-width: 480px) {
      .asmos-toast-wrap { left: 12px; right: 12px; bottom: 12px; }
      .asmos-modal { width: 100%; }
    }
  </style>

  <div class="asmos-modal" role="dialog" aria-modal="false" aria-labelledby="asmosPopupHeadline">
    <button class="asmos-close" id="asmosPopupClose" aria-label="Close">&times;</button>

    ${
      goal === "BOTH"
        ? `
    <section class="popup-step" data-step="1" ${startingStep !== 1 ? "hidden" : ""}>
      <p class="asmos-eyebrow">Limited Time</p>
      <h2 id="asmosPopupHeadline" class="asmos-headline">${headline}</h2>
      <p class="asmos-sub">${subhead}</p>
      <button class="asmos-cta" data-next="2">${cta}</button>
    </section>
    `
        : ""
    }

    ${
      hasCapture
        ? `
    <section class="popup-step" data-step="2" ${startingStep !== 2 ? "hidden" : ""}>
      <h2 class="asmos-headline">${emailHeadline}</h2>
      <p class="asmos-sub">${emailSubhead}</p>
      <form id="asmosPopupForm">
        <label class="visually-hidden" for="asmosPopupEmail">Email address</label>
        <input type="email" id="asmosPopupEmail" name="email" class="asmos-email-input" placeholder="Your email address" required />
        <button type="submit" class="asmos-cta">${emailCta}</button>
      </form>
    </section>
    `
        : ""
    }

    ${
      hasReveal
        ? `
    <section class="popup-step" data-step="3" ${startingStep !== 3 ? "hidden" : ""}>
      <h2 class="asmos-headline">${discountHeadline}</h2>
      <p class="asmos-sub">${discountSubhead}</p>
      <div class="asmos-code">
        <span id="asmosPopupCodeValue">${couponCode || "WELCOME10"}</span>
        <button type="button" id="asmosPopupCopy" aria-label="Copy code">Copy</button>
      </div>
    </section>
    `
        : ""
    }

    ${
      goal === "EMAIL"
        ? `
    <section class="popup-step" data-step="4" hidden>
      <h2 class="asmos-headline">You're on the list!</h2>
      <p class="asmos-sub">Thanks for subscribing.</p>
    </section>
    `
        : ""
    }
  </div>
</div>

<script>
  (function () {
    const STORAGE_KEY = 'asmos_popup_last_seen';
    const SUPPRESS_DAYS = 14;

    const wrap = document.getElementById('asmosPopupOverlay');
    if (!wrap) return;

    const closeBtn = document.getElementById('asmosPopupClose');
    const form = document.getElementById('asmosPopupForm');
    const copyBtn = document.getElementById('asmosPopupCopy');
    const emailInputEl = document.getElementById('asmosPopupEmail');

    let __asmosOpenedAt = null;
    let __asmosConverted = false;
    const currentGoal = "${goal}";

    function __asmosTrack(type, extra) {
      if (typeof window.__asmos_track_event === 'function') window.__asmos_track_event(type, extra);
    }

    if (emailInputEl) {
      emailInputEl.addEventListener('focus', () => {
        __asmosTrack('INTERACTION', { step: 'email_field_focus' });
      }, { once: true });
    }

    function shouldShow() {
      if (window.self !== window.top || window.location.pathname.includes('/store-preview')) return true;
      const last = localStorage.getItem(STORAGE_KEY);
      if (!last) return true;
      return (Date.now() - Number(last)) / 86400000 > SUPPRESS_DAYS;
    }
    function markSeen() {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
    }

    function openPopup() {
      __asmosOpenedAt = Date.now();
      wrap.hidden = false;
      requestAnimationFrame(() => wrap.classList.add('is-open'));
    }

    function closePopup() {
      if (!__asmosConverted) {
        __asmosTrack('DISMISSED', { dismissAfterMs: __asmosOpenedAt ? Date.now() - __asmosOpenedAt : undefined });
      }
      wrap.classList.remove('is-open');
      setTimeout(() => (wrap.hidden = true), 240);
      markSeen();
    }

    function goToStep(stepNum) {
      const current = wrap.querySelector('.popup-step:not([hidden])');
      const next = wrap.querySelector('.popup-step[data-step="' + stepNum + '"]');
      if (!current || !next || current === next) return;
      __asmosTrack('INTERACTION', { step: stepNum });
      current.hidden = true;
      next.hidden = false;
      const input = next.querySelector('input');
      if (input) input.focus();
    }

    wrap.querySelectorAll('[data-next]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        goToStep(Number(btn.dataset.next));
      });
    });

    closeBtn?.addEventListener('click', closePopup);

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('asmosPopupEmail');
        const email = emailInput ? emailInput.value : '';
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

        const variant = window.__asmos_active_variant;
        const apiBase = window.__asmos_api_base || '';

        if (window.__asmos_preview_mode) {
          setTimeout(() => {
            alert('Preview: Email captured! (Code: ' + ((variant && variant.popupSpec && variant.popupSpec.coupon_code) || 'N/A') + ')');
          }, 300);
          __asmosConverted = true;
          if (currentGoal === "EMAIL") { goToStep(4); } else { goToStep(3); }
          return;
        }

        if (variant) {
          try {
            const behavioral = typeof window.__asmos_behavioral_context === 'function' ? window.__asmos_behavioral_context() : {};
            const res = await fetch(apiBase + '/api/widget/leads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(Object.assign({ variantId: variant.id, email: email, consentGiven: true }, behavioral)),
            });
            const data = await res.json();
            __asmosConverted = true;
            if (data.reward && data.reward.couponCode) {
              const codeEl = document.getElementById('asmosPopupCodeValue');
              if (codeEl) codeEl.textContent = data.reward.couponCode;
            }
          } catch (err) {
            console.error('Lead submission failed', err);
          }
        }

        if (currentGoal === "EMAIL") { goToStep(4); } else { goToStep(3); }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const codeEl = document.getElementById('asmosPopupCodeValue');
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.textContent);
          const original = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => (copyBtn.textContent = original), 2000);
        }
      });
    }

    setTimeout(() => {
      if (shouldShow()) openPopup();
    }, 400);
  })();
</script>
`;
}
