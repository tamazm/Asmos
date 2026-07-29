import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic";
import { gemini, GEMINI_MODEL } from "@/lib/gemini";
import {
  proposeVariantTool,
  geminiProposeVariantDeclaration,
  type GeneratedVariantSuggestion,
} from "@/lib/campaignGeneration";

// Same provider priority as /api/campaigns/chat: real Claude if configured,
// else the temporary Gemini test path, else a canned mock so this is
// testable with nothing configured. Never mocks in production.
const HAS_ANTHROPIC_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const HAS_GEMINI_KEY = Boolean(process.env.GEMINI_API_KEY);
const MOCK_MODE = !HAS_ANTHROPIC_KEY && !HAS_GEMINI_KEY && process.env.NODE_ENV !== "production";

export type CampaignStatsForInsight = {
  campaignName: string;
  campaignType: string;
  variants: {
    id: string;
    name: string;
    isControl: boolean;
    trafficPercent: number;
    impressions: number;
    interactions: number;
    submissions: number;
    giftClaims: number;
    design: unknown;
  }[];
};

const SYSTEM_PROMPT =
  "You review popup marketing campaign performance data for a merchant and write a short, plain-English summary (2-4 sentences) of what's working and what isn't — the bandit already handles live traffic reallocation, so focus on explaining the pattern, not restating raw numbers. If the data clearly suggests a specific new variant worth testing (different copy, offer, or trigger), call propose_variant with a concrete, complete proposal. Don't propose a variant just to have one — skip it if there's too little data yet, or the current leader is already working well.";

function buildUserMessage(stats: CampaignStatsForInsight): string {
  return `Campaign: ${stats.campaignName} (${stats.campaignType})\n\nVariant performance:\n${JSON.stringify(stats.variants, null, 2)}`;
}

type InsightResult = { summary: string; suggestedVariant: GeneratedVariantSuggestion | null };

async function claudeInsight(stats: CampaignStatsForInsight): Promise<InsightResult> {
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [proposeVariantTool],
    messages: [{ role: "user", content: buildUserMessage(stats) }],
  });

  const summary = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "propose_variant",
  );

  const suggestedVariant = toolUse ? (toolUse.input as GeneratedVariantSuggestion) : null;

  return { summary: fallbackSummary(summary, suggestedVariant), suggestedVariant };
}

async function geminiInsight(stats: CampaignStatsForInsight): Promise<InsightResult> {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: buildUserMessage(stats) }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [geminiProposeVariantDeclaration] }],
    },
  });

  const summary = response.text ?? "";
  const call = response.functionCalls?.find((c) => c.name === "propose_variant");
  const suggestedVariant = call ? (call.args as GeneratedVariantSuggestion) : null;

  return { summary: fallbackSummary(summary, suggestedVariant), suggestedVariant };
}

// Both providers sometimes return only a tool call with no accompanying text
// (e.g. when the model considers the proposal self-explanatory).
function fallbackSummary(
  summary: string,
  suggestedVariant: GeneratedVariantSuggestion | null,
): string {
  if (summary) return summary;
  return suggestedVariant
    ? "Proposed a new variant to test — see below."
    : "No summary generated.";
}

function mockInsight(stats: CampaignStatsForInsight): InsightResult {
  return {
    summary: `[Mock mode — no API key set] "${stats.campaignName}" has ${stats.variants.length} variant(s) tracked so far. Add ANTHROPIC_API_KEY or GEMINI_API_KEY for a real analysis.`,
    suggestedVariant: null,
  };
}

export async function generateCampaignInsight(
  stats: CampaignStatsForInsight,
): Promise<InsightResult> {
  if (MOCK_MODE) return mockInsight(stats);
  if (HAS_ANTHROPIC_KEY) return claudeInsight(stats);

  // The Gemini path is a temporary local-testing fallback — never let it
  // substitute for Claude silently in production.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Campaign insights are not configured (missing ANTHROPIC_API_KEY).");
  }
  return geminiInsight(stats);
}

type CampaignForStats = {
  name: string;
  type: string;
  variants: {
    id: string;
    name: string;
    isControl: boolean;
    trafficPercent: number;
    design: unknown;
    events: { type: string }[];
  }[];
};

export function buildInsightStats(campaign: CampaignForStats): CampaignStatsForInsight {
  return {
    campaignName: campaign.name,
    campaignType: campaign.type,
    variants: campaign.variants.map((v) => ({
      id: v.id,
      name: v.name,
      isControl: v.isControl,
      trafficPercent: v.trafficPercent,
      impressions: v.events.filter((e) => e.type === "IMPRESSION").length,
      interactions: v.events.filter((e) => e.type === "INTERACTION").length,
      submissions: v.events.filter((e) => e.type === "SUBMISSION").length,
      giftClaims: v.events.filter((e) => e.type === "GIFT_CLAIMED").length,
      design: v.design,
    })),
  };
}
