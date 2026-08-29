import type { IntegrationAdapter } from "../types";
import { postWebhook } from "./httpDelivery";
import { summarizeEvent } from "./summarizeEvent";

export const teamsAdapter: IntegrationAdapter = {
  provider: "teams",
  kind: "webhook",
  async validate({ config }) {
    const url = typeof config.url === "string" ? config.url : "";
    return url.startsWith("https://") ? { ok: true } : { ok: false, error: "Teams webhook URL must start with https://" };
  },
  async deliver({ event, connection }) {
    const s = summarizeEvent(event);
    const body = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      summary: s.title,
      themeColor: "6366F1",
      title: `${s.emoji} ${s.title}`,
      text: s.lines.join("  \n"),
    };
    return postWebhook(String(connection.config.url ?? ""), body);
  },
};
