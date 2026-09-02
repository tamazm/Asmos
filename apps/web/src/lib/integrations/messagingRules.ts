import { prisma } from "../prisma";
import type { IntegrationEvent, IntegrationAdapter, ResolvedConnection, DeliveryResult } from "./types";
import { renderTemplate, buildTemplateVars } from "./template";

export interface MessagingRule {
  event: string;
  delayMinutes: number;
  templateId: string;
}

/** Parse and validate rules from connection.config.rules JSON. */
export function parseRules(raw: unknown): MessagingRule[] {
  if (!Array.isArray(raw)) return [];
  
  const rules: MessagingRule[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { event, delayMinutes, templateId } = item as any;
    if (
      typeof event === "string" &&
      typeof delayMinutes === "number" &&
      delayMinutes >= 0 &&
      delayMinutes <= 10080 && // 7 days max
      typeof templateId === "string"
    ) {
      rules.push({ event, delayMinutes, templateId });
    }
  }
  return rules;
}

/** Filter rules that match the incoming event. */
export function matchRules(rules: MessagingRule[], event: IntegrationEvent): MessagingRule[] {
  return rules.filter(r => r.event === event.event);
}

/** Load a template by ID, render it with event vars, return subject + body. */
export async function renderRule(
  rule: MessagingRule,
  event: IntegrationEvent,
): Promise<{ subject: string | null; body: string; channel: "email" | "sms" }> {
  const template = await prisma.messageTemplate.findUnique({
    where: { id: rule.templateId }
  });

  if (!template) {
    throw new Error(`Template not found: ${rule.templateId}`);
  }

  const vars = buildTemplateVars(event);
  
  const channel = template.channel as "email" | "sms";
  return {
    // Subjects are plain text; only the HTML email body should be escaped.
    subject: template.subject ? renderTemplate(template.subject, vars, false) : null,
    body: renderTemplate(template.body, vars, channel === "email"),
    channel,
  };
}

/** Execute a single rule: render template → call adapter.deliver. */
export async function executeRule(
  rule: MessagingRule,
  event: IntegrationEvent,
  connection: ResolvedConnection,
  adapter: IntegrationAdapter,
): Promise<DeliveryResult> {
  try {
    const rendered = await renderRule(rule, event);

    let to = "";
    if (event.event === "lead.captured") {
      to = rendered.channel === "sms" ? event.payload.lead.phone || "" : event.payload.lead.email || "";
    }
    
    if (!to) {
      return { status: "skipped", detail: `No ${rendered.channel} destination found in event payload` };
    }

    return await adapter.deliver({
      event,
      connection,
      renderedContent: {
        to,
        subject: rendered.subject,
        body: rendered.body,
      }
    });
  } catch (err: any) {
    return { status: "failed", detail: err.message, retriable: false };
  }
}
