import { describe, expect, it } from "vitest";
import { isCookieConsentSnapshot } from "./cookieConsent";
import { normalizePopupScrapeResult, POPUP_SCRAPE_FN } from "./popupScraping";
import { DOM_EXTRACTION_FN } from "./storeExtraction";

describe("cookie consent detection", () => {
  it.each([
    {
      vendor: "OneTrust",
      snapshot: {
        identity: "DIV onetrust-banner-sdk",
        attributes: "id=onetrust-banner-sdk role=dialog",
        text: "We use cookies to improve your experience.",
        buttonTexts: ["Accept All Cookies", "Reject All"],
      },
    },
    {
      vendor: "Cookiebot",
      snapshot: {
        identity: "DIV CybotCookiebotDialog",
        attributes: "id=CybotCookiebotDialog aria-describedby=CookiebotWidget",
        text: "This website uses cookies.",
        buttonTexts: ["Allow all", "Use necessary cookies only"],
      },
    },
    {
      vendor: "CookieYes",
      snapshot: {
        identity: "DIV cky-consent-container",
        attributes: "class=cky-consent-container data-cky-tag=notice",
        text: "We value your privacy.",
        buttonTexts: ["Accept All", "Reject All", "Customize"],
      },
    },
    {
      vendor: "Shopify consent",
      snapshot: {
        identity: "DIV shopify-pc__banner__dialog",
        attributes: "data-shopify-privacy=true role=dialog",
        text: "Your privacy is important to us.",
        buttonTexts: ["Accept", "Decline"],
      },
    },
    {
      vendor: "custom cookie dialog",
      snapshot: {
        identity: "DIV preferences-modal",
        attributes: "role=dialog aria-modal=true",
        text: "We use cookies and similar tracking technologies to improve your experience.",
        buttonTexts: ["Accept all cookies", "Necessary only", "Manage preferences"],
      },
    },
    {
      vendor: "custom CCPA dialog",
      snapshot: {
        identity: "SECTION choices-panel",
        attributes: "role=dialog",
        text: "Your privacy choices. Do not sell or share my personal information.",
        buttonTexts: ["Save my choices"],
      },
    },
  ])("detects $vendor", ({ snapshot }) => {
    expect(isCookieConsentSnapshot(snapshot)).toBe(true);
  });

  it("does not mistake newsletter privacy fine print for consent", () => {
    expect(isCookieConsentSnapshot({
      identity: "newsletter-popup",
      attributes: "role=dialog aria-modal=true",
      text: "Get 10% off. By signing up, you agree to our privacy policy.",
      buttonTexts: ["Get my discount"],
    })).toBe(false);
  });
});

describe("popup result persistence guard", () => {
  it("clears consent HTML, screenshot, and styles and records no popup", () => {
    const result = normalizePopupScrapeResult({
      present: true,
      selector: "onetrust-banner-sdk",
      html: '<div id="onetrust-banner-sdk"><button>Accept All Cookies</button></div>',
      screenshot: "cookie-image-base64",
      design: {
        headline: "We use cookies",
        ctaText: "Accept All Cookies",
        backgroundColor: "#ffffff",
        accentColor: "#111111",
      },
      industrySignal: "Example shop",
    });

    expect(result.present).toBe(false);
    expect(result.selector).toBeNull();
    expect(result.html).toBeNull();
    expect(result.screenshot).toBeNull();
    expect(result.design.backgroundColor).toBeNull();
    expect(result.design.accentColor).toBeNull();
  });

  it("never turns a normal page screenshot into a popup", () => {
    const result = normalizePopupScrapeResult({
      present: true,
      screenshot: "ordinary-page-base64",
      design: { palette: [{ hex: "#123456", areaShare: 1 }] },
    });

    expect(result.present).toBe(false);
    expect(result.screenshot).toBeNull();
    expect(result.design.palette).toEqual([]);
  });

  it("preserves a real marketing popup", () => {
    const result = normalizePopupScrapeResult({
      present: true,
      selector: "newsletter-popup",
      html: '<div class="newsletter-popup"><h2>Get 10% off</h2><button>Shop now</button></div>',
      screenshot: "popup-base64",
      design: { headline: "Get 10% off", ctaText: "Shop now" },
    });

    expect(result.present).toBe(true);
    expect(result.screenshot).toBe("popup-base64");
  });
});

describe("Browserless popup search order", () => {
  it.each([
    ["superadmin scraper", POPUP_SCRAPE_FN],
    ["store analyzer", DOM_EXTRACTION_FN],
  ])("dismisses consent before delayed, scroll, and exit searches in the %s", (_name, source) => {
    const dismiss = source.indexOf("await dismissCookieNotices();");
    const scroll = source.indexOf("window.scrollTo");
    const exit = source.indexOf('new MouseEvent("mouseout"');

    expect(dismiss).toBeGreaterThan(-1);
    expect(scroll).toBeGreaterThan(dismiss);
    expect(exit).toBeGreaterThan(scroll);
    expect(source).toContain("asIsCookieNotice");
  });
});
