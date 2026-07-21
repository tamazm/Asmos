export type GeneratedReward = {
  label: string;
  type: "COUPON" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED" | "FREE_SHIPPING";
  couponCode: string | null;
  weight: number;
};

export type GeneratedCampaign = {
  name: string;
  type: "WHEEL" | "SCRATCH_CARD" | "FORM";
  design: {
    headline: string;
    body: string;
    primaryColor: string;
    ctaText: string;
  };
  formFields: string[];
  targeting: {
    trigger: "exit_intent" | "time_delay" | "scroll_depth";
    delaySeconds: number | null;
  };
  rewards: GeneratedReward[];
};

export const campaignSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short internal campaign name" },
    type: { type: "string", enum: ["WHEEL", "SCRATCH_CARD", "FORM"] },
    design: {
      type: "object",
      properties: {
        headline: { type: "string" },
        body: { type: "string" },
        primaryColor: {
          type: "string",
          description: "Hex color code, e.g. #6366f1",
        },
        ctaText: { type: "string" },
      },
      required: ["headline", "body", "primaryColor", "ctaText"],
      additionalProperties: false,
    },
    formFields: {
      type: "array",
      items: { type: "string", enum: ["name", "email", "phone"] },
    },
    targeting: {
      type: "object",
      properties: {
        trigger: {
          type: "string",
          enum: ["exit_intent", "time_delay", "scroll_depth"],
        },
        delaySeconds: { type: ["integer", "null"] },
      },
      required: ["trigger", "delaySeconds"],
      additionalProperties: false,
    },
    rewards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          type: {
            type: "string",
            enum: ["COUPON", "DISCOUNT_PERCENT", "DISCOUNT_FIXED", "FREE_SHIPPING"],
          },
          couponCode: { type: ["string", "null"] },
          weight: { type: "integer" },
        },
        required: ["label", "type", "couponCode", "weight"],
        additionalProperties: false,
      },
    },
  },
  required: ["name", "type", "design", "formFields", "targeting", "rewards"],
  additionalProperties: false,
} as const;
