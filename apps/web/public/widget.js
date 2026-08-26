/* eslint-disable */
(function () {
  // `document.currentScript` is null whenever the tag is injected
  // asynchronously — which is exactly what Google Tag Manager, Shopify's
  // script-tag API and every "load third-party scripts late" theme setting do.
  // The widget used to return here and no-op, silently, on all of them.
  var scriptEl =
    document.currentScript ||
    document.querySelector('script[data-asmos]') ||
    document.querySelector('script[src*="widget.js"]');
  if (!scriptEl) return;

  // Storage throws (not returns null) in Safari private mode and in any
  // third-party-blocked context. Every call site below goes through these, so a
  // blocked store gets a popup with no frequency capping rather than no popup.
  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function ssGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function ssSet(key, value) { try { sessionStorage.setItem(key, value); } catch (e) {} }

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
    var existing = lsGet(VISITOR_ID_KEY);
    if (existing) return existing;
    var id = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
    lsSet(VISITOR_ID_KEY, id);
    return id;
  }
  var visitorId = getVisitorId();

  // Device class, sent on every event.
  //
  // Two things depend on it. Exit-intent is a desktop-only gesture (mouseleave
  // never fires on touch), so a trigger test that does not know the device is
  // comparing desktop traffic against all traffic rather than one trigger
  // against another. And phone and desktop popups genuinely want different
  // designs, so a bandit that pools them averages that difference away.
  function deviceClass() {
    try {
      var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      var w = window.innerWidth || document.documentElement.clientWidth || 0;
      if (coarse && w < 768) return "mobile";
      if (coarse) return "tablet";
      return "desktop";
    } catch (e) { return "desktop"; }
  }
  var device = deviceClass();
  var supportsHover = (function () {
    try { return !!(window.matchMedia && window.matchMedia("(hover: hover)").matches); }
    catch (e) { return true; }
  })();

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
      device: device,
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
    // Preview surfaces (dashboard variant preview, /store-preview) render the
    // real widget against real variant ids. Writing events from them poisons
    // the numbers the bandit and the campaign dashboard are computed from —
    // it is why a variant could show "1 impression, 2 submissions (200%)"
    // without a single real visitor having seen it.
    if (isPreview) return;
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

    // A variant with no rendered code is a GENERATING placeholder. Serving one
    // dropped the visitor through to the legacy DOM builder, which rendered a
    // generic white card reading "Special Offer / Sign up for updates and
    // discounts" — un-branded, and counted as a real impression against a
    // variant that had no design at all.
    var eligible = campaign.variants.filter(function (v) {
      return v && (v.generatedCode || v.design);
    });
    if (eligible.length === 0) return null;

    // Sticky assignment, but re-randomised periodically.
    //
    // Holding an assignment forever while the bandit reallocates means arms
    // favoured early accumulate a returning-visitor cohort and arms promoted
    // later see mostly first-timers. Those populations convert differently, so
    // the arms are no longer being compared on the same traffic. Re-drawing on
    // a fixed cadence bounds how far the cohorts can drift apart.
    var ASSIGNMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    var storageKey = "asmos_variant_" + campaign.id;
    var stored = lsGet(storageKey);
    if (stored) {
      var parts = stored.split("|");
      var storedId = parts[0];
      var assignedAt = Number(parts[1] || 0);
      if (Date.now() - assignedAt < ASSIGNMENT_TTL_MS) {
        for (var s = 0; s < eligible.length; s++) {
          if (eligible[s].id === storedId) return eligible[s];
        }
      }
    }

    var total = eligible.reduce(function (sum, v) {
      return sum + Math.max(v.trafficPercent, 0);
    }, 0);
    var roll = Math.random() * (total || eligible.length);
    var chosen = eligible[0];
    for (var i = 0; i < eligible.length; i++) {
      var weight = total > 0 ? Math.max(eligible[i].trafficPercent, 0) : 1;
      roll -= weight;
      if (roll <= 0) {
        chosen = eligible[i];
        break;
      }
    }

    lsSet(storageKey, chosen.id + "|" + Date.now());
    return chosen;
  }

  // ── Webfonts ────────────────────────────────────────────────────────────────
  // Templates emit `@import url('https://fonts.googleapis.com/...')` at the top
  // of their inline <style>. That is the slowest delivery path available: the
  // browser must parse the popup's stylesheet, fetch the font CSS, parse that,
  // then fetch the WOFF2 — two serial round trips that only START once the
  // popup exists. With display=swap the popup then paints in the fallback face
  // and visibly re-renders, reflowing the headline at the exact moment of
  // maximum attention.
  //
  // Hoisting the import to a <link> in the document head moves both round trips
  // to config-resolution time, seconds before the popup opens. It also matters
  // for the shadow root below: @font-face inside a shadow root is not reliably
  // registered for the document's font set, whereas a head stylesheet always is.
  var IMPORT_RE = /@import\s+url\((['"]?)([^'")]+)\1\)\s*;?/g;

  function hoistFontImports(code) {
    var hrefs = [];
    var stripped = code.replace(IMPORT_RE, function (_m, _q, href) {
      hrefs.push(href);
      return "";
    });
    return { code: stripped, hrefs: hrefs };
  }

  var injectedFonts = {};
  function injectFontLinks(hrefs) {
    if (!hrefs.length) return;
    if (!injectedFonts.__preconnect) {
      injectedFonts.__preconnect = true;
      ["https://fonts.googleapis.com", "https://fonts.gstatic.com"].forEach(function (origin) {
        var pre = document.createElement("link");
        pre.rel = "preconnect";
        pre.href = origin;
        pre.crossOrigin = "anonymous";
        document.head.appendChild(pre);
      });
    }
    hrefs.forEach(function (href) {
      if (injectedFonts[href]) return;
      injectedFonts[href] = true;
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });
  }

  function showConsentBanner(consent, onAccept) {
    var stored = lsGet(CONSENT_KEY);
    if (stored) {
      if (stored === "accepted") onAccept();
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
      lsSet(CONSENT_KEY, "declined");
      banner.remove();
    };

    var accept = document.createElement("button");
    accept.textContent = "Accept";
    accept.style.cssText =
      "background:#6366f1;border:none;color:#fff;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;font-weight:600;";
    accept.onclick = function () {
      lsSet(CONSENT_KEY, "accepted");
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
      if (ssGet(sessionKey)) return;
      ssSet(sessionKey, "1");
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
      // The runtime needs to know which campaign it belongs to so its
      // suppression key can be namespaced — a single global key meant two
      // campaigns suppressed each other, and inside a tournament a visitor who
      // saw variant 1 could never see variant 2.
      window.__asmos_campaign_id = campaign.id;

      // ─── Shadow-root isolation ──────────────────────────────────────────────
      // Previously: container.innerHTML = code; document.body.appendChild(...).
      // That put the popup in the merchant's cascade, where an entirely ordinary
      // theme stylesheet overwrote it. Measured against a stock Shopify-style
      // theme, this alone forced every headline and every CTA to uppercase and
      // silently turned `button_shape: "pill"` into a rectangle via
      // `border-radius: 0 !important` — which also means the bandit was testing
      // a button-shape difference that did not exist on screen.
      //
      // `all: initial` on the host stops inheritance reaching in; the shadow
      // boundary stops the merchant's selectors (and their !important) from
      // matching anything inside.
      var hoisted = hoistFontImports(variant.generatedCode);
      injectFontLinks(hoisted.hrefs);

      var host = document.createElement("div");
      host.id = "asmos-popup-host";
      host.setAttribute("data-asmos-popup", "true");
      host.style.cssText = "all: initial; position: fixed; inset: 0 auto auto 0; z-index: 2147483000;";

      var root;
      if (host.attachShadow) {
        root = host.attachShadow({ mode: "open" });
      } else {
        // No shadow DOM (very old browser): fall back to the light DOM rather
        // than showing nothing. The popup will inherit merchant styles, which
        // is the pre-fix behaviour and still better than no popup.
        root = host;
      }

      // The host is a fixed 0x0 anchor; the overlay inside positions itself.
      // A reset inside the boundary so nothing depends on UA defaults either.
      var reset = document.createElement("style");
      reset.textContent =
        ":host{all:initial;position:fixed;z-index:2147483000;}" +
        "*,*::before,*::after{box-sizing:border-box;}" +
        "button,input,select,textarea{font:inherit;color:inherit;margin:0;}" +
        "h1,h2,h3,p{margin:0;font:inherit;text-transform:none;letter-spacing:normal;}" +
        ".visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;" +
        "clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;}";
      root.appendChild(reset);

      var container = document.createElement("div");
      container.innerHTML = hoisted.code;
      root.appendChild(container);

      document.body.appendChild(host);

      // Hand the runtime its own root. It used to call
      // document.getElementById('asmosPopupOverlay'), which cannot see across
      // the shadow boundary.
      window.__asmos_shadow_root = root;

      // Execute embedded scripts (innerHTML does not run them automatically).
      // They stay in the light DOM — a script element inside a shadow root does
      // not execute — and reach their own markup through __asmos_shadow_root.
      var scripts = container.querySelectorAll("script");
      Array.prototype.forEach.call(scripts, function (s) {
        var newScript = document.createElement("script");
        if (s.src) {
          newScript.src = s.src;
        } else {
          var code = s.textContent;
          // Force the popup to open if we are in preview mode, bypassing local storage limits
          if (isPreview) {
            code = code.replace(/if\s*\(\s*shouldShow\(\)\s*\)\s*openPopup\(\);/g, "openPopup();");
          }
          newScript.textContent = code;
        }
        document.body.appendChild(newScript);
        s.remove();
      });

      // NO IMPRESSION HERE. The runtime fires it from inside openPopup(), once
      // the popup is actually on screen. Firing it at injection time counted an
      // impression for every visitor the runtime's own suppression window then
      // silently declined to show — inflating the denominator by an amount
      // proportional to how long an arm had been winning, which is a negative
      // feedback loop bolted onto a system designed to have a positive one.
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

    function renderThanks(data) {
      card.innerHTML = "";
      card.appendChild(close);
      var thanks = document.createElement("h2");
      thanks.textContent = data && data.reward ? "You're in!" : "Thanks!";
      thanks.style.cssText =
        "margin:0 0 8px;font-size:20px;font-weight:700;color:" + primaryColor + ";";
      card.appendChild(thanks);
      var msg = document.createElement("p");
      msg.style.cssText = "margin:0;font-size:14px;color:#4b5563;";
      if (data && data.reward) {
        msg.textContent = data.reward.couponCode
          ? data.reward.label + " — code: " + data.reward.couponCode
          : data.reward.label;
      } else {
        msg.textContent = "We'll be in touch.";
      }
      card.appendChild(msg);
    }

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

      // Same reasoning as trackEvent above: a preview must never create a real
      // Lead row (or burn a coupon code out of the pool, or fire the
      // merchant's lead.captured webhook). Simulate the success state instead.
      if (isPreview) {
        renderThanks({ reward: null });
        return;
      }

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
          // No SUBMISSION event is fired from here on purpose: POST
          // /api/widget/leads already writes one server-side (see that route).
          // Firing it again from the client double-counted every conversion,
          // which is how a variant could report a >100% submission rate.
          renderThanks(data);
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
    var fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      showPopup(campaign, variant);
    }

    if (trigger === "exit_intent") {
      if (supportsHover) {
        document.addEventListener("mouseleave", function handler(e) {
          if (e.clientY <= 0) {
            document.removeEventListener("mouseleave", handler);
            fire();
          }
        });
      } else {
        // Mobile exit-intent.
        //
        // `mouseleave` never fires on a touch device, so an exit-intent arm was
        // effectively desktop-only while a time-delay arm served everyone. A
        // tournament comparing them was comparing desktop traffic against all
        // traffic, not one trigger against another — and desktop converts
        // differently from mobile on essentially every store.
        //
        // The closest honest equivalents on touch: a fast upward scroll back
        // toward the chrome (reaching for the address bar / back gesture), and
        // the page being hidden as the visitor leaves. Both are read-only
        // listeners; neither traps the visitor or blocks navigation.
        var lastY = window.scrollY;
        var lastT = Date.now();
        var settled = false;
        setTimeout(function () { settled = true; }, 3000); // ignore load-time scroll jitter

        window.addEventListener("scroll", function handler() {
          if (!settled) { lastY = window.scrollY; lastT = Date.now(); return; }
          var now = Date.now();
          var dy = window.scrollY - lastY;
          var dt = Math.max(1, now - lastT);
          var velocity = dy / dt; // px per ms; negative is upward
          lastY = window.scrollY;
          lastT = now;
          // Sharp upward flick while meaningfully down the page.
          if (velocity < -1.1 && window.scrollY > window.innerHeight * 0.5) {
            window.removeEventListener("scroll", handler);
            fire();
          }
        }, { passive: true });

        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "hidden" && settled) fire();
        });
      }
    } else if (trigger === "scroll_depth") {
      var threshold = typeof targeting.scrollDepthPercent === "number"
        ? Math.min(Math.max(targeting.scrollDepthPercent, 5), 95) / 100
        : 0.5;
      window.addEventListener("scroll", function handler() {
        var scrolled = window.scrollY + window.innerHeight;
        var full = document.documentElement.scrollHeight;
        if (full > 0 && scrolled / full >= threshold) {
          window.removeEventListener("scroll", handler);
          fire();
        }
      }, { passive: true });
    } else {
      // `|| 5` treated a deliberate delay_seconds of 0 as "no value" and
      // silently waited five seconds instead of firing immediately.
      var seconds = typeof targeting.delaySeconds === "number" && targeting.delaySeconds >= 0
        ? targeting.delaySeconds
        : 5;
      setTimeout(fire, seconds * 1000);
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
        if (!data.campaign) return;
        var variant = pickVariant(data.campaign);
        // pickVariant returns null when every variant is a GENERATING
        // placeholder with nothing to render. Showing nothing is correct;
        // showing the legacy "Special Offer" card was not.
        if (variant) scheduleTrigger(data.campaign, variant);
      });
    })
    .catch(function () {});
})();
