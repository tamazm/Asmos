import type { IntegrationEvent } from "../types";

export interface EventSummary {
  emoji: string;
  title: string;
  lines: string[];
}

export function summarizeEvent(event: IntegrationEvent): EventSummary {
  if (event.event === "lead.captured") {
    const p = event.payload;
    const lines: string[] = [];
    if (p.lead.name) lines.push(`Name: ${p.lead.name}`);
    lines.push(`Email: ${p.lead.email ?? "\u2014"}`);
    if (p.lead.phone) lines.push(`Phone: ${p.lead.phone}`);
    lines.push(`Campaign: ${p.campaign_name} \u00b7 Variant: ${p.variant_name}`);
    if (p.reward?.coupon_code) lines.push(`Coupon: ${p.reward.coupon_code}`);
    return { emoji: "\uD83C\uDF89", title: "New lead captured", lines };
  }

  if (event.event === "variant.winner_declared") {
    const p = event.payload;
    return {
      emoji: "\uD83C\uDFC6",
      title: "Winner declared",
      lines: [`Campaign: ${p.campaign_name}`, `Winning variant: ${p.winning_variant_name}`],
    };
  }

  const p = event.payload;
  return {
    emoji: event.event === "campaign.activated" ? "\uD83D\uDE80" : "\u23F8\uFE0F",
    title: event.event === "campaign.activated" ? "Campaign went live" : "Campaign paused",
    lines: [`Campaign: ${p.campaign_name}`],
  };
}
