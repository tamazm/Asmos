import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsJson, corsPreflight } from "@/lib/cors";
import { recomputeCampaignAllocation } from "@/lib/bandit";

const VALID_TYPES = ["IMPRESSION", "INTERACTION", "SUBMISSION", "GIFT_CLAIMED", "DISMISSED"] as const;
type EventType = (typeof VALID_TYPES)[number];

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    variantId?: string;
    type?: string;
    // Behavioral context (optional)
    pageUrl?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    scrollDepthPct?: number;
    timeOnPageSeconds?: number;
    dismissAfterMs?: number;
  };

  const { variantId, type } = body;

  if (!variantId || !type || !(VALID_TYPES as readonly string[]).includes(type)) {
    return corsJson({ error: "variantId and a valid type are required" }, { status: 400 });
  }

  const eventType = type as EventType;

  await prisma.campaignEvent.create({
    data: { variantId, type: eventType },
  });

  // Only these two event types feed the bandit — skip the recompute query on
  // INTERACTION/GIFT_CLAIMED/DISMISSED writes. Deferred via after() so a slow/failed
  // reallocation never delays or breaks the widget's event ack, and keeps
  // running after the response is sent instead of racing the function exit.
  if (eventType === "IMPRESSION" || eventType === "SUBMISSION") {
    after(async () => {
      try {
        await recomputeCampaignAllocation(variantId);
      } catch (err) {
        console.error("[bandit] allocation recompute failed", err);
      }
    });
  }

  // Forward behavioral context to PostHog as a fire-and-forget background task.
  // PostHog is the observability/explainability layer — not the bandit data source.
  // Skip silently if NEXT_PUBLIC_POSTHOG_KEY is not configured.
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    const {
      pageUrl,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      scrollDepthPct,
      timeOnPageSeconds,
      dismissAfterMs,
    } = body;

    after(async () => {
      try {
        // Fetch the variant to enrich events with campaign context
        const variant = await prisma.variant.findUnique({
          where: { id: variantId },
          select: { name: true, campaignId: true },
        });

        await fetch("https://eu.posthog.com/capture/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: posthogKey,
            event: `widget_${eventType.toLowerCase()}`,
            distinct_id: `widget_visitor_${variantId}`,
            properties: {
              campaign_id: variant?.campaignId,
              variant_id: variantId,
              variant_name: variant?.name,
              page_url: pageUrl,
              referrer: referrer,
              utm_source: utmSource,
              utm_medium: utmMedium,
              utm_campaign: utmCampaign,
              scroll_depth_pct: scrollDepthPct,
              time_on_page_s: timeOnPageSeconds,
              dismiss_after_ms: dismissAfterMs,
              $current_url: pageUrl,
            },
          }),
        });
      } catch (err) {
        console.error("[posthog] widget event forwarding failed", err);
      }
    });
  }

  return corsJson({ ok: true });
}
