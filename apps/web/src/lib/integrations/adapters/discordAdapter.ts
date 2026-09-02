import type { IntegrationAdapter } from "../types";
import { postWebhook } from "./httpDelivery";
import { summarizeEvent } from "./summarizeEvent";

export const discordAdapter: IntegrationAdapter = {
  provider: "discord",
  kind: "webhook",
  async validate({ config }) {
    const url = typeof config.url === "string" ? config.url : "";
    return url.startsWith("https://") ? { ok: true } : { ok: false, error: "Discord webhook URL must start with https://" };
  },
  async deliver({ event, connection }) {
    const s = summarizeEvent(event);
    const content = `${s.emoji} **${s.title}**\n${s.lines.join("\n")}`;
    return postWebhook(String(connection.config.url ?? ""), { content });
  },
};
