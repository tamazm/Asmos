import { describe, it, expect } from "vitest";
import { renderTemplate, escapeHtml, buildTemplateVars } from "./template";
import type { IntegrationEvent } from "./types";

describe("renderTemplate", () => {
  it("substitutes known vars", () => {
    expect(renderTemplate("Hi {{lead.name}}", { "lead.name": "Jane" })).toBe("Hi Jane");
  });

  it("renders unknown vars as empty string", () => {
    expect(renderTemplate("Hi {{lead.age}}", {})).toBe("Hi ");
  });

  it("escapes HTML in substitution", () => {
    expect(renderTemplate("Hello {{lead.name}}", { "lead.name": "<script>" })).toBe("Hello &lt;script&gt;");
  });

  it("renders null/undefined as empty string", () => {
    expect(renderTemplate("Hi {{lead.name}}", { "lead.name": null })).toBe("Hi ");
  });

  it("handles multiple vars", () => {
    expect(
      renderTemplate("Hi {{lead.name}}, your code is {{reward.coupon_code}}", {
        "lead.name": "Jane",
        "reward.coupon_code": "DISCOUNT10",
      })
    ).toBe("Hi Jane, your code is DISCOUNT10");
  });
});

describe("escapeHtml", () => {
  it("escapes basic HTML characters", () => {
    expect(escapeHtml("<script>alert('x' & \"y\")</script>")).toBe(
      "&lt;script&gt;alert(&#039;x&#039; &amp; &quot;y&quot;)&lt;/script&gt;"
    );
  });
});

describe("buildTemplateVars", () => {
  it("produces correct map from lead.captured payload", () => {
    const event: IntegrationEvent = {
      event: "lead.captured",
      payload: {
        campaign_id: "c1",
        campaign_name: "My Campaign",
        variant_id: "v1",
        variant_name: "Control",
        lead: {
          id: "l1",
          email: "jane@example.com",
          name: "Jane",
          phone: "+1234567890",
          consent_given: true,
        },
        reward: {
          type: "COUPON",
          label: "10% Off",
          coupon_code: "DISCOUNT10",
        },
        timestamp: new Date().toISOString(),
      },
    };

    const vars = buildTemplateVars(event);
    expect(vars["lead.name"]).toBe("Jane");
    expect(vars["lead.email"]).toBe("jane@example.com");
    expect(vars["lead.phone"]).toBe("+1234567890");
    expect(vars["campaign.name"]).toBe("My Campaign");
    expect(vars["variant.name"]).toBe("Control");
    expect(vars["reward.label"]).toBe("10% Off");
    expect(vars["reward.coupon_code"]).toBe("DISCOUNT10");
  });

  it("produces correct map from variant.winner_declared payload", () => {
    const event: IntegrationEvent = {
      event: "variant.winner_declared",
      payload: {
        campaign_id: "c1",
        campaign_name: "My Campaign",
        winning_variant_id: "v2",
        winning_variant_name: "Variant B",
        timestamp: new Date().toISOString(),
      },
    };

    const vars = buildTemplateVars(event);
    expect(vars["campaign.name"]).toBe("My Campaign");
    expect(vars["variant.name"]).toBe("Variant B");
    expect(vars["lead.name"]).toBeUndefined();
  });
});
