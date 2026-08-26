import { inngest } from "./client";
import { prisma } from "@/lib/prisma";

// Safety net for campaigns stuck in GENERATING with no way out.
//
// generateCampaign (./generateCampaign.ts) has retries: 0 by design, and the
// call sites that fire "campaign.generate" (api/campaigns/route.ts,
// api/campaigns/[id]/route.ts retry, lib/account.ts) already catch a
// throwing inngest.send() and mark the campaign FAILED immediately. This
// sweep catches the other failure mode: send() succeeds but the event is
// dropped or the function never finishes (misconfigured Inngest keys, app
// not synced, serverless function killed mid-run) - nothing updates the
// campaign and it sits in GENERATING forever with no visible error.
//
// Runs as an Inngest-scheduled cron rather than a Vercel Cron entry:
// Vercel's Hobby plan only allows once-a-day cron schedules, which is too
// coarse for this; Inngest's own scheduler isn't subject to that limit and
// just calls back into the existing /api/inngest route.
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // generation's own maxDuration is 300s (5 min)

export const sweepStaleCampaigns = inngest.createFunction(
  { id: "sweep-stale-campaigns", triggers: { cron: "*/30 * * * *" } },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

    const stale = await step.run("find-stale", async () => {
      return prisma.campaign.findMany({
        where: { status: "GENERATING", updatedAt: { lt: cutoff } },
        select: { id: true, name: true, accountId: true },
      });
    });

    if (stale.length === 0) {
      return { swept: 0, campaignIds: [] };
    }

    const swept = await step.run("mark-failed", async () => {
      const ids: string[] = [];
      for (const campaign of stale) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: "FAILED",
            lastError:
              "Generation timed out - the background job never completed. Please retry.",
          },
        });
        await prisma.systemLog
          .create({
            data: {
              level: "ERROR",
              accountId: campaign.accountId,
              message: `Campaign ${campaign.id} (${campaign.name}) stuck in GENERATING past ${
                STALE_THRESHOLD_MS / 60000
              } min - marked FAILED by sweep-stale-campaigns`,
            },
          })
          .catch(() => {});
        ids.push(campaign.id);
      }
      return ids;
    });

    return { swept: swept.length, campaignIds: swept };
  },
);
