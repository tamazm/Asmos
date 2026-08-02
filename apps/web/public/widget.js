/* eslint-disable */
(function () {
  var scriptEl = document.currentScript;
  if (!scriptEl) return;

  var site = scriptEl.getAttribute("data-site") || window.location.hostname;
  var previewVariantId = scriptEl.getAttribute("data-preview-variant-id");
  var isPreview = scriptEl.getAttribute("data-preview") === "true";
  var apiBase = new URL(scriptEl.src).origin;
  var CONSENT_KEY = "asmos_consent";

  // ── Behavioral context collected at load time ───────────────────────────────
  var pageUrl = window.location.href;
  var referrer = document.referrer || "";
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

  // Track max scroll depth (0–100)
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

  // Build behavioral context payload to attach to every event
  function behavioralContext(extraProps) {
    var ctx = {
      pageUrl: pageUrl,
      referrer: referrer || undefined,
      utmSource: utmParams.utmSource,
      utmMedium: utmParams.utmMedium,
      utmCampaign: utmParams.utmCampaign,
      scrollDepthPct: maxScrollDepthPct,
      timeOnPageSeconds: Math.round((Date.now() - pageLoadTime) / 1000),
    };
    if (extraProps) {
      for (var k in extraProps) {
        if (Object.prototype.hasOwnProperty.call(extraProps, k)) {
          ctx[k] = extraProps[k];
        }
      }
    }
    return ctx;
  }

  function post(path, body) {
    return fetch(apiBase + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(function () {});
  }

  function trackEvent(variantId, type, extraContext) {
    var payload = Object.assign(
      { variantId: variantId, type: type },
      behavioralContext(extraContext)
    );
    post("/api/widget/events", payload);
  }

  function pickVariant(campaign) {
    if (campaign.forcedVariantId) {
      for (var f = 0; f < campaign.variants.length; f++) {
        if (campaign.variants[f].id === campaign.forcedVariantId) return campaign.variants[f];
      }
    }

    var storageKey = "asmos_variant_" + campaign.id;
    var storedId = localStorage.getItem(storageKey);
    if (storedId) {
      for (var s = 0; s < campaign.variants.length; s++) {
        if (campaign.variants[s].id === storedId) return campaign.variants[s];
      }
    }

    var total = campaign.variants.reduce(function (sum, v) {
      return sum + Math.max(v.trafficPercent, 0);
    }, 0);
    var roll = Math.random() * (total || campaign.variants.length);
    var chosen = campaign.variants[0];
    for (var i = 0; i < campaign.variants.length; i++) {
      var weight = total > 0 ? Math.max(campaign.variants[i].trafficPercent, 0) : 1;
      roll -= weight;
      if (roll <= 0) {
        chosen = campaign.variants[i];
        break;
      }
    }

    localStorage.setItem(storageKey, chosen.id);
    return chosen;
  }

  function showConsentBanner(consent, onAccept) {
    if (localStorage.getItem(CONSENT_KEY)) {
      if (localStorage.getItem(CONSENT_KEY) === "accepted") onAccept();
      return;
    }

    if (consent && consent.required === false) {
      onAccept();
      return;
    }

    var banner = document.createElement("div");
    banner.style.cssText =
      "position:fixed;bottom:0;left:0;right:0;z-index:2147483000;" +
      "background:#111827;color:#fff;padding:14px 20px;font-family:system-ui,sans-serif;" +
      "font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;";

    var text = document.createElement("span");
    text.textContent =
      (consent && consent.bannerText) ||
      "We use cookies to personalize your experience and show relevant offers.";
    banner.appendChild(text);

    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;flex-shrink:0;";

    var decline = document.createElement("button");
    decline.textContent = "Decline";
    decline.style.cssText =
      "background:transparent;border:1px solid #4b5563;color:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:13px;";
    decline.onclick = function () {
      localStorage.setItem(CONSENT_KEY, "declined");
      banner.remove();
    };

    var accept = document.createElement("button");
    accept.textContent = "Accept";
    accept.style.cssText =
      "background:#6366f1;border:none;color:#fff;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;font-weight:600;";
    accept.onclick = function () {
      localStorage.setItem(CONSENT_KEY, "accepted");
      banner.remove();
      onAccept();
    };

    actions.appendChild(decline);
    actions.appendChild(accept);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  function fieldLabel(field) {
    if (field === "email") return "Email address";
    if (field === "phone") return "Phone number";
    return "Name";
  }

  function fieldType(field) {
    if (field === "email") return "email";
    if (field === "phone") return "tel";
    return "text";
  }

  function showPopup(campaign, variant) {
    var sessionKey = "asmos_shown_" + campaign.id;
    if (!isPreview) {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "1");
    }

    // Record the exact moment the popup appeared for dismiss timing
    var popupShownAt = Date.now();

    if (variant.generatedCode) {
      // ─── NEW TEMPLATE ENGINE ────────────────────────────────────────────────
      window.__asmos_active_variant = variant;
      window.__asmos_api_base = apiBase;

      var container = document.createElement("div");
      container.id = "asmos-popup-container";
      container.innerHTML = variant.generatedCode;
      document.body.appendChild(container);

      // Execute embedded scripts (innerHTML does not run them automatically)
      var scripts = container.querySelectorAll("script");
      scripts.forEach(function(s) {
        var newScript = document.createElement("script");
        if (s.src) {
          newScript.src = s.src;
        } else {
          var code = s.textContent;
          // Force the popup to open if we are in preview mode, bypassing local storage limits
          if (isPreview) {
            code = code.replace(/if\s*\(\s*shouldShow\(\)\s*\)\s*openPopup\(\);/g, "openPopup();");
            // Also wipe the storage key just in case
            localStorage.removeItem("asmos_popup_last_seen");
          }
          newScript.textContent = code;
        }
        document.body.appendChild(newScript);
        s.remove();
      });

      var closeBtn = document.getElementById("asmos-close") || document.getElementById("popupClose") || container.querySelector(".popup-close");
      if (closeBtn) {
        closeBtn.onclick = function() {
          var dismissAfterMs = Date.now() - popupShownAt;
          trackEvent(variant.id, "DISMISSED", { dismissAfterMs: dismissAfterMs });
          container.remove();
        };
      }

      var form = document.getElementById("popupForm") || container.querySelector("form");
      var emailInput = document.getElementById("asmos-email-input") || document.getElementById("popupEmail");
      
      if (form && emailInput) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var submitBtn = form.querySelector("button[type='submit']") || document.getElementById("asmos-cta-btn");
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting…";
          }

          if (isPreview) {
            setTimeout(function() {
              alert("Preview: Email captured! (Code: " + (variant.popupSpec?.coupon_code || "N/A") + ")");
              container.remove();
            }, 500);
            return;
          }

          var payload = Object.assign(
            { variantId: variant.id, consentGiven: true, email: emailInput.value },
            behavioralContext()
          );

          fetch(apiBase + "/api/widget/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).then(function(res) {
            if (res.ok) {
              trackEvent(variant.id, "SUBMISSION");
              var step3 = document.querySelector('[data-step="3"]');
              if (step3) {
                document.querySelectorAll('.popup-step').forEach(function(s) { s.hidden = true; });
                step3.hidden = false;
              } else {
                container.remove();
              }
            }
          });
        });
      }

      var copyBtn = document.getElementById("popupCopy");
      if (copyBtn) {
        copyBtn.onclick = function() {
          var codeEl = document.getElementById("popupCodeValue");
          if (codeEl) navigator.clipboard.writeText(codeEl.textContent);
        };
      }

      trackEvent(variant.id, "IMPRESSION");
      return;
    }

    var overlay = document.createElement("div");
    overlay.setAttribute("data-asmos-popup", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,0.5);" +
      "display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;";

    var card = document.createElement("div");
    card.style.cssText =
      "background:#fff;border-radius:16px;padding:32px;max-width:380px;width:90%;" +
      "text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);";

    var close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");
    close.style.cssText =
      "position:absolute;top:8px;right:12px;background:none;border:none;font-size:22px;" +
      "cursor:pointer;color:#6b7280;line-height:1;";
    close.onclick = function () {
      // Fire DISMISSED event with how long the popup was visible
      var dismissAfterMs = Date.now() - popupShownAt;
      trackEvent(variant.id, "DISMISSED", { dismissAfterMs: dismissAfterMs });
      overlay.remove();
    };
    card.appendChild(close);

    var headline = document.createElement("h2");
    headline.textContent = variant.design.headline;
    headline.style.cssText =
      "margin:0 0 8px;font-size:20px;font-weight:700;color:" + variant.design.primaryColor + ";";
    card.appendChild(headline);

    var body = document.createElement("p");
    body.textContent = variant.design.body;
    body.style.cssText = "margin:0 0 16px;font-size:14px;color:#4b5563;";
    card.appendChild(body);

    if (
      (campaign.type === "WHEEL" || campaign.type === "SCRATCH_CARD") &&
      variant.rewards.length > 0
    ) {
      var teaser = document.createElement("p");
      teaser.textContent =
        "Up for grabs: " + variant.rewards.map(function (r) { return r.label; }).join(" · ");
      teaser.style.cssText = "margin:0 0 16px;font-size:12px;color:#6b7280;font-style:italic;";
      card.appendChild(teaser);
    }

    var form = document.createElement("form");
    form.style.cssText = "display:flex;flex-direction:column;gap:10px;";

    var inputs = {};
    var interacted = false;
    variant.formFields.forEach(function (field) {
      var input = document.createElement("input");
      input.type = fieldType(field);
      input.placeholder = fieldLabel(field);
      input.required = true;
      input.style.cssText =
        "padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;";
      input.addEventListener("focus", function () {
        if (!interacted) {
          interacted = true;
          trackEvent(variant.id, "INTERACTION");
        }
      });
      inputs[field] = input;
      form.appendChild(input);
    });

    var errorMsg = document.createElement("p");
    errorMsg.style.cssText = "margin:0;font-size:12px;color:#ef4444;display:none;";
    form.appendChild(errorMsg);

    var submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = variant.design.ctaText;
    submit.style.cssText =
      "margin-top:4px;padding:10px 16px;border:none;border-radius:8px;color:#fff;" +
      "font-size:14px;font-weight:600;cursor:pointer;background:" + variant.design.primaryColor + ";";
    form.appendChild(submit);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit.disabled = true;
      submit.textContent = "Submitting…";

      var payload = Object.assign(
        { variantId: variant.id, consentGiven: true },
        behavioralContext()
      );
      Object.keys(inputs).forEach(function (field) {
        payload[field] = inputs[field].value;
      });

      fetch(apiBase + "/api/widget/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("submit failed");
          return res.json();
        })
        .then(function (data) {
          // Also fire the SUBMISSION event with full behavioral context
          trackEvent(variant.id, "SUBMISSION");

          card.innerHTML = "";
          card.appendChild(close);
          var thanks = document.createElement("h2");
          thanks.textContent = data.reward ? "You're in!" : "Thanks!";
          thanks.style.cssText =
            "margin:0 0 8px;font-size:20px;font-weight:700;color:" + variant.design.primaryColor + ";";
          card.appendChild(thanks);
          if (data.reward) {
            var rewardText = document.createElement("p");
            rewardText.textContent = data.reward.couponCode
              ? data.reward.label + " — code: " + data.reward.couponCode
              : data.reward.label;
            rewardText.style.cssText = "margin:0;font-size:14px;color:#4b5563;";
            card.appendChild(rewardText);
          } else {
            var msg = document.createElement("p");
            msg.textContent = "We'll be in touch.";
            msg.style.cssText = "margin:0;font-size:14px;color:#4b5563;";
            card.appendChild(msg);
          }
        })
        .catch(function () {
          errorMsg.textContent = "Something went wrong — please try again.";
          errorMsg.style.display = "block";
          submit.disabled = false;
          submit.textContent = variant.design.ctaText;
        });
    });

    card.appendChild(form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Fire IMPRESSION with full behavioral context (time on page, scroll depth, UTMs)
    trackEvent(variant.id, "IMPRESSION");
  }

  function scheduleTrigger(campaign, variant) {
    if (isPreview) {
      showPopup(campaign, variant);
      return;
    }

    var targeting = variant.targeting || {};
    var trigger = targeting.trigger || "time_delay";

    if (trigger === "exit_intent") {
      document.addEventListener("mouseleave", function handler(e) {
        if (e.clientY <= 0) {
          document.removeEventListener("mouseleave", handler);
          showPopup(campaign, variant);
        }
      });
    } else if (trigger === "scroll_depth") {
      window.addEventListener("scroll", function handler() {
        var scrolled = window.scrollY + window.innerHeight;
        var full = document.documentElement.scrollHeight;
        if (full > 0 && scrolled / full >= 0.5) {
          window.removeEventListener("scroll", handler);
          showPopup(campaign, variant);
        }
      });
    } else {
      var delay = (targeting.delaySeconds || 5) * 1000;
      setTimeout(function () {
        showPopup(campaign, variant);
      }, delay);
    }
  }

  var configUrl = apiBase + "/api/widget/config?site=" + encodeURIComponent(site);
  if (previewVariantId) {
    configUrl += "&preview_variant_id=" + encodeURIComponent(previewVariantId);
  }
  if (isPreview) {
    configUrl += "&preview=true";
  }

  fetch(configUrl)
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      showConsentBanner(data.consent, function () {
        if (data.campaign) scheduleTrigger(data.campaign, pickVariant(data.campaign));
      });
    })
    .catch(function () {});
})();
