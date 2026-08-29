import { inngest } from "./client";
import { resolveConnection, recordDelivery } from "../integrations/connections";
import { getAdapter } from "../integrations/registry";
import type { DeliveryResult, IntegrationEvent } from "../integrations/types";

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

  const result = await adapter.deliver({ event, connection });
  await recordDelivery(connectionId, event.event, result);

  if (result.status === "failed" && result.retriable) {
    throw new RetriableDeliveryError(result.detail ?? "retriable delivery failure");
  }
  return result;
}

// Delivers a single integration event to a single connection. Retries are
// classified by runDelivery itself (RetriableDeliveryError vs. a returned
// "failed" result) rather than left to Inngest's default retry-on-any-throw
// behavior, so permanent failures (bad auth, 4xx) don't burn retry budget.
export const deliverIntegration = inngest.createFunction(
  { id: "integration-deliver", triggers: { event: "integration/deliver" }, retries: 4 },
  async ({ event, step }) => {
    const { connectionId, event: domainEvent } = event.data as {
      connectionId: string;
      event: IntegrationEvent;
    };
    return step.run("deliver", () => runDelivery(connectionId, domainEvent));
  },
);
