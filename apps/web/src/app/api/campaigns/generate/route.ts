import { auth } from "@clerk/nextjs/server";
import { anthropic } from "@/lib/anthropic";
import { campaignSchema, type GeneratedCampaign } from "@/lib/campaignGeneration";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt } = (await request.json()) as { prompt?: string };
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2000,
    system:
      "You design on-site popup marketing campaigns (spin-the-wheel, scratch card, or plain form) for e-commerce and SaaS businesses. Given a merchant's goal, produce a complete, ready-to-publish campaign configuration. Keep copy short and punchy, pick a campaign type that fits the goal, and make reward weights sum to a reasonable distribution for wheel/scratch types (a single reward with weight 1 is fine for plain forms).",
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: { type: "json_schema", schema: campaignSchema },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "Generation failed" }, { status: 502 });
  }

  const campaign = JSON.parse(textBlock.text) as GeneratedCampaign;
  return Response.json({ campaign });
}
