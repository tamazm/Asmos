/**
 * Shared cookie/privacy-consent classification for both Browserless scrapers.
 *
 * The exported classifier takes a serialisable snapshot so it can be tested
 * without a browser DOM. COOKIE_CONSENT_RUNTIME implements the same rules in
 * the target page and is injected into each Browserless function body.
 */

export type CookieConsentSnapshot = {
  identity?: string;
  attributes?: string;
  text?: string;
  buttonTexts?: string[];
};

const VENDOR_PATTERN =
  "onetrust|optanon|cookiebot|cybotcookiebot|cookieyes|cky(?:-|_)|shopify-pc|shopify_privacy|shopify-privacy|osano|trustarc|truste|quantcast|cookielaw|termly|iubenda|didomi|usercentrics|cmpbox|termsfeed|cookieconsent|civiccookie|consentmanager|cookie-script|cookiepro";

const ATTRIBUTE_PATTERN =
  "(?:data|aria)[-_][^=\\s]*(?:cookie|consent|privacy|gdpr|ccpa)|(?:cookie|consent|privacy|gdpr|ccpa)[-_](?:banner|dialog|modal|notice|preferences|manager)";

const STRONG_LANGUAGE_PATTERN =
  "we (?:use|value) cookies|this (?:site|website) uses cookies|cookie (?:policy|notice|settings|preferences)|manage (?:your )?(?:cookie|privacy) preferences|privacy (?:choices|preferences)|do not sell or share my personal information|your privacy choices|gdpr|ccpa";

const CONSENT_ACTION_PATTERN =
  "accept(?: all)?(?: cookies)?|allow all|agree|reject(?: all)?(?: cookies)?|decline(?: all)?|deny(?: all)?|necessary only|essential only|manage (?:cookies|preferences|options)|customi[sz]e(?: settings)?|save (?:my )?(?:choices|preferences)|do not sell";

function normalise(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().replace(/\s+/g, " ").trim() : "";
}

/** Conservative: privacy links in newsletter copy alone are not consent UI. */
export function isCookieConsentSnapshot(snapshot: CookieConsentSnapshot): boolean {
  const identity = normalise(snapshot.identity);
  const attributes = normalise(snapshot.attributes);
  const text = normalise(snapshot.text).slice(0, 2000);
  const buttons = (snapshot.buttonTexts ?? []).map(normalise).filter(Boolean).join(" | ");

  if (new RegExp(VENDOR_PATTERN, "i").test(`${identity} ${attributes}`)) return true;
  if (new RegExp(ATTRIBUTE_PATTERN, "i").test(`${identity} ${attributes}`)) return true;

  const hasConsentSubject = /\bcookies?\b|\bprivacy\b|\btracking\b|\bpersonal (?:data|information)\b|\bgdpr\b|\bccpa\b/i.test(text);
  const hasStrongLanguage = new RegExp(STRONG_LANGUAGE_PATTERN, "i").test(text);
  const hasConsentAction = new RegExp(CONSENT_ACTION_PATTERN, "i").test(buttons);
  return hasConsentSubject && (hasStrongLanguage || hasConsentAction);
}

/**
 * Defence at the persistence boundary in case a remote browser returns stale
 * or unexpected data. Screenshots are deliberately included in the rejected
 * payload by the caller rather than inspected (they have no searchable text).
 */
export function looksLikeCookieConsentPayload(parts: Array<string | null | undefined>): boolean {
  const joined = parts.filter((part): part is string => typeof part === "string").join(" ");
  return isCookieConsentSnapshot({ identity: joined, attributes: joined, text: joined, buttonTexts: [joined] });
}

