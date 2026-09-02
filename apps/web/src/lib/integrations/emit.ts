import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import type { IntegrationEvent } from "./types";

/**
 * Fan a domain event out to every enabled connection subscribed to it.
 * Only enqueues Inngest jobs — never performs delivery inline, so it never
 * adds latency to the request that produced the event.
 */
export async function emitIntegrationEvent(accountId: string, event: IntegrationEvent): Promise<void> {
  const connections = await prisma.integrationConnection.findMany({
    where: { accountId, enabled: true, subscribedEvents: { has: event.event } },
    select: { id: true },
  });
  if (connections.length === 0) return;

  await inngest.send(
    connections.map((c: { id: string }) => ({ name: "integration/deliver", data: { connectionId: c.id, event } })),
  );
}
