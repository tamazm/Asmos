import type { PopupTemplateProps } from "./types";

// AI popup variation roadmap (Phase 3): maximum-impact, edge-to-edge overlay
// for high-value/urgent offers. Same teaser -> capture -> reveal flow and
// tracking hooks as splitScreen.ts, dialed up visually — full-bleed
// background image, oversized type, no card chrome.
export function renderFullscreenTakeoverTemplate({
  headline,
  subhead,
  cta,
  primaryColor,
  couponCode,
  imageUrl,
  goal = "BOTH",
}: PopupTemplateProps): string {
  const ctaColor = primaryColor || "#165DFF";
  const bgImg = imageUrl || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop";
  const hasCapture = goal === "BOTH" || goal === "EMAIL";
  const hasReveal = goal === "BOTH" || goal === "DISCOUNT";
  const startingStep = goal === "DISCOUNT" ? 3 : (goal === "EMAIL" ? 2 : 1);

  const emailHeadline = goal === "EMAIL" ? headline : "Almost there";
  const emailSubhead = goal === "EMAIL" ? subhead : "Enter your email to unlock your code.";
  const emailCta = goal === "EMAIL" ? cta : "Continue";

  const discountHeadline = goal === "DISCOUNT" ? headline : "Your code is ready";
  const discountSubhead = goal === "DISCOUNT" ? subhead : "Use this code at checkout.";

  return `
<!-- ASMOS POPUP TEMPLATE: FULLSCREEN TAKEOVER -->
<div class="asmos-overlay" id="asmosPopupOverlay" hidden>
  <style>
    :root {
      --asmos-accent: ${ctaColor};
      --asmos-accent-fg: #ffffff;
    }
    .asmos-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 260ms ease-out, visibility 260ms ease-out;
      font-family: system-ui, -apple-system, sans-serif;
      background-image: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 100%), url('${bgImg}');
      background-size: cover;
      background-position: center;
    }
    .asmos-overlay.is-open { opacity: 1; visibility: visible; }
    .asmos-close {
      position: absolute;
      top: 24px;
      right: 24px;
      width: 44px;
      height: 44px;
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 999px;
      background: rgba(0,0,0,0.2);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      color: #fff;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .asmos-close:hover { background: rgba(0,0,0,0.4); }
    .asmos-content {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px;
      transform: translateY(16px) scale(0.98);
      opacity: 0;
      transition: transform 420ms cubic-bezier(0.16,1,0.3,1), opacity 420ms cubic-bezier(0.16,1,0.3,1);
    }
    .asmos-overlay.is-open .asmos-content { transform: translateY(0) scale(1); opacity: 1; }
    .asmos-eyebrow {
      font-size: 13px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.85);
      margin-bottom: 16px;
      font-weight: 700;
    }
    .asmos-headline {
      font-size: clamp(32px, 6vw, 64px);
      line-height: 1.05;
      margin: 0 0 16px;
      color: #fff;
      font-weight: 800;
      max-width: 20ch;
      text-wrap: balance;
    }
    .asmos-sub {
      font-size: 18px;
      color: rgba(255,255,255,0.85);
      margin: 0 0 32px;
      max-width: 42ch;
      line-height: 1.5;
    }
    .asmos-cta {
      padding: 18px 40px;
      background: var(--asmos-accent);
      color: var(--asmos-accent-fg);
      border: 0;
      border-radius: 999px;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      min-height: 56px;
      transition: transform 0.15s, opacity 0.15s;
    }
    .asmos-cta:hover { transform: scale(1.03); opacity: 0.95; }
    .asmos-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(420px, 90vw);
    }
    .asmos-email-input {
      width: 100%;
      padding: 18px 20px;
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 999px;
      font-size: 16px;
      min-height: 56px;
      color: #fff;
      background: rgba(255,255,255,0.12);
      outline: none;
      box-sizing: border-box;
    }
    .asmos-email-input::placeholder { color: rgba(255,255,255,0.6); }
    .asmos-code {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 2px dashed rgba(255,255,255,0.5);
      padding: 16px 22px;
      border-radius: 999px;
      font-weight: 700;
      letter-spacing: 0.1em;
      margin: 0 0 28px;
      width: min(420px, 90vw);
      color: #fff;
      background: rgba(255,255,255,0.08);
    }
    .asmos-code button {
      background: #fff;
      color: #111;
      border: none;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 700;
    }
    .popup-step { display: flex; flex-direction: column; align-items: center; }
    .popup-step[hidden] { display: none !important; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  </style>

  <button class="asmos-close" id="asmosPopupClose" aria-label="Close">&times;</button>

  <div class="asmos-content">
    ${
      goal === "BOTH"
        ? `
    <section class="popup-step" data-step="1" ${startingStep !== 1 ? "hidden" : ""}>
      <p class="asmos-eyebrow">Limited Time Offer</p>
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
      <form id="asmosPopupForm" class="asmos-form">
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
      <a class="asmos-cta" href="/shop" data-dismiss>Shop Now</a>
    </section>
    `
        : ""
    }

    ${
      goal === "EMAIL"
        ? `
    <section class="popup-step" data-step="4" hidden>
      <h2 class="asmos-headline">You're on the list!</h2>
      <p class="asmos-sub">Thanks for subscribing. Keep an eye on your inbox.</p>
      <button class="asmos-cta" data-dismiss>Continue Browsing</button>
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

    const overlay = document.getElementById('asmosPopupOverlay');
    if (!overlay) return;

    const closeBtn = document.getElementById('asmosPopupClose');
    const dismissBtns = overlay.querySelectorAll('[data-dismiss]');
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
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add('is-open'));
      document.body.style.overflow = 'hidden';
    }

    function closePopup() {
      if (!__asmosConverted) {
        __asmosTrack('DISMISSED', { dismissAfterMs: __asmosOpenedAt ? Date.now() - __asmosOpenedAt : undefined });
      }
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => (overlay.hidden = true), 260);
      markSeen();
    }

    function goToStep(stepNum) {
      const current = overlay.querySelector('.popup-step:not([hidden])');
      const next = overlay.querySelector('.popup-step[data-step="' + stepNum + '"]');
      if (!current || !next || current === next) return;
      __asmosTrack('INTERACTION', { step: stepNum });
      current.hidden = true;
      next.hidden = false;
      const input = next.querySelector('input');
      if (input) input.focus();
    }

    overlay.querySelectorAll('[data-next]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        goToStep(Number(btn.dataset.next));
      });
    });

    closeBtn?.addEventListener('click', closePopup);
    dismissBtns.forEach((btn) => btn.addEventListener('click', (e) => { e.preventDefault(); closePopup(); }));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('is-open')) closePopup(); });

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
    }, 500);
  })();
</script>
`;
}