// Dependency-free browser-context helpers. Keep the regex sources above as
// the single source of truth; String.raw preserves the backslashes when this
// code is embedded in another template literal.
export const COOKIE_CONSENT_RUNTIME = String.raw`
  const AS_COOKIE_VENDOR_RE = new RegExp(${JSON.stringify(VENDOR_PATTERN)}, "i");
  const AS_COOKIE_ATTRIBUTE_RE = new RegExp(${JSON.stringify(ATTRIBUTE_PATTERN)}, "i");
  const AS_COOKIE_LANGUAGE_RE = new RegExp(${JSON.stringify(STRONG_LANGUAGE_PATTERN)}, "i");
  const AS_COOKIE_ACTION_RE = new RegExp(${JSON.stringify(CONSENT_ACTION_PATTERN)}, "i");

  const asVisible = (el, minSize = 1) => {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width >= minSize && rect.height >= minSize &&
      style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
  };

  const asConsentSnapshot = (el) => {
    const attributes = [...(el.attributes || [])]
      .map((attr) => attr.name + "=" + attr.value)
      .join(" ")
      .toLowerCase();
    const buttonTexts = [...el.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], a")]
      .map((button) => (button.innerText || button.value || button.getAttribute("aria-label") || "").trim().toLowerCase())
      .filter(Boolean);
    return {
      identity: ((typeof el.className === "string" ? el.className : "") + " " + (el.id || "") + " " + el.tagName).toLowerCase(),
      attributes,
      text: (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase().slice(0, 2000),
      buttonTexts,
    };
  };

  const asIsCookieNotice = (el) => {
    const snapshot = asConsentSnapshot(el);
    if (AS_COOKIE_VENDOR_RE.test(snapshot.identity + " " + snapshot.attributes)) return true;
    if (AS_COOKIE_ATTRIBUTE_RE.test(snapshot.identity + " " + snapshot.attributes)) return true;
    const hasSubject = /\\bcookies?\\b|\\bprivacy\\b|\\btracking\\b|\\bpersonal (?:data|information)\\b|\\bgdpr\\b|\\bccpa\\b/i.test(snapshot.text);
    const hasLanguage = AS_COOKIE_LANGUAGE_RE.test(snapshot.text);
    const hasAction = snapshot.buttonTexts.some((text) => AS_COOKIE_ACTION_RE.test(text));
    return hasSubject && (hasLanguage || hasAction);
  };

  const asConsentRoots = () => {
    const selector = [
      "#onetrust-banner-sdk", "#onetrust-consent-sdk", "[class*='onetrust' i]", "[id*='optanon' i]",
      "#CybotCookiebotDialog", "[id*='Cookiebot' i]", "[class*='cookiebot' i]",
      "[class*='cookieyes' i]", "[class*='cky-' i]", "[id*='cky-' i]",
      "[class*='shopify-pc' i]", "[id*='shopify-pc' i]", "[data-shopify-privacy]",
      "[class*='cookie-consent' i]", "[id*='cookie-consent' i]", "[class*='cookie-banner' i]", "[id*='cookie-banner' i]",
      "[class*='privacy-banner' i]", "[id*='privacy-banner' i]", "[data-cookie-consent]", "[data-consent-manager]",
      "[data-gdpr]", "[data-ccpa]", "[aria-label*='cookie' i]", "[aria-label*='consent' i]", "[aria-label*='privacy' i]",
      "[class*='cookie' i]", "[id*='cookie' i]", "[class*='consent' i]", "[id*='consent' i]",
      "[class*='privacy' i]", "[id*='privacy' i]", "dialog", "[role='dialog']", "[aria-modal='true']"
    ].join(", ");
    const candidates = [...document.querySelectorAll(selector)]
      .filter((el) => asVisible(el) && asIsCookieNotice(el))
      .sort((a, b) => {
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      });
    return candidates.filter((el, index) => !candidates.slice(0, index).some((parent) => parent.contains(el)));
  };

  const asDismissCookieNotices = () => {
    let dismissed = 0;
    for (const root of asConsentRoots()) {
      const controls = [...root.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], a")]
        .filter((el) => asVisible(el));
      const label = (el) => (el.innerText || el.value || el.getAttribute("aria-label") || el.title || "").replace(/\\s+/g, " ").trim();
      const preferred = [
        /^accept all(?: cookies)?$/i, /^allow all$/i, /^accept$/i, /^agree$/i, /^ok(?:ay)?$/i, /^got it$/i,
        /^reject all(?: cookies)?$/i, /^decline(?: all)?$/i, /^necessary only$/i, /^essential only$/i,
        /^close$/i, /^dismiss$/i
      ];
      let control = null;
      for (const pattern of preferred) {
        control = controls.find((candidate) => pattern.test(label(candidate))) || null;
        if (control) break;
      }
      if (control) {
        control.click();
        dismissed++;
      } else {
        root.style.setProperty("display", "none", "important");
        root.setAttribute("aria-hidden", "true");
        dismissed++;
      }
    }
    return dismissed;
  };
`.trim();
