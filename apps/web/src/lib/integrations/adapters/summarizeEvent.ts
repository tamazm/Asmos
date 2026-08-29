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
    lines.push(`Email: ${p.lead.email ?? "—"}`);
    if (p.lead.phone) lines.push(`Phone: ${p.lead.phone}`);
    lines.push(`Campaign: ${p.campaign_name} · Variant: ${p.variant_name}`);
    if (p.reward?.coupon_code) lines.push(`Coupon: ${p.reward.coupon_code}`);
    return { emoji: "🎉", title: "New lead captured", lines };
  }
  const p = event.payload;
  return {
    emoji: "🏆",
    title: "Winner declared",
    lines: [`Campaign: ${p.campaign_name}`, `Winning variant: ${p.winning_variant_name}`],
  };
}
