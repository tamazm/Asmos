/**
 * Asmos Widget Loader v1
 * Paste this snippet into your site's <head> to activate Asmos popups.
 *
 * Usage:
 *   <script src="https://app.asmos.io/widget/asmos-widget.js"
 *     data-asmos-key="YOUR_SITE_KEY"
 *     async defer></script>
 */
(function (window, document) {
  "use strict";

  // ─── Config ──────────────────────────────────────────────────────────────
  var script = document.currentScript ||
    document.querySelector('script[data-asmos-key]');
  var SITE_KEY = script && script.getAttribute("data-asmos-key");
  var API_BASE = (script && script.getAttribute("data-asmos-host")) ||
    "https://app.asmos.io";

  if (!SITE_KEY) {
    console.warn("[Asmos] data-asmos-key is required.");
    return;
  }

  // ─── State ────────────────────────────────────────────────────────────────
  var campaign = null;
  var chosenVariant = null;
  var shown = false;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function fetchConfig() {
    var url = API_BASE + "/api/widget/config?site=" + encodeURIComponent(window.location.hostname);
    return fetch(url, { credentials: "omit" })
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }

  function postEvent(variantId, type, extra) {
    var url = API_BASE + "/api/widget/events";
    var body = Object.assign({ variantId: variantId, type: type }, extra || {});
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

  // ─── Variant selection ────────────────────────────────────────────────────
  function pickVariant(variants, forcedId) {
    if (forcedId) {
      var forced = variants.find(function (v) { return v.id === forcedId; });
      if (forced) return forced;
    }
    var roll = Math.random() * 100;
    var cumulative = 0;
    for (var i = 0; i < variants.length; i++) {
      cumulative += variants[i].trafficPercent;
      if (roll < cumulative) return variants[i];
    }
    return variants[0];
  }

  // ─── Popup rendering ─────────────────────────────────────────────────────
  function buildStyles() {
    var style = document.createElement("style");
    style.id = "asmos-styles";
    style.textContent = [
      "@keyframes asmos-fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}",
      "#asmos-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998;display:flex;align-items:flex-end;justify-content:center;padding-bottom:0}",
      "@media(min-width:640px){#asmos-overlay{align-items:center;padding-bottom:0}}",
      "#asmos-popup{background:#fff;border-radius:20px 20px 0 0;max-width:420px;width:100%;padding:32px 28px 28px;box-shadow:0 -4px 40px rgba(0,0,0,.12);animation:asmos-fade-in .3s ease-out;position:relative;box-sizing:border-box}",
      "@media(min-width:640px){#asmos-popup{border-radius:20px;margin:16px}}",
      "#asmos-close{position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;font-size:20px;color:#6b7280;line-height:1;padding:4px 6px}",
      "#asmos-close:hover{color:#0d0d10}",
      "#asmos-headline{font-size:20px;font-weight:700;color:#0d0d10;margin:0 0 8px;line-height:1.25}",
      "#asmos-body{font-size:14px;color:#6b7280;margin:0 0 20px;line-height:1.6}",
      "#asmos-form{display:flex;flex-direction:column;gap:10px}",
      "#asmos-form input{border:1.5px solid #e5e7eb;border-radius:10px;padding:10px 14px;font-size:14px;outline:none;transition:border-color .15s}",
      "#asmos-form input:focus{border-color:#165dff;box-shadow:0 0 0 3px rgba(22,93,255,.15)}",
      "#asmos-submit{background:#165dff;color:#fff;border:none;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s,transform .1s}",
      "#asmos-submit:hover{background:#124fd9}",
      "#asmos-submit:active{transform:scale(.98)}",
      "#asmos-submit:disabled{opacity:.6;cursor:default}",
      "#asmos-success{text-align:center;padding:12px 0}",
      "#asmos-success p{font-size:15px;color:#0d0d10;font-weight:500}",
      "#asmos-consent{font-size:11px;color:#9ca3af;margin-top:10px;line-height:1.5}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function renderWheel(variant, headline, body) {
    // Simplified wheel: show reward options as a visual list
    var rewards = (variant.rewards || []);
    var rewardList = rewards.length
      ? rewards.map(function (r) {
          return '<li style="padding:6px 0;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6">' + r.label + "</li>";
        }).join("")
      : '<li style="padding:6px 0;font-size:13px;color:#374151">Special reward</li>';
    return (
      '<div id="asmos-wheel-display" style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:20px">' +
      '<p style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px">Win one of these:</p>' +
      '<ul style="margin:0;padding:0;list-style:none">' + rewardList + "</ul>" +
      "</div>"
    );
  }

  function buildPopupHTML(v, cfg) {
    var headline = (v.design && v.design.headline) || "Get an exclusive offer";
    var body = (v.design && v.design.body) || "Enter your email below to claim your reward.";
    var cta = (v.design && v.design.ctaText) || "Get my offer";
    var fields = v.formFields || ["email"];
    var type = cfg.type || "FORM";

    var extraContent = "";
    if (type === "WHEEL" || type === "SCRATCH_CARD") {
      extraContent = renderWheel(v, headline, body);
    }

    var inputsHTML = fields.map(function (f) {
      var inputType = f === "email" ? "email" : "text";
      var placeholder = f.charAt(0).toUpperCase() + f.slice(1);
      return '<input type="' + inputType + '" name="' + f + '" placeholder="' + placeholder + '" required aria-label="' + placeholder + '">';
    }).join("");

    return (
      '<div id="asmos-overlay" role="dialog" aria-modal="true" aria-label="Special offer">' +
      '<div id="asmos-popup">' +
      '<button id="asmos-close" aria-label="Close">&times;</button>' +
      '<h2 id="asmos-headline">' + escHtml(headline) + "</h2>" +
      '<p id="asmos-body">' + escHtml(body) + "</p>" +
      extraContent +
      '<form id="asmos-form">' +
      inputsHTML +
      '<button type="submit" id="asmos-submit">' + escHtml(cta) + "</button>" +
      "</form>" +
      '<p id="asmos-consent">By submitting you agree to receive marketing emails. Unsubscribe anytime.</p>' +
      "</div>" +
      "</div>"
    );
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showPopup(cfg) {
    if (shown || document.getElementById("asmos-overlay")) return;
    shown = true;
    chosenVariant = pickVariant(cfg.variants, cfg.forcedVariantId);

    buildStyles();
    var container = document.createElement("div");
    container.innerHTML = buildPopupHTML(chosenVariant, cfg);
    document.body.appendChild(container.firstElementChild);

    postEvent(chosenVariant.id, "IMPRESSION");

    document.getElementById("asmos-close").addEventListener("click", closePopup);
    document.getElementById("asmos-overlay").addEventListener("click", function (e) {
      if (e.target && e.target.id === "asmos-overlay") closePopup();
    });
    document.getElementById("asmos-form").addEventListener("submit", handleSubmit);
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { closePopup(); document.removeEventListener("keydown", onKey); }
    });
  }

  function closePopup() {
    var el = document.getElementById("asmos-overlay");
    if (el) el.remove();
  }

  function handleSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var btn = document.getElementById("asmos-submit");
    var data = {};
    var inputs = form.querySelectorAll("input");
    for (var i = 0; i < inputs.length; i++) {
      data[inputs[i].name] = inputs[i].value;
    }

    btn.disabled = true;
    btn.textContent = "Submitting...";

    var leadUrl = API_BASE + "/api/widget/leads";
    fetch(leadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        variantId: chosenVariant.id,
        siteKey: SITE_KEY,
        fields: data,
        page: window.location.href,
      }),
    })
      .then(function () {
        postEvent(chosenVariant.id, "SUBMISSION");
        form.innerHTML = '<div id="asmos-success"><p>You\'re in! Check your inbox.</p></div>';
        setTimeout(closePopup, 2500);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = btn.getAttribute("data-cta") || "Get my offer";
      });
  }

  // ─── Triggers ─────────────────────────────────────────────────────────────
  function setupTriggers(cfg) {
    var trigger = cfg.trigger || "time_delay";
    var delay = typeof cfg.delaySeconds === "number" ? cfg.delaySeconds * 1000 : 5000;

    if (trigger === "exit_intent") {
      document.addEventListener("mouseleave", function onLeave(e) {
        if (e.clientY <= 0) {
          document.removeEventListener("mouseleave", onLeave);
          showPopup(cfg);
        }
      });
      // Mobile: fallback to time-delay at 10s
      setTimeout(function () { if (!shown) showPopup(cfg); }, Math.max(delay, 10000));
    } else if (trigger === "scroll_depth") {
      var threshold = 0.5;
      window.addEventListener("scroll", function onScroll() {
        var scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight;
        if (scrolled >= threshold) {
          window.removeEventListener("scroll", onScroll);
          showPopup(cfg);
        }
      });
    } else {
      // time_delay (default)
      setTimeout(function () { showPopup(cfg); }, delay);
    }
  }

  // ─── Session dedup ────────────────────────────────────────────────────────
  var SESSION_KEY = "asmos_seen_" + SITE_KEY;
  function alreadySeen() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function markSeen() {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) {}
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  function init() {
    if (alreadySeen()) return;
    fetchConfig().then(function (data) {
      if (!data || !data.campaign || !data.campaign.variants || !data.campaign.variants.length) return;
      markSeen();
      var cfg = Object.assign({}, data.campaign, {
        trigger: data.campaign.trigger || "time_delay",
        delaySeconds: data.campaign.delaySeconds || 5,
      });
      setupTriggers(cfg);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
