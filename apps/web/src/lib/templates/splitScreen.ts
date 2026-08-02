export interface PopupTemplateProps {
  headline: string;
  subhead: string;
  cta: string;
  primaryColor: string;
  couponCode?: string | null;
  imageUrl?: string | null;
  goal?: "EMAIL" | "DISCOUNT" | "BOTH";
  layoutStyle?: "split-left" | "split-right" | "centered" | "minimal";
}

export function renderSplitScreenTemplate({
  headline,
  subhead,
  cta,
  primaryColor,
  couponCode,
  imageUrl,
  goal = "BOTH",
  layoutStyle = "split-left",
}: PopupTemplateProps): string {
  const fallbackImg = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800&auto=format&fit=crop";
  const imgToUse = imageUrl || fallbackImg;
  const ctaColor = primaryColor || "#165DFF";

  // Determine which steps are active based on the goal
  const hasCapture = goal === "BOTH" || goal === "EMAIL";
  const hasReveal = goal === "BOTH" || goal === "DISCOUNT";
  const startingStep = goal === "DISCOUNT" ? 3 : (goal === "EMAIL" ? 2 : 1);
  
  // Custom wording for Email-only goal
  const emailHeadline = goal === "EMAIL" ? headline : "Almost there";
  const emailSubhead = goal === "EMAIL" ? subhead : "Enter your email to unlock your code.";
  const emailCta = goal === "EMAIL" ? cta : "Continue";

  // Custom wording for Discount-only goal
  const discountHeadline = goal === "DISCOUNT" ? headline : "Your code is ready";
  const discountSubhead = goal === "DISCOUNT" ? subhead : "Use this code at checkout.";

  return `
<!-- ASMOS POPUP TEMPLATE: SPLIT SCREEN -->
<div class="asmos-overlay" id="asmosPopupOverlay" hidden>
  <style>
    :root {
      --asmos-radius: 8px;
      --asmos-bg: #ffffff;
      --asmos-fg: #1a1a1a;
      --asmos-muted: #6b7280;
      --asmos-accent: ${ctaColor};
      --asmos-accent-fg: #ffffff;
      --asmos-max-width: 900px;
      --asmos-transition: 220ms ease-out;
    }

    .asmos-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483000;
      opacity: 0;
      visibility: hidden;
      transition: opacity var(--asmos-transition), visibility var(--asmos-transition);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .asmos-overlay.is-open { 
      opacity: 1; 
      visibility: visible;
    }

    .asmos-modal {
      display: ${layoutStyle.startsWith('split') ? 'grid' : 'flex'};
      flex-direction: column;
      ${layoutStyle === 'split-left' ? 'grid-template-columns: 1fr 1fr;' : ''}
      ${layoutStyle === 'split-right' ? 'grid-template-columns: 1fr 1fr; direction: rtl;' : ''}
      width: min(var(--asmos-max-width), 92vw);
      ${layoutStyle === 'minimal' ? 'max-width: 480px;' : layoutStyle === 'centered' ? 'max-width: 600px;' : ''}
      max-height: 90vh;
      overflow: hidden;
      background: var(--asmos-bg);
      border-radius: var(--asmos-radius);
      transform: translateY(20px) scale(0.96);
      opacity: 0;
      transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      position: relative;
    }
    .asmos-overlay.is-open .asmos-modal { 
      transform: translateY(0) scale(1);
      opacity: 1; 
    }

    .asmos-media { 
      position: relative; 
      overflow: hidden; 
      background: #f3f4f6; 
      ${layoutStyle === 'centered' ? 'height: 250px;' : layoutStyle === 'minimal' ? 'display: none;' : ''}
    }
    .asmos-media img { width: 100%; height: 100%; object-fit: cover; }

    .asmos-content {
      position: relative;
      padding: ${layoutStyle === 'minimal' ? '32px 32px' : '48px 40px'};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      direction: ltr; /* Reset from split-right */
    }

    .asmos-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 40px;
      height: 40px;
      border: 0;
      background: transparent;
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
      color: var(--asmos-muted);
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .asmos-close:hover { color: var(--asmos-fg); }

    .asmos-timer {
      font-variant-numeric: tabular-nums;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
      color: var(--asmos-accent);
      font-weight: 700;
    }

    .asmos-eyebrow {
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--asmos-muted);
      margin-bottom: 12px;
    }

    .asmos-headline {
      font-size: 32px;
      line-height: 1.1;
      margin: 0 0 12px;
      color: var(--asmos-fg);
      font-weight: 800;
    }

    .asmos-sub {
      font-size: 15px;
      color: var(--asmos-muted);
      margin: 0 0 24px;
      max-width: 34ch;
      line-height: 1.5;
    }

    .asmos-cta {
      width: 100%;
      padding: 16px 24px;
      background: var(--asmos-accent);
      color: var(--asmos-accent-fg);
      border: 0;
      border-radius: var(--asmos-radius);
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      min-height: 48px;
      transition: opacity 0.2s;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .asmos-cta:hover { opacity: 0.9; }

    .asmos-email-input {
      width: 100%;
      padding: 14px 16px;
      margin-bottom: 12px;
      border: 1px solid #d1d5db;
      border-radius: var(--asmos-radius);
      font-size: 15px;
      min-height: 48px;
      color: var(--asmos-fg);
      outline: none;
    }
    .asmos-email-input:focus {
      border-color: var(--asmos-accent);
      box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
    }

    .asmos-dismiss {
      margin-top: 16px;
      background: none;
      border: 0;
      color: var(--asmos-muted);
      font-size: 13px;
      text-decoration: underline;
      cursor: pointer;
    }

    .asmos-code {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 2px dashed var(--asmos-muted);
      padding: 14px 18px;
      border-radius: var(--asmos-radius);
      font-weight: 700;
      letter-spacing: 0.08em;
      margin: 0 0 20px;
      width: 100%;
      color: var(--asmos-fg);
      background: #f9fafb;
    }
    .asmos-code button {
      background: var(--asmos-fg);
      color: #fff;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 600;
    }

    .popup-step { 
      width: 100%; 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      transition: opacity 300ms ease, transform 300ms ease;
      opacity: 1;
      transform: translateY(0);
    }
    .popup-step.is-exiting {
      opacity: 0;
      transform: translateY(-10px);
      pointer-events: none;
    }
    .popup-step.is-entering {
      opacity: 0;
      transform: translateY(10px);
    }
    .popup-step[hidden] { display: none !important; }

    .visually-hidden {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }

    @media (max-width: 768px) {
      .asmos-modal { grid-template-columns: 1fr; max-height: 85vh; overflow-y: auto; }
      .asmos-media { max-height: 25vh; }
      .asmos-content { padding: 32px 24px; }
      .asmos-headline { font-size: 26px; }
    }
  </style>

  <div class="asmos-modal" role="dialog" aria-modal="true" aria-labelledby="asmosPopupHeadline">
    <button class="asmos-close" id="asmosPopupClose" aria-label="Close">&times;</button>

    ${layoutStyle !== 'minimal' ? `
    <div class="asmos-media" aria-hidden="true">
      <img src="${imgToUse}" alt="" />
    </div>
    ` : ''}

    <div class="asmos-content">
      ${
        goal === "BOTH"
          ? `
      <!-- STEP 1: Teaser -->
      <section class="popup-step" data-step="1" ${startingStep !== 1 ? "hidden" : ""}>
        <p class="asmos-timer">10:00</p>
        <p class="asmos-eyebrow">Limited Time Offer</p>
        <h2 id="asmosPopupHeadline" class="asmos-headline">${headline}</h2>
        <p class="asmos-sub">${subhead}</p>
        <button class="asmos-cta" data-next="2">${cta}</button>
        <button class="asmos-dismiss" data-dismiss>No thanks, I'll pay full price</button>
      </section>
      `
          : ""
      }

      ${
        hasCapture
          ? `
      <!-- STEP 2: Capture -->
      <section class="popup-step" data-step="2" ${startingStep !== 2 ? "hidden" : ""}>
        ${goal === "BOTH" ? '<p class="asmos-timer">09:41</p>' : ""}
        <h2 class="asmos-headline">${emailHeadline}</h2>
        <p class="asmos-sub">${emailSubhead}</p>
        <form id="asmosPopupForm" style="width: 100%;">
          <label class="visually-hidden" for="asmosPopupEmail">Email address</label>
          <input type="email" id="asmosPopupEmail" name="email" class="asmos-email-input" placeholder="Your email address" required />
          <button type="submit" class="asmos-cta">${emailCta}</button>
        </form>
        ${goal === "EMAIL" ? '<button class="asmos-dismiss" data-dismiss>No thanks</button>' : ""}
      </section>
      `
          : ""
      }

      ${
        hasReveal
          ? `
      <!-- STEP 3: Reveal -->
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
      <!-- STEP 4: Success (Email only) -->
      <section class="popup-step" data-step="4" hidden>
        <div style="margin-bottom: 16px; color: var(--asmos-accent);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h2 class="asmos-headline">You're on the list!</h2>
        <p class="asmos-sub">Thanks for subscribing. Keep an eye on your inbox.</p>
        <button class="asmos-cta" data-dismiss>Continue Browsing</button>
      </section>
      `
          : ""
      }
    </div>
  </div>
</div>

<script>
  (function () {
    const STORAGE_KEY = 'asmos_popup_last_seen';
    const SUPPRESS_DAYS = 14;
    const DURATION_SECONDS = 600; // 10 minutes

    const overlay = document.getElementById('asmosPopupOverlay');
    if (!overlay) return;

    const modal = overlay.querySelector('.asmos-modal');
    const closeBtn = document.getElementById('asmosPopupClose');
    const dismissBtns = overlay.querySelectorAll('[data-dismiss]');
    const form = document.getElementById('asmosPopupForm');
    const timerEls = overlay.querySelectorAll('.asmos-timer');
    const copyBtn = document.getElementById('asmosPopupCopy');
    
    let lastFocusedEl = null;
    let timerInterval = null;
    let remaining = DURATION_SECONDS;
    
    // The goal string determines flow behavior
    const currentGoal = "${goal}";

    function shouldShow() {
      // In the preview iframe or store-preview page, we always want to show it.
      if (window.self !== window.top || window.location.pathname.includes('/store-preview')) return true;
      
      const last = localStorage.getItem(STORAGE_KEY);
      if (!last) return true;
      const daysSince = (Date.now() - Number(last)) / 86400000;
      return daysSince > SUPPRESS_DAYS;
    }

    function markSeen() {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
    }

    function formatTime(sec) {
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return m + ':' + s;
    }

    function startTimer() {
      if (timerEls.length === 0) return;
      timerInterval = setInterval(() => {
        remaining -= 1;
        timerEls.forEach((el) => (el.textContent = formatTime(Math.max(remaining, 0))));
        if (remaining <= 0) clearInterval(timerInterval);
      }, 1000);
    }

    function trapFocus(e) {
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
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
      
      const input = modal.querySelector('input');
      const btn = modal.querySelector('button:not(.asmos-close)');
      (input || btn)?.focus();
      
      document.addEventListener('keydown', onKeydown);
      startTimer();
    }

    function closePopup() {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
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
      const currentStep = overlay.querySelector('.popup-step:not([hidden])');
      const nextStep = overlay.querySelector('.popup-step[data-step="' + stepNum + '"]');
      if (!currentStep || !nextStep || currentStep === nextStep) return;

      currentStep.classList.add('is-exiting');
      setTimeout(() => {
        currentStep.hidden = true;
        currentStep.classList.remove('is-exiting');
        
        nextStep.hidden = false;
        nextStep.classList.add('is-entering');
        
        // Force reflow
        void nextStep.offsetWidth;
        
        nextStep.classList.remove('is-entering');
        
        const input = nextStep.querySelector('input');
        if (input) input.focus();
      }, 300);
    }

    // Step navigation
    overlay.querySelectorAll('[data-next]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        goToStep(Number(btn.dataset.next));
      });
    });

    // Form submission
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('asmosPopupEmail');
        const email = emailInput ? emailInput.value : '';
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting...";
        }
        
        const variant = window.__asmos_active_variant;
        const apiBase = window.__asmos_api_base || "";
        
        if (variant) {
          try {
            const res = await fetch(apiBase + '/api/widget/leads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                variantId: variant.id,
                email: email,
                consentGiven: true
              })
            });
            const data = await res.json();
            
            // Inject the dynamic coupon code into the Reveal step if available
            if (data.reward && data.reward.couponCode) {
               const codeEl = document.getElementById('asmosPopupCodeValue');
               if (codeEl) codeEl.textContent = data.reward.couponCode;
            }
          } catch (err) {
            console.error('Lead submission failed', err);
          }
        }
        
        if (currentGoal === "EMAIL") {
          goToStep(4);
        } else {
          goToStep(3); // Go to Reveal
        }
      });
    }

    // Copy to clipboard
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const codeEl = document.getElementById('asmosPopupCodeValue');
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.textContent);
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => (copyBtn.textContent = originalText), 2000);
        }
      });
    }

    // Dismissal
    closeBtn?.addEventListener('click', closePopup);
    dismissBtns.forEach(btn => btn.addEventListener('click', (e) => {
      e.preventDefault();
      closePopup();
    }));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePopup();
    });

    // Automatically trigger on mount if in iframe preview or if shouldShow is true
    setTimeout(() => {
      if (shouldShow()) openPopup();
    }, 500);
    
  })();
</script>
`;
}
