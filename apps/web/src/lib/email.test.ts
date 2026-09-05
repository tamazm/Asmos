import { describe, expect, it } from "vitest";
import { renderReportEmail } from "./email";

describe("renderReportEmail", () => {
  it("renders a branded, actionable report with the sign-up CTA", () => {
    const email = renderReportEmail({
      to: "owner@example.com",
      storeName: "Northstar Supply",
      storeUrl: "https://northstar.example",
      score: 61,
      grade: "C-",
      gradeLabel: "Below average",
      topIssue: "No social proof was detected near the primary action.",
      auditSignals: [
        { key: "socialProof", found: false, description: "No visible ratings or customer reviews were detected." },
        { key: "urgency", found: false, description: "None detected" },
        { key: "popup", found: true, description: "Popup detected" },
      ],
    });

    expect(email.subject).toBe("Northstar Supply scored 61/100: your priority CRO review");
    expect(email.html).toContain("Move proof closer to the decision");
    expect(email.html).toContain("Recommended test:");
    expect(email.html).toContain("Implementation tip:");
    expect(email.html).toContain('href="https://app.asmos.io/sign-up"');
    expect(email.text).toContain("Start building with Asmos: https://app.asmos.io/sign-up");
  });

  it("escapes storefront and scan content before rendering HTML", () => {
    const email = renderReportEmail({
      to: "owner@example.com",
      storeName: '<img src=x onerror="alert(1)">',
      storeUrl: "https://safe.example",
      auditSignals: [
        { key: "popup", found: false, description: "<script>alert(1)</script>" },
      ],
    });

    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).not.toContain('<img src=x onerror="alert(1)">');
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("provides clearly labeled optimization tests when no gaps are reported", () => {
    const email = renderReportEmail({
      to: "owner@example.com",
      storeName: "Complete Store",
      storeUrl: "https://complete.example",
      auditSignals: [
        { key: "popup", found: true, description: "Popup detected" },
        { key: "socialProof", found: true, description: "Reviews detected" },
      ],
    });

    expect(email.html).toContain("recommended optimization test, not a failed automated check");
    expect(email.html).toContain("Judge lift by completed outcomes");
  });
});
