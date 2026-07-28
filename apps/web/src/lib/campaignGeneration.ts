import type Anthropic from "@anthropic-ai/sdk";
import type { FunctionDeclaration } from "@google/genai";

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

const UPDATE_CAMPAIGN_DESCRIPTION =
  "Set the complete current campaign draft. Call this whenever you have enough information to propose or revise the full draft. Always pass the COMPLETE campaign object — every field representing the draft's current state — carrying forward anything the merchant hasn't asked to change.";

export const updateCampaignTool = {
  name: "update_campaign",
  description: UPDATE_CAMPAIGN_DESCRIPTION,
  input_schema: campaignSchema as unknown as Anthropic.Tool.InputSchema,
  strict: true,
};

// Temporary alternate provider for local testing — see lib/gemini.ts.
export const geminiUpdateCampaignDeclaration: FunctionDeclaration = {
  name: "update_campaign",
  description: UPDATE_CAMPAIGN_DESCRIPTION,
  parametersJsonSchema: campaignSchema,
};

// Used by the periodic AI insights report (lib/insights.ts) to propose a new
// variant worth testing, based on bandit performance data. Reuses the same
// design/formFields/targeting/rewards shapes as campaignSchema.
export type GeneratedVariantSuggestion = {
  name: string;
  rationale: string;
  design: GeneratedCampaign["design"];
  formFields: string[];
  targeting: GeneratedCampaign["targeting"];
  rewards: GeneratedReward[];
};

export const variantSuggestionSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short internal name for this proposed variant" },
    rationale: {
      type: "string",
      description: "One or two sentences on why this variant might outperform the current leader",
    },
    design: campaignSchema.properties.design,
    formFields: campaignSchema.properties.formFields,
    targeting: campaignSchema.properties.targeting,
    rewards: campaignSchema.properties.rewards,
  },
  required: ["name", "rationale", "design", "formFields", "targeting", "rewards"],
  additionalProperties: false,
} as const;

export const PROPOSE_VARIANT_DESCRIPTION =
  "Propose a new variant to test, based on the performance data provided. Only call this if you have a concrete, specific idea worth testing — it's fine to skip it and just give a summary if the data doesn't suggest one yet.";

export const proposeVariantTool = {
  name: "propose_variant",
  description: PROPOSE_VARIANT_DESCRIPTION,
  input_schema: variantSuggestionSchema as unknown as Anthropic.Tool.InputSchema,
  strict: true,
};

// Temporary alternate provider for local testing — see lib/gemini.ts.
export const geminiProposeVariantDeclaration: FunctionDeclaration = {
  name: "propose_variant",
  description: PROPOSE_VARIANT_DESCRIPTION,
  parametersJsonSchema: variantSuggestionSchema,
};
