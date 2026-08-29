import { inngest } from "./client";
import { prisma } from "@/lib/prisma";

// Integration delivery rows are an audit trail, not durable state. Keep 30 days.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const pruneIntegrationDeliveries = inngest.createFunction(
  { id: "prune-integration-deliveries", triggers: { cron: "0 3 * * *" } },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const deleted = await step.run("delete-old", async () => {
      const res = await prisma.integrationDelivery.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      return res.count;
    });
    return { deleted };
  },
);
