import { prisma } from "../prisma";
import { parseRules, type MessagingRule } from "./messagingRules";

export async function getRules(connectionId: string): Promise<MessagingRule[]> {
  const conn = await prisma.integrationConnection.findUnique({
    where: { id: connectionId }
  });
  if (!conn) return [];
  return parseRules(conn.rules);
}

export async function saveRules(connectionId: string, rules: MessagingRule[]): Promise<void> {
  // Validate rule payload
  for (const r of rules) {
    if (r.delayMinutes < 0 || r.delayMinutes > 10080) {
      throw new Error(`Invalid delayMinutes: ${r.delayMinutes}`);
    }
    if (r.event !== "lead.captured" && r.event !== "variant.winner_declared") {
      throw new Error(`Invalid event: ${r.event}`);
    }
    const template = await prisma.messageTemplate.findUnique({
      where: { id: r.templateId }
    });
    if (!template || template.connectionId !== connectionId) {
      throw new Error(`Invalid templateId: ${r.templateId}`);
    }
  }

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      rules: rules as any,
    }
  });
}
