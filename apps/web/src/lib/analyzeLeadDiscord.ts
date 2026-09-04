type Finding = { label: string; headline: string };

export type AnalyzeLeadDiscordInput = {
  leadId: string;
  email: string;
  storeUrl: string;
  storeName: string | null;
  industry: string | null;
  score: number | null;
  grade: string | null;
  gradeLabel: string | null;
  topIssue: string | null;
  topFindings: Finding[];
  origin: string;
  capturedAt: Date | string;
};

const DISCORD_WEBHOOK_PREFIX = "https://discord.com/api/webhooks/";

// TODO: Configure ANALYZE_LEAD_DISCORD_WEBHOOK_URL in production, rotate this
// webhook, and remove the temporary hardcoded fallback from source control.
const TEMPORARY_ANALYZE_LEAD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1545548959534284862/GkiMVYAYKITHd4dXu0TMRq8Cwv18ZyjM0hJiw8OQP1KbINyglTYp6xi7ofIS5XyTiClV";

function escapeDiscord(value: string, maxLength = 1024): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+\-.!|>~])/g, "\\$1")
    .trim();
  if (!escaped) return "—";
  return escaped.length <= maxLength ? escaped : `${escaped.slice(0, maxLength - 1)}…`;
}

function safeEmbedUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function buildAnalyzeLeadDiscordPayload(input: AnalyzeLeadDiscordInput) {
  const score = input.score === null ? "Not available" : `${input.score}/100`;
  const grade = [input.grade, input.gradeLabel].filter(Boolean).join(" — ") || "Not available";
  const findings = input.topFindings
    .slice(0, 3)
    .map((finding) => `**${escapeDiscord(finding.label, 120)}:** ${escapeDiscord(finding.headline, 700)}`)
    .join("\n");

  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "📈 New Asmos Analyze Lead",
        url: safeEmbedUrl(input.storeUrl),
        color: 0x6366f1,
        description: input.topIssue
          ? `**Top opportunity**\n${escapeDiscord(input.topIssue, 900)}`
          : "A visitor requested their store analysis report.",
        fields: [
          {
            name: "Contact",
            value: `**Email:** ${escapeDiscord(input.email)}\n**Lead ID:** ${escapeDiscord(input.leadId)}`,
            inline: true,
          },
          {
            name: "Analysis",
            value: `**Score:** ${escapeDiscord(score)}\n**Grade:** ${escapeDiscord(grade)}`,
            inline: true,
          },
          {
            name: "Store",
            value: `**Name:** ${escapeDiscord(input.storeName ?? "Not available")}\n**URL:** ${escapeDiscord(input.storeUrl)}\n**Industry:** ${escapeDiscord(input.industry ?? "Not available")}`,
            inline: false,
          },
          ...(findings
            ? [{ name: "Top findings", value: findings, inline: false }]
            : []),
          {
            name: "Request origin",
            value: escapeDiscord(input.origin),
            inline: false,
          },
        ],
        footer: { text: "Asmos lead capture" },
        timestamp: new Date(input.capturedAt).toISOString(),
      },
    ],
  };
}

export async function sendAnalyzeLeadToDiscord(input: AnalyzeLeadDiscordInput): Promise<boolean> {
  const webhookUrl =
    process.env.ANALYZE_LEAD_DISCORD_WEBHOOK_URL || TEMPORARY_ANALYZE_LEAD_WEBHOOK_URL;
  if (!webhookUrl.startsWith(DISCORD_WEBHOOK_PREFIX)) {
    throw new Error("ANALYZE_LEAD_DISCORD_WEBHOOK_URL is not a Discord webhook URL");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildAnalyzeLeadDiscordPayload(input)),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Discord lead webhook failed with status ${response.status}`);
  }
  return true;
}
