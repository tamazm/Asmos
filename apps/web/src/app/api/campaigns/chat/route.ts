import { auth } from "@/lib/auth-adapter";
import type Anthropic from "@anthropic-ai/sdk";
import type { Content } from "@google/genai";
import { anthropic } from "@/lib/anthropic";
import { gemini, GEMINI_MODEL } from "@/lib/gemini";
import { getOrCreateAccount } from "@/lib/account";
import { industryFallbackColor } from "@/lib/popupGeneration";
import {
  updateCampaignTool,
  geminiUpdateCampaignDeclaration,
  type GeneratedCampaign,
} from "@/lib/campaignGeneration";

// Provider priority: real Claude if configured, else the temporary Gemini test
// path (see lib/gemini.ts), else a canned mock so the UI is testable with
// nothing configured at all. Never mocks in production.
const HAS_ANTHROPIC_KEY = Boolean(process.env.ANTHROPIC_API_KEY);
const HAS_GEMINI_KEY = Boolean(process.env.GEMINI_API_KEY);
const MOCK_MODE = !HAS_ANTHROPIC_KEY && !HAS_GEMINI_KEY && process.env.NODE_ENV !== "production";

const SYSTEM_PROMPT_BASE =
  "You help merchants design on-site popup marketing campaigns (spin-the-wheel, scratch card, or plain form) through a short conversation. Ask a quick clarifying question if the goal is unclear; otherwise propose a complete draft right away and refine it as the merchant reacts. Keep replies short and conversational — a sentence or two, not a report. Whenever you have enough information to propose or update the full draft, call update_campaign with the complete campaign object. Keep copy short and punchy, pick a campaign type that fits the goal, and make reward weights sum to a reasonable distribution for wheel/scratch types (a single reward with weight 1 is fine for plain forms).";

// account.brandColor is deliberately not used here — same reasoning as
// popupGeneration.ts's brandTokensFromAnalyzeResult: a merchant-set/stored
// account field, not something measured, and it was letting the same stale-
// value problem back in through this separate (wheel/scratch-card) chat
// generation path even after brandColor was removed from the main pipeline.
// Colour instead comes from a real scraped popup in the same industry.
async function buildSystemPrompt(account: { industry: string | null }) {
  const fallbackColor = await industryFallbackColor(account.industry ?? undefined);
  const contextLines = [
    account.industry ? `Merchant industry: ${account.industry}.` : null,
    `Use ${fallbackColor} as the design's primaryColor unless the merchant specifies a different color or asks for something else.`,
  ].filter(Boolean);
  return SYSTEM_PROMPT_BASE + (contextLines.length ? ` ${contextLines.join(" ")}` : "");
}

const MOCK_DRAFT: GeneratedCampaign = {
  name: "Spin & Save Popup",
  type: "WHEEL",
  design: {
    headline: "Spin to Win a Discount!",
    body: "Give the wheel a spin for an exclusive offer just for you.",
    primaryColor: "#165DFF",
    ctaText: "Spin Now",
  },
  formFields: ["email"],
  targeting: { trigger: "exit_intent", delaySeconds: null },
  rewards: [
    { label: "20% Off", type: "DISCOUNT_PERCENT", couponCode: null, weight: 3 },
    { label: "10% Off", type: "DISCOUNT_PERCENT", couponCode: null, weight: 2 },
    { label: "Free Shipping", type: "FREE_SHIPPING", couponCode: null, weight: 1 },
  ],
};

function mockChatTurn(history: unknown[], userMessage: string) {
  const isFirstTurn = history.length === 0;
  const assistantText = isFirstTurn
    ? `[Mock mode — no API key set] Here's a sample draft so you can try the flow. Add a real key to get actual AI-generated campaigns from "${userMessage}".`
    : `[Mock mode] Pretending I updated the draft for: "${userMessage}".`;

  return {
    provider: "mock" as const,
    history: [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantText },
    ],
    assistantText,
    campaign: MOCK_DRAFT,
  };
}

async function claudeTurn(history: Anthropic.MessageParam[], userMessage: string, system: string) {
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: userMessage }];

  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    system,
    tools: [updateCampaignTool],
    messages,
  });

  const assistantText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "update_campaign",
  );

  const campaign = toolUse ? (toolUse.input as GeneratedCampaign) : null;

  const updatedHistory: Anthropic.MessageParam[] = [
    ...messages,
    { role: "assistant", content: response.content },
  ];
  if (toolUse) {
    updatedHistory.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: "Draft updated." }],
    });
  }

  return {
    provider: "claude" as const,
    history: updatedHistory,
    assistantText: assistantText || (campaign ? "Updated the campaign draft." : "..."),
    campaign,
  };
}

async function geminiTurn(history: Content[], userMessage: string, system: string) {
  const chat = gemini.chats.create({
    model: GEMINI_MODEL,
    history,
    config: {
      systemInstruction: system,
      tools: [{ functionDeclarations: [geminiUpdateCampaignDeclaration] }],
    },
  });

  const response = await chat.sendMessage({ message: userMessage });

  const assistantText = response.text ?? "";
  const functionCall = response.functionCalls?.find((call) => call.name === "update_campaign");
  const campaign = functionCall ? (functionCall.args as GeneratedCampaign) : null;

  const updatedHistory = chat.getHistory();
  if (functionCall) {
    updatedHistory.push({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: functionCall.id,
            name: "update_campaign",
            response: { status: "ok" },
          },
        },
      ],
    });
  }

  return {
    provider: "gemini" as const,
    history: updatedHistory,
    assistantText: assistantText || (campaign ? "Updated the campaign draft." : "..."),
    campaign,
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { history, userMessage } = (await request.json()) as {
    history?: unknown[];
    userMessage?: string;
  };
  if (!userMessage || typeof userMessage !== "string" || userMessage.trim().length === 0) {
    return Response.json({ error: "userMessage is required" }, { status: 400 });
  }

  if (MOCK_MODE) {
    return Response.json(mockChatTurn(history ?? [], userMessage));
  }

  const account = await getOrCreateAccount();
  const system = await buildSystemPrompt(account);

  if (HAS_ANTHROPIC_KEY) {
    const result = await claudeTurn(
      (history ?? []) as Anthropic.MessageParam[],
      userMessage,
      system,
    );
    return Response.json(result);
  }

  const result = await geminiTurn((history ?? []) as Content[], userMessage, system);
  return Response.json(result);
}
