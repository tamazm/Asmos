import { prisma } from "@/lib/prisma";

// Safety net for campaigns stuck in GENERATING with no way out.
//
// generateCampaign (src/lib/inngest/generateCampaign.ts) has retries: 0 by
// design, and the call sites that fire the "campaign.generate" event
// (api/campaigns/route.ts, api/campaigns/[id]/route.ts retry, lib/account.ts)
// already catch a throwing inngest.send() and mark the campaign FAILED
// immediately. This sweeper catches the other failure mode: send() succeeds
// but the event is dropped or the function never finishes (misconfigured
// INNGEST_EVENT_KEY/SIGNING_KEY, app not synced with Inngest Cloud, or the
// serverless function got killed mid-run) — nothing updates the campaign and
// it sits in GENERATING forever with no visible error.
//
// Runs on a schedule (see vercel.json). Vercel Cron sends the same
// Authorization header as the insights cron; CRON_SECRET must be set.
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // generation's own maxDuration is 300s (5 min)

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const stale = await prisma.campaign.findMany({
    where: { status: "GENERATING", updatedAt: { lt: cutoff } },
    select: { id: true, name: true, accountId: true },
  });

  const swept: string[] = [];

  for (const campaign of stale) {
    try {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: "FAILED",
          lastError:
            "Generation timed out — the background job never completed. Please retry.",
        },
      });
      await prisma.systemLog
        .create({
          data: {
            level: "ERROR",
            accountId: campaign.accountId,
            message: `Campaign ${campaign.id} (${campaign.name}) stuck in GENERATING past ${
              STALE_THRESHOLD_MS / 60000
            } min — marked FAILED by stale-campaigns sweeper`,
          },
        })
        .catch(() => {});
      swept.push(campaign.id);
    } catch (err) {
      console.error(`[cron/stale-campaigns] failed to sweep campaign ${campaign.id}`, err);
    }
  }

  return Response.json({ swept: swept.length, campaignIds: swept });
}
