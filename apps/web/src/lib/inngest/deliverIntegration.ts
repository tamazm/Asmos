import { inngest } from "./client";
import { resolveConnection, recordDelivery } from "../integrations/connections";
import { getAdapter } from "../integrations/registry";
import type { DeliveryResult, IntegrationEvent } from "../integrations/types";
import { parseRules, matchRules, executeRule } from "../integrations/messagingRules";

/** Thrown to signal Inngest that it should retry this delivery. */
export class RetriableDeliveryError extends Error {}

/**
 * Core delivery logic, runtime-independent so it can be unit-tested.
 * Always records an IntegrationDelivery row. Throws RetriableDeliveryError
 * (after logging) when the failure is worth retrying.
 */
export async function runDelivery(connectionId: string, event: IntegrationEvent): Promise<DeliveryResult> {
  const connection = await resolveConnection(connectionId);
  if (!connection || !connection.enabled) {
    const result: DeliveryResult = { status: "skipped", detail: "connection missing or disabled" };
    await recordDelivery(connectionId, event.event, result);
    return result;
  }

  const adapter = getAdapter(connection.provider);
  if (!adapter) {
    const result: DeliveryResult = { status: "skipped", detail: `no adapter for ${connection.provider}` };
    await recordDelivery(connectionId, event.event, result);
    return result;
  }

  if (adapter.kind === "sync" || adapter.kind === "messaging") {
    if (event.event === "lead.captured") {
      const consent = event.payload.lead.consent_given;
      if (!consent) {
        const result: DeliveryResult = { status: "skipped", detail: "lead did not consent" };
        await recordDelivery(connectionId, event.event, result);
        return result;
      }
    }
  }

  const result = await adapter.deliver({ event, connection });
  await recordDelivery(connectionId, event.event, result);

  if (result.status === "failed" && result.retriable) {
    throw new RetriableDeliveryError(result.detail ?? "retriable delivery failure");
  }
  return result;
}

export const deliverIntegration = inngest.createFunction(
  { id: "integration-deliver", triggers: { event: "integration/deliver" }, retries: 4 },
  async ({ event, step }) => {
    const { connectionId, event: domainEvent } = event.data as {
      connectionId: string;
      event: IntegrationEvent;
    };
    // Resolve connection + adapter (shared setup step)
    const { connection, adapter } = await step.run("resolve", async () => {
      const conn = await resolveConnection(connectionId);
      if (!conn || !conn.enabled) return { connection: null, adapter: null };
      const adp = getAdapter(conn.provider);
      return { connection: conn, adapter: adp ? { kind: adp.kind, provider: adp.provider } : null };
    });
    if (!connection || !adapter) {
      return step.run("skip", () => runDelivery(connectionId, domainEvent));
    }
    // Consent check for sync/messaging
    if (adapter.kind === "sync" || adapter.kind === "messaging") {
      if (domainEvent.event === "lead.captured" && !domainEvent.payload.lead.consent_given) {
        return step.run("skip-no-consent", async () => {
          const result: DeliveryResult = { status: "skipped", detail: "lead did not consent" };
          await recordDelivery(connectionId, domainEvent.event, result);
          return result;
        });
      }
    }
    // Non-messaging: single delivery (existing behavior)
    if (adapter.kind !== "messaging") {
      return step.run("deliver", () => runDelivery(connectionId, domainEvent));
    }
    // Messaging: fan out per matching rule with durable delays
    const rules = await step.run("match-rules", async () => {
      const conn = await resolveConnection(connectionId);
      return matchRules(parseRules(conn?.config.rules), domainEvent);
    });
    for (const rule of rules) {
      if (rule.delayMinutes > 0) {
        await step.sleep(`wait-${rule.templateId}`, `${rule.delayMinutes}m`);
      }
      await step.run(`send-${rule.templateId}`, async () => {
        const conn = await resolveConnection(connectionId);
        if (!conn || !conn.enabled) {
          const r: DeliveryResult = { status: "skipped", detail: "connection disabled during delay" };
          await recordDelivery(connectionId, domainEvent.event, r);
          return r;
        }
        const adp = getAdapter(conn.provider)!;
        const result = await executeRule(rule, domainEvent, conn, adp);
        await recordDelivery(connectionId, domainEvent.event, result);
        if (result.status === "failed" && result.retriable) {
          throw new RetriableDeliveryError(result.detail ?? "retriable");
        }
        return result;
      });
    }
  },
);

