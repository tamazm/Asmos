/* eslint-disable */
/**
 * Asmos Widget v2
 * Paste this snippet into your site's <head> to activate Asmos popups.
 *
 * Usage:
 *   <script src="https://app.asmos.io/widget/asmos-widget.js"
 *     data-asmos-key="YOUR_SITE_KEY"
 *     async defer></script>
 */
(function (window, document) {
  "use strict";

  // ─── Config ───────────────────────────────────────────────────────────────
  var script = document.currentScript ||
    document.querySelector("script[data-asmos-key]");
  var SITE_KEY = script && script.getAttribute("data-asmos-key");
  var API_BASE = (script && script.getAttribute("data-asmos-host")) ||
    "https://app.asmos.io";

  if (!SITE_KEY) {
    console.warn("[Asmos] data-asmos-key is required.");
    return;
  }

  // ─── State ────────────────────────────────────────────────────────────────
  var chosenVariant = null;
  var shown = false;

  // ─── Behavioral context (AI popup variation roadmap, Phase 0) ──────────────
  // Persistent first-party per-visitor id — used as the PostHog distinct_id
  // (see /api/widget/events) so funnels/cohorts/replay correlate correctly,
  // instead of every visitor of a variant sharing one synthetic id.
  var VISITOR_ID_KEY = "asmos_visitor_id";
  function getVisitorId() {
    try {
      var existing = localStorage.getItem(VISITOR_ID_KEY);
      if (existing) return existing;
      var id = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
      localStorage.setItem(VISITOR_ID_KEY, id);
      return id;
    } catch (e) {
      return "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
    }
  }
  var visitorId = getVisitorId();
  var pageLoadTime = Date.now();

  // Parse UTM params from the current URL query string
  var utmParams = (function () {
    var params = {};
    try {
      var search = new URLSearchParams(window.location.search);
      params.utmSource = search.get("utm_source") || undefined;
      params.utmMedium = search.get("utm_medium") || undefined;
      params.utmCampaign = search.get("utm_campaign") || undefined;
    } catch (e) { /* ignore */ }
    return params;
  })();

  var maxScrollDepthPct = 0;
  var scrollDebounceTimer = null;
  function updateScrollDepth() {
    var scrolled = window.scrollY + window.innerHeight;
    var full = document.documentElement.scrollHeight;
    if (full > 0) {
      var pct = Math.round((scrolled / full) * 100);
      if (pct > maxScrollDepthPct) maxScrollDepthPct = Math.min(pct, 100);
    }
  }
  window.addEventListener("scroll", function () {
    clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(updateScrollDepth, 150);
  }, { passive: true });
  updateScrollDepth(); // capture initial value

  function behavioralContext(extra) {
    var ctx = {
      visitorId: visitorId,
      pageUrl: window.location.href,
      referrer: document.referrer || undefined,
      utmSource: utmParams.utmSource,
      utmMedium: utmParams.utmMedium,
      utmCampaign: utmParams.utmCampaign,
      scrollDepthPct: maxScrollDepthPct,
      timeOnPageSeconds: Math.round((Date.now() - pageLoadTime) / 1000),
    };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) ctx[k] = extra[k];
      }
    }
    return ctx;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function fetchConfig() {
    var url = API_BASE + "/api/widget/config?site=" + encodeURIComponent(window.location.hostname);
    return fetch(url, { credentials: "omit" })
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }

  function postEvent(variantId, type, extra) {
    var url = API_BASE + "/api/widget/events";
    var body = Object.assign({ variantId: variantId, type: type }, behavioralContext(extra));
    navigator.sendBeacon
      ? navigator.sendBeacon(url, JSON.stringify(body))
      : fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
          credentials: "omit",
        });
  }

  // Exposed for AI-generated template scripts (variant.generatedCode) to
  // call directly — see lib/templates/*.ts. Same contract as public/widget.js.
  window.__asmos_track_event = function (type, extra) {
    if (chosenVariant) postEvent(chosenVariant.id, type, extra);
  };
  window.__asmos_behavioral_context = behavioralContext;

  // ─── Optional rich session capture (AI popup variation roadmap, Phase 1) ───
  function loadPostHog(tracking) {
    if (!tracking || !tracking.posthogKey || window.posthog) return;
    try {
      /* eslint-disable */
      !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
      /* eslint-enable */
      window.posthog.init(tracking.posthogKey, {
        api_host: tracking.posthogHost,
        defaults: "2026-05-30",
        disable_session_recording: !tracking.sessionRecordingEnabled,
        bootstrap: { distinctID: visitorId },
      });
    } catch (e) {
      // Tracking is best-effort — never let it break the popup itself.
    }
  }

  // ─── Consent banner ──────────────────────────────────────────────────────
  var CONSENT_KEY = "asmos_consent";
  function showConsentBanner(consent, onAccept) {
    try {
      var existing = localStorage.getItem(CONSENT_KEY);
      if (existing) { if (existing === "accepted") onAccept(); return; }
    } catch (e) { /* storage unavailable — fall through to asking */ }

    if (consent && consent.required === false) { onAccept(); return; }

    var banner = document.createElement("div");
    banner.style.cssText =
      "position:fixed;bottom:0;left:0;right:0;z-index:2147483647;" +
      "background:#111827;color:#fff;padding:14px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;";

    var text = document.createElement("span");
    text.textContent = (consent && consent.bannerText) ||
      "We use cookies to personalize your experience and show relevant offers.";
    banner.appendChild(text);

    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-shrink:0;";

    var decline = document.createElement("button");
    decline.textContent = "Decline";
    decline.style.cssText = "background:transparent;border:1px solid #4b5563;color:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:13px;";
    decline.onclick = function () {
      try { localStorage.setItem(CONSENT_KEY, "declined"); } catch (e) {}
      banner.remove();
    };

    var accept = document.createElement("button");
    accept.textContent = "Accept";
    accept.style.cssText = "background:#6366f1;border:none;color:#fff;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;font-weight:600;";
    accept.onclick = function () {
      try { localStorage.setItem(CONSENT_KEY, "accepted"); } catch (e) {}
      banner.remove();
      onAccept();
    };

    actions.appendChild(decline);
    actions.appendChild(accept);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  // ─── Variant selection (weighted) ─────────────────────────────────────────
  function pickVariant(variants, forcedId) {
    if (forcedId) {
      var forced = variants.find(function (v) { return v.id === forcedId; });
      if (forced) return forced;
    }
    var roll = Math.random() * 100;
    var cumulative = 0;
    for (var i = 0; i < variants.length; i++) {
      cumulative += (variants[i].trafficPercent || 100);
      if (roll < cumulative) return variants[i];
    }
    return variants[0];
  }

  // ─── Color helpers ────────────────────────────────────────────────────────

  // Parse any CSS color into {r,g,b} (supports #rrggbb, #rgb, rgb(...))
  function parseColor(hex) {
    if (!hex) return { r: 22, g: 93, b: 255 }; // Asmos blue fallback
    var s = hex.trim();
    if (s[0] === "#") {
      if (s.length === 4) s = "#" + s[1]+s[1] + s[2]+s[2] + s[3]+s[3];
      return {
        r: parseInt(s.slice(1, 3), 16),
        g: parseInt(s.slice(3, 5), 16),
        b: parseInt(s.slice(5, 7), 16),
      };
    }
    var m = s.match(/rgba?\s*\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return { r: 22, g: 93, b: 255 };
  }

  // Relative luminance (WCAG)
  function luminance(c) {
    var vals = [c.r, c.g, c.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
  }

  // Whether white text is legible on a given background color
  function usesWhiteText(hex) {
    var c = parseColor(hex);
    return luminance(c) < 0.35;
  }

  // Darken a hex color by amount 0-1
  function darken(hex, amount) {
    var c = parseColor(hex);
    var r = Math.max(0, Math.round(c.r * (1 - amount)));
    var g = Math.max(0, Math.round(c.g * (1 - amount)));
    var b = Math.max(0, Math.round(c.b * (1 - amount)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // Very light tint of brand color for backgrounds
  function tint(hex, opacity) {
    var c = parseColor(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + opacity + ")";
  }

  // ─── HTML escape ──────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── Styles (legacy card fallback — used when a variant has no AI-rendered
  // generatedCode, e.g. WHEEL/SCRATCH_CARD types or older data) ─────────────
  function injectStyles(primary) {
    if (document.getElementById("asmos-styles")) return;

    var white  = usesWhiteText(primary) ? "#ffffff" : "#0d0d10";
    var btnHover = darken(primary, 0.12);
    var focusRing = tint(primary, 0.18);

    var css = [
      // Reset
      "#asmos-overlay,#asmos-overlay *{box-sizing:border-box;margin:0;padding:0}",

      // Entry animation
      "@keyframes asmos-in{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes asmos-in-mobile{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}",

      // Overlay
      "#asmos-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.52);z-index:2147483647;display:flex;align-items:flex-end;justify-content:center;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;-webkit-font-smoothing:antialiased}",
      "@media(min-width:640px){#asmos-overlay{align-items:center;padding:16px}}",

      // Card
      "#asmos-card{background:#ffffff;width:100%;max-width:440px;border-radius:20px 20px 0 0;padding:36px 28px 28px;position:relative;box-shadow:0 -2px 60px rgba(0,0,0,0.18);animation:asmos-in-mobile 0.38s cubic-bezier(0.16,1,0.3,1) both}",
      "@media(min-width:640px){#asmos-card{border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,0.22),0 4px 16px rgba(0,0,0,0.1);animation-name:asmos-in}}",

      // Accent bar at top
      "#asmos-bar{position:absolute;top:0;left:0;right:0;height:4px;border-radius:20px 20px 0 0;background:" + esc(primary) + "}",
      "@media(min-width:640px){#asmos-bar{border-radius:20px 20px 0 0}}",

      // Close button
      "#asmos-close{position:absolute;top:14px;right:14px;width:28px;height:28px;border-radius:50%;background:#f3f4f6;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:14px;line-height:1;transition:background 0.15s,color 0.15s}",
      "#asmos-close:hover{background:#e5e7eb;color:#111111}",
      "#asmos-close:focus-visible{outline:2px solid " + esc(primary) + ";outline-offset:2px}",

      // Brand row
      "#asmos-brand{display:flex;align-items:center;gap:8px;margin-bottom:18px}",
      "#asmos-brand-dot{width:8px;height:8px;border-radius:50%;background:" + esc(primary) + ";flex-shrink:0}",
      "#asmos-brand-name{font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af}",

      // Headline
      "#asmos-headline{font-size:22px;font-weight:800;color:#0d0d10;line-height:1.2;letter-spacing:-0.02em;margin-bottom:8px}",

      // Body
      "#asmos-body{font-size:14px;color:#6b7280;line-height:1.65;margin-bottom:24px}",

      // Wheel preview block
      "#asmos-wheel-block{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:20px}",
      "#asmos-wheel-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:10px}",
      "#asmos-wheel-list{list-style:none}",
      "#asmos-wheel-list li{padding:5px 0;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:6px}",
      "#asmos-wheel-list li:last-child{border-bottom:none}",
      "#asmos-wheel-list li::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:" + esc(primary) + ";flex-shrink:0}",

      // Form
      "#asmos-form{display:flex;flex-direction:column;gap:10px}",

      // Inputs
      ".asmos-input{width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:11px 14px;font-size:14px;font-family:inherit;color:#0d0d10;background:#fafafa;outline:none;transition:border-color 0.15s,box-shadow 0.15s}",
      ".asmos-input::placeholder{color:#9ca3af}",
      ".asmos-input:focus{border-color:" + esc(primary) + ";box-shadow:0 0 0 3px " + focusRing + ";background:#fff}",

      // Submit button
      "#asmos-submit{background:" + esc(primary) + ";color:" + white + ";border:none;border-radius:10px;padding:13px 20px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;letter-spacing:0.01em;transition:background 0.15s,transform 0.1s;margin-top:2px}",
      "#asmos-submit:hover:not(:disabled){background:" + btnHover + "}",
      "#asmos-submit:active:not(:disabled){transform:scale(0.98)}",
      "#asmos-submit:disabled{opacity:0.6;cursor:default}",
      "#asmos-submit:focus-visible{outline:2px solid " + esc(primary) + ";outline-offset:2px}",

      // Trust row
      "#asmos-trust{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:18px;padding-top:16px;border-top:1px solid #f3f4f6;flex-wrap:wrap}",
      ".asmos-trust-item{display:flex;align-items:center;gap:4px;font-size:11px;color:#9ca3af;white-space:nowrap}",
      ".asmos-trust-item svg{width:12px;height:12px;flex-shrink:0}",

      // Dismiss link
      "#asmos-dismiss{display:block;text-align:center;font-size:12px;color:#9ca3af;margin-top:12px;background:none;border:none;font-family:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px;transition:color 0.15s}",
      "#asmos-dismiss:hover{color:#6b7280}",

      // Success state
      "#asmos-success{text-align:center;padding:20px 0 8px}",
      "#asmos-success-icon{font-size:36px;margin-bottom:12px}",
      "#asmos-success-title{font-size:18px;font-weight:700;color:#0d0d10;margin-bottom:6px}",
      "#asmos-success-body{font-size:14px;color:#6b7280;line-height:1.6}",
    ].join("\n");

    var style = document.createElement("style");
    style.id = "asmos-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Wheel/scratch block ──────────────────────────────────────────────────
  function buildRewardBlock(variant) {
    var rewards = variant.rewards || [];
    if (!rewards.length) rewards = [{ label: "Special reward" }];
    var items = rewards.map(function (r) {
      return "<li>" + esc(r.label) + "</li>";
    }).join("");
    return (
      '<div id="asmos-wheel-block">' +
      '<p id="asmos-wheel-title">You could win</p>' +
      '<ul id="asmos-wheel-list">' + items + "</ul>" +
      "</div>"
    );
  }

  // ─── Popup HTML (legacy card fallback) ─────────────────────────────────────
  function buildPopupHTML(variant, cfg) {
    var design   = variant.design || {};
    var headline = design.headline || "Get an exclusive offer";
    var body     = design.body     || "Enter your email below to claim your reward.";
    var cta      = design.ctaText  || "Get my offer";
    var storeName = cfg.storeName  || "";
    var type     = cfg.type        || "FORM";
    var fields   = variant.formFields || ["email"];

    var rewardBlock = (type === "WHEEL" || type === "SCRATCH_CARD")
      ? buildRewardBlock(variant)
      : "";

    var inputsHTML = fields.map(function (f) {
      var t = f === "email" ? "email" : f === "phone" ? "tel" : "text";
      var ph = f === "email" ? "Your email address"
             : f === "phone" ? "Phone number"
             : f === "name"  ? "Your name"
             : f.charAt(0).toUpperCase() + f.slice(1);
      return '<input class="asmos-input" type="' + t + '" name="' + esc(f) + '" placeholder="' + esc(ph) + '" required autocomplete="' + esc(f) + '">';
    }).join("");

    var brandName = storeName
      ? '<span id="asmos-brand-name">' + esc(storeName.toUpperCase()) + "</span>"
      : "";
    var brandRow = brandName
      ? '<div id="asmos-brand"><span id="asmos-brand-dot"></span>' + brandName + "</div>"
      : "";

    var trustRow = (
      '<div id="asmos-trust">' +
      '<span class="asmos-trust-item"><svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5 10 5.5 14.5 6.2 11.25 9.3 12 13.8 8 11.7 4 13.8 4.75 9.3 1.5 6.2 6 5.5 8 1.5z" stroke="#9ca3af" stroke-width="1.2" stroke-linejoin="round"/></svg>No spam</span>' +
      '<span class="asmos-trust-item"><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="6" width="12" height="9" rx="2" stroke="#9ca3af" stroke-width="1.2"/><path d="M5 6V4.5a3 3 0 016 0V6" stroke="#9ca3af" stroke-width="1.2"/></svg>Unsubscribe anytime</span>' +
      '<span class="asmos-trust-item"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#9ca3af" stroke-width="1.2"/><path d="M5.5 8.5 7 10 10.5 6" stroke="#9ca3af" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Instant reward</span>' +
      "</div>"
    );

    return (
      '<div id="asmos-overlay" role="dialog" aria-modal="true" aria-labelledby="asmos-headline">' +
      '<div id="asmos-card">' +
      '<div id="asmos-bar"></div>' +
      '<button id="asmos-close" aria-label="Close">' +
        '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      "</button>" +
      brandRow +
      '<h2 id="asmos-headline">' + esc(headline) + "</h2>" +
      '<p id="asmos-body">' + esc(body) + "</p>" +
      rewardBlock +
      '<form id="asmos-form">' +
      inputsHTML +
      '<button id="asmos-submit" type="submit" data-cta="' + esc(cta) + '">' + esc(cta) + "</button>" +
      "</form>" +
      trustRow +
      '<button id="asmos-dismiss">No thanks, I\'ll pay full price</button>' +
      "</div>" +
      "</div>"
    );
  }

  // ─── Success state (legacy card fallback) ──────────────────────────────────
  function showSuccess(rewards) {
    var coupon = (rewards && rewards[0] && rewards[0].couponCode) ? rewards[0].couponCode : null;
    var card = document.getElementById("asmos-card");
    if (!card) return;

    var codeLine = coupon
      ? '<p id="asmos-success-body">Your code: <strong style="font-family:monospace;letter-spacing:0.05em">' + esc(coupon) + "</strong><br>Check your inbox for details.</p>"
      : '<p id="asmos-success-body">Check your inbox for your exclusive offer.</p>';

    card.innerHTML = (
      '<div id="asmos-bar"></div>' +
      '<div id="asmos-success">' +
      '<div id="asmos-success-icon">&#127881;</div>' +
      '<p id="asmos-success-title">You\'re in!</p>' +
      codeLine +
      "</div>"
    );
    setTimeout(closePopup, 3000);
  }

  // ─── Show popup ───────────────────────────────────────────────────────────
  var popupShownAt = null;
  var converted = false;

  function showPopup(cfg) {
    if (shown || document.getElementById("asmos-overlay") || document.getElementById("asmos-popup-container")) return;
    shown = true;
    popupShownAt = Date.now();
    converted = false;

    chosenVariant = pickVariant(cfg.variants, cfg.forcedVariantId);

    // AI popup variation roadmap, Phase 0/3: render the AI-designed template
    // (split-screen / corner-toast / fullscreen-takeover — see
    // lib/templates/*.ts) when the variant has one, instead of always
    // falling back to the generic hardcoded card below. The generated
    // template's own inline script handles its own DOM/tracking via the
    // window.__asmos_* globals set here.
    if (chosenVariant.generatedCode) {
      window.__asmos_active_variant = chosenVariant;
      window.__asmos_api_base = API_BASE;
      window.__asmos_preview_mode = false;

      var container = document.createElement("div");
      container.id = "asmos-popup-container";
      container.innerHTML = chosenVariant.generatedCode;
      document.body.appendChild(container);

      var scripts = container.querySelectorAll("script");
      scripts.forEach(function (s) {
        var newScript = document.createElement("script");
        if (s.src) {
          newScript.src = s.src;
        } else {
          newScript.textContent = s.textContent;
        }
        document.body.appendChild(newScript);
        s.remove();
      });

      postEvent(chosenVariant.id, "IMPRESSION");
      return;
    }

    // ─── Legacy card fallback (WHEEL/SCRATCH_CARD, or variants predating
    // the AI template engine) ────────────────────────────────────────────
    var primary = (chosenVariant.design && chosenVariant.design.primaryColor) ||
                  cfg.primaryColor || "#165DFF";

    injectStyles(primary);

    var wrapper = document.createElement("div");
    wrapper.innerHTML = buildPopupHTML(chosenVariant, cfg);
    document.body.appendChild(wrapper.firstElementChild);

    postEvent(chosenVariant.id, "IMPRESSION");

    // Bindings
    var closeBtn  = document.getElementById("asmos-close");
    var overlay   = document.getElementById("asmos-overlay");
    var form      = document.getElementById("asmos-form");
    var dismissBtn = document.getElementById("asmos-dismiss");

    if (closeBtn)   closeBtn.addEventListener("click", closePopup);
    if (dismissBtn) dismissBtn.addEventListener("click", closePopup);
    if (overlay)    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closePopup();
    });
    if (form) form.addEventListener("submit", handleSubmit);

    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { closePopup(); document.removeEventListener("keydown", onKey); }
    });
  }

  // ─── Close popup (legacy card fallback) ────────────────────────────────────
  function closePopup() {
    if (!converted && chosenVariant) {
      postEvent(chosenVariant.id, "DISMISSED", {
        dismissAfterMs: popupShownAt ? Date.now() - popupShownAt : undefined,
      });
    }
    var el = document.getElementById("asmos-overlay");
    if (el) el.remove();
  }

  // ─── Form submit (legacy card fallback) ────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var btn  = document.getElementById("asmos-submit");
    var data = {};
    var inputs = form.querySelectorAll("input");
    for (var i = 0; i < inputs.length; i++) {
      data[inputs[i].name] = inputs[i].value;
    }

    btn.disabled = true;
    btn.textContent = "One moment...";

    // Fields must be flat (email/name/phone) — /api/widget/leads reads them
    // as top-level body properties, not nested under a "fields" object.
    var payload = Object.assign(
      { variantId: chosenVariant.id, consentGiven: true },
      data,
      behavioralContext()
    );

    fetch(API_BASE + "/api/widget/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (resData) {
        // /api/widget/leads already creates the SUBMISSION CampaignEvent
        // server-side — don't also fire one from here, that would double-count.
        converted = true;
        showSuccess(resData.reward ? [resData.reward] : chosenVariant.rewards);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = btn.getAttribute("data-cta") || "Get my offer";
      });
  }

  // ─── Trigger setup ────────────────────────────────────────────────────────
  function setupTriggers(cfg) {
    var trigger = cfg.trigger || "time_delay";
    var delay   = typeof cfg.delaySeconds === "number" ? cfg.delaySeconds * 1000 : 5000;

    if (trigger === "exit_intent") {
      var fired = false;
      document.addEventListener("mouseleave", function onLeave(e) {
        if (e.clientY <= 0 && !fired) {
          fired = true;
          document.removeEventListener("mouseleave", onLeave);
          showPopup(cfg);
        }
      });
      // Mobile fallback
      setTimeout(function () { if (!shown) showPopup(cfg); }, Math.max(delay, 10000));
    } else if (trigger === "scroll_depth") {
      window.addEventListener("scroll", function onScroll() {
        var scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
        if (scrolled >= 0.5) {
          window.removeEventListener("scroll", onScroll);
          showPopup(cfg);
        }
      });
    } else {
      setTimeout(function () { showPopup(cfg); }, delay);
    }
  }

  // ─── Session dedup ────────────────────────────────────────────────────────
  var SESSION_KEY = "asmos_seen_" + SITE_KEY;

  function alreadySeen() {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) { return false; }
  }
  function markSeen() {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  function init() {
    if (alreadySeen()) return;
    fetchConfig().then(function (data) {
      if (!data || !data.campaign) return;
      var c = data.campaign;
      if (!c.variants || !c.variants.length) return;

      showConsentBanner(data.consent, function () {
        if (data.tracking) loadPostHog(data.tracking);
        markSeen();
        setupTriggers(Object.assign({ trigger: "time_delay", delaySeconds: 5 }, c));
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window, document);
