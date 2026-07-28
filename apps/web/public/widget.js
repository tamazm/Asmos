(function () {
  var scriptEl = document.currentScript;
  if (!scriptEl) return;

  var site = scriptEl.getAttribute("data-site") || window.location.hostname;
  var apiBase = new URL(scriptEl.src).origin;
  var CONSENT_KEY = "asmos_consent";

  function post(path, body) {
    return fetch(apiBase + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(function () {});
  }

  function trackEvent(variantId, type) {
    post("/api/widget/events", { variantId: variantId, type: type });
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
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    var overlay = document.createElement("div");
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

      var payload = { variantId: variant.id, consentGiven: true };
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
    trackEvent(variant.id, "IMPRESSION");
  }

  function scheduleTrigger(campaign, variant) {
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

  fetch(apiBase + "/api/widget/config?site=" + encodeURIComponent(site))
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
