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

  // Persistent first-party per-visitor id (AI popup variation roadmap, Phase 0).
  // Used as the PostHog distinct_id so funnels/cohorts/replay actually work —
  // previously every visitor of a variant shared one synthetic id.
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
      // Storage unavailable (privacy mode, etc.) — fall back to a per-load id.
      return "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
    }
  }
  var visitorId = getVisitorId();

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
      visitorId: visitorId,
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

  // ── Optional rich session capture (AI popup variation roadmap, Phase 1) ──────
  // Loads posthog-js directly on the merchant's page — gives us autocapture,
  // rage-click/dead-click detection, and (if enabled server-side) session
  // replay, correlated to the same visitorId used for our own custom events.
  // Only ever called after consent is granted (see below). Best-effort: never
  // let a tracking failure break the popup itself.
  function loadPostHog(tracking) {
    if (!tracking || !tracking.posthogKey || window.posthog) return;
    try {
      /* eslint-disable */
      !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
      /* eslint-enable */

      window.posthog.init(tracking.posthogKey, {
        api_host: tracking.posthogHost,
        defaults: "2026-05-30",
        // Server-side kill switch (see /api/widget/config) — recording real
        // visitor sessions on merchant sites is opt-in, not automatic just
        // because a PostHog key is configured.
        disable_session_recording: !tracking.sessionRecordingEnabled,
        // Align with the visitorId already used for our own custom events
        // (see behavioralContext) so replay/autocapture data and our
        // asmos_popup_* events correlate to the same PostHog person.
        bootstrap: { distinctID: visitorId },
        loaded: function (ph) {
          try { ph.register({ asmos_site: site }); } catch (e) {}
        },
      });
    } catch (e) {
      // Tracking is best-effort — never let it break the popup itself.
    }
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

      // Templates own their own DOM (ids/classes vary by template — see
      // lib/templates/*.ts), so guessing selectors here is fragile and was
      // silently broken for the current split-screen template (its close
      // button, form, and email input ids never matched what this file was
      // looking for — DISMISSED never fired, and the submit handler below
      // never ran). Instead, expose tracking as globals and let each
      // template's own inline script call them for its own DOM events.
      // IMPRESSION and SUBMISSION-via-lead-capture are unambiguous regardless
      // of template, so they're still handled centrally here.
      window.__asmos_track_event = function (type, extraContext) {
        trackEvent(variant.id, type, extraContext);
      };
      window.__asmos_behavioral_context = behavioralContext;
      // Templates must check this before actually submitting a lead — preview
      // mode (dashboard variant preview) should simulate success, not create
      // real leads/events against real campaigns.
      window.__asmos_preview_mode = isPreview;

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

    var design = variant.design || {};
    var primaryColor = design.primaryColor || "#165DFF";
    
    var headline = document.createElement("h2");
    headline.textContent = design.headline || "Special Offer";
    headline.style.cssText =
      "margin:0 0 8px;font-size:20px;font-weight:700;color:" + primaryColor + ";";
    card.appendChild(headline);

    var body = document.createElement("p");
    body.textContent = design.body || "Sign up for updates and discounts.";
    body.style.cssText = "margin:0 0 16px;font-size:14px;color:#4b5563;";
    card.appendChild(body);

    var variantRewards = variant.rewards || [];
    if (
      (campaign.type === "WHEEL" || campaign.type === "SCRATCH_CARD") &&
      variantRewards.length > 0
    ) {
      var teaser = document.createElement("p");
      teaser.textContent =
        "Up for grabs: " + variantRewards.map(function (r) { return r.label; }).join(" · ");
      teaser.style.cssText = "margin:0 0 16px;font-size:12px;color:#6b7280;font-style:italic;";
      card.appendChild(teaser);
    }

    var form = document.createElement("form");
    form.style.cssText = "display:flex;flex-direction:column;gap:10px;";

    var inputs = {};
    var interacted = false;
    var formFields = variant.formFields || ["email"];
    formFields.forEach(function (field) {
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
    var ctaText = design.ctaText || "Submit";
    submit.textContent = ctaText;
    submit.style.cssText =
      "margin-top:4px;padding:10px 16px;border:none;border-radius:8px;color:#fff;" +
      "font-size:14px;font-weight:600;cursor:pointer;background:" + primaryColor + ";";
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
          submit.textContent = ctaText;
        });
    });

    card.appendChild(form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Fire IMPRESSION with full behavioral context (time on page, scroll depth, UTMs)
    trackEvent(variant.id, "IMPRESSION");
  }

  // Advanced targeting: show on every page (default), only on specific
  // pages, or every page except specific ones — set at campaign creation
  // (see NewCampaignForm.tsx's "Where should this show" question) and
  // carried through unchanged into variant.targeting.pages by
  // generateCampaign.ts / evaluateKnockout.ts. Supports exact path match
  // ("/", "/contact") and a trailing "*" prefix wildcard ("/product/*").
  function matchesPageTargeting(pages) {
    if (!pages || pages.mode === "all" || !Array.isArray(pages.patterns) || pages.patterns.length === 0) {
      return true;
    }
    var path = window.location.pathname;
    var matched = pages.patterns.some(function (p) {
      if (!p) return false;
      if (p === "/") return path === "/";
      if (p.charAt(p.length - 1) === "*") return path.indexOf(p.slice(0, -1)) === 0;
      return path === p || path === p.replace(/\/$/, "");
    });
    return pages.mode === "include" ? matched : !matched;
  }

  function scheduleTrigger(campaign, variant) {
    if (isPreview) {
      showPopup(campaign, variant);
      return;
    }

    var targeting = variant.targeting || {};
    if (!matchesPageTargeting(targeting.pages)) return;
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
        if (data.tracking) loadPostHog(data.tracking);
        if (data.campaign) scheduleTrigger(data.campaign, pickVariant(data.campaign));
      });
    })
    .catch(function () {});
})();
