import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsJson, corsPreflight } from "@/lib/cors";
import { recomputeCampaignAllocation } from "@/lib/bandit";

/** At most one knockout evaluation per campaign per window. */
const EVALUATION_INTERVAL_MS = 30 * 60 * 1000;

const VALID_TYPES = ["IMPRESSION", "INTERACTION", "SUBMISSION", "GIFT_CLAIMED", "DISMISSED"] as const;
type EventType = (typeof VALID_TYPES)[number];

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    variantId?: string;
    type?: string;
    // First-party per-visitor id, set by widget.js (localStorage) — lets us
    // correlate events from the same visitor and gives PostHog a real
    // distinct_id instead of one shared synthetic id per variant.
    visitorId?: string;
    // Behavioral context (optional)
    pageUrl?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    scrollDepthPct?: number;
    timeOnPageSeconds?: number;
    dismissAfterMs?: number;
    // Funnel step reached at the time of this event — a step number (e.g.
    // teaser -> capture) or a named milestone (e.g. "email_field_focus"),
    // set by the popup template's own script.
    step?: number | string;
    // ── Interaction telemetry (lib/templates/runtime.ts) ──
    // Sent once per popup view as step: "session_summary", plus on individual
    // milestone events. These are what let the generator distinguish "the
    // offer is weak" from "they could not find the email field" — impressions
    // and conversions alone cannot tell those two apart, which is why popup
    // improvements previously had nothing concrete to act on.
    deadClicks?: number;
    rageClicks?: number;
    fieldFocusCount?: number;
    timeToFirstKeystrokeMs?: number | null;
    typedChars?: number;
    abandonedField?: boolean;
    ctaHoverNoClickMs?: number;
    scrolledInside?: boolean;
    reachedStep?: number;
    converted?: boolean;
    msSinceOpen?: number;
    targetTag?: string;
  };

  const { variantId, type, visitorId } = body;

  if (!variantId || !type || !(VALID_TYPES as readonly string[]).includes(type)) {
    return corsJson({ error: "variantId and a valid type are required" }, { status: 400 });
  }

  const eventType = type as EventType;

  const details = {
    pageUrl: body.pageUrl,
    referrer: body.referrer,
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    scrollDepthPct: body.scrollDepthPct,
    timeOnPageSeconds: body.timeOnPageSeconds,
    dismissAfterMs: body.dismissAfterMs,
    step: body.step,
    deadClicks: body.deadClicks,
    rageClicks: body.rageClicks,
    fieldFocusCount: body.fieldFocusCount,
    timeToFirstKeystrokeMs: body.timeToFirstKeystrokeMs ?? undefined,
    typedChars: body.typedChars,
    abandonedField: body.abandonedField,
    ctaHoverNoClickMs: body.ctaHoverNoClickMs,
    scrolledInside: body.scrolledInside,
    reachedStep: body.reachedStep,
    converted: body.converted,
    msSinceOpen: body.msSinceOpen,
    targetTag: body.targetTag,
  };
  const hasDetails = Object.values(details).some((v) => v !== undefined);

  await prisma.campaignEvent.create({
    data: {
      variantId,
      type: eventType,
      visitorId: visitorId ?? undefined,
      details: hasDetails ? details : undefined,
    },
  });

  // Only these two event types feed the bandit — skip the recompute query on
  // INTERACTION/GIFT_CLAIMED/DISMISSED writes. Deferred via after() so a slow/failed
  // reallocation never delays or breaks the widget's event ack, and keeps
  // running after the response is sent instead of racing the function exit.
  if (eventType === "IMPRESSION" || eventType === "SUBMISSION") {
    after(async () => {
      try {
        await recomputeCampaignAllocation(variantId);
        
        // Evaluate the knockout bracket periodically.
        //
        // This used to run `count(*)` over every impression the campaign had
        // ever recorded, on every single impression, and fire when the total
        // was exactly divisible by 1000. Two concurrent requests could both
        // miss the boundary (never firing) or both hit it (firing twice), and
        // the full-table count was pure overhead on the hot path.
        //
        // Time-based instead: at most one evaluation per campaign per window,
        // decided by a single indexed read.
        if (eventType === "IMPRESSION") {
          const variant = await prisma.variant.findUnique({
            where: { id: variantId },
            select: { campaignId: true, campaign: { select: { lastEvaluatedAt: true } } },
          });
          const lastEvaluated = variant?.campaign?.lastEvaluatedAt?.getTime() ?? 0;
          if (variant && Date.now() - lastEvaluated > EVALUATION_INTERVAL_MS) {
            // Claim the window before dispatching, so a burst of concurrent
            // events produces one evaluation rather than one each.
            const claimed = await prisma.campaign.updateMany({
              where: {
                id: variant.campaignId,
                OR: [
                  { lastEvaluatedAt: null },
                  { lastEvaluatedAt: { lt: new Date(Date.now() - EVALUATION_INTERVAL_MS) } },
                ],
              },
              data: { lastEvaluatedAt: new Date() },
            });
            if (claimed.count > 0) {
              const { inngest } = await import("@/lib/inngest/client");
              await inngest.send({ name: "campaign.evaluate", data: { campaignId: variant.campaignId } });
            }
          }
        }
      } catch (err) {
        console.error("[bandit/inngest] background task failed", err);
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
      step,
    } = body;

    // Real per-visitor id when the widget sends one; fall back to the old
    // per-variant synthetic id so events from a not-yet-updated widget.js
    // don't get dropped or crash — just degrade to the old (broken) grouping.
    const distinctId = visitorId || `widget_visitor_${variantId}`;

    after(async () => {
      try {
        // Fetch the variant to enrich events with campaign context + popup generation metadata
        const variant = await prisma.variant.findUnique({
          where: { id: variantId },
          select: {
            name: true,
            campaignId: true,
            testAxis: true,
            hypothesis: true,
            motivatingMetric: true,
          },
        });

        // Map internal event types to schema-required asmos_popup_* names
        const asmosEventMap: Partial<Record<EventType, string>> = {
          IMPRESSION: "asmos_popup_shown",
          DISMISSED: "asmos_popup_dismissed",
          SUBMISSION: "asmos_popup_converted",
        };
        const asmosEventName = asmosEventMap[eventType];

        const sharedProperties = {
          // Attribution properties — required by the popup generation schema
          store_id: variant?.campaignId ? `campaign_${variant.campaignId}` : undefined,
          campaign_id: variant?.campaignId,
          popup_id: variant?.campaignId,   // popup_id == campaign_id in current schema
          variant_id: variantId,
          variant_name: variant?.name,
          test_axis: variant?.testAxis,
          hypothesis: variant?.hypothesis,
          motivating_metric: variant?.motivatingMetric,
          // Behavioral context
          page_url: pageUrl,
          referrer: referrer,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          scroll_depth_pct: scrollDepthPct,
          time_on_page_s: timeOnPageSeconds,
          dismiss_after_ms: dismissAfterMs,
          funnel_step: step,
          // Interaction telemetry, mirrored into PostHog so the same signals
          // are queryable there alongside session replay.
          dead_clicks: body.deadClicks,
          rage_clicks: body.rageClicks,
          field_focus_count: body.fieldFocusCount,
          time_to_first_keystroke_ms: body.timeToFirstKeystrokeMs,
          abandoned_field: body.abandonedField,
          cta_hover_no_click_ms: body.ctaHoverNoClickMs,
          reached_step: body.reachedStep,
          $current_url: pageUrl,
        };

        // Fire both: legacy widget_* name AND schema-required asmos_popup_* name
        const events = [
          {
            event: `widget_${eventType.toLowerCase()}`,
            distinct_id: distinctId,
            properties: sharedProperties,
          },
          // Only fire the asmos_* alias for the three canonical event types
          ...(asmosEventName
            ? [{
                event: asmosEventName,
                distinct_id: distinctId,
                properties: sharedProperties,
              }]
            : []),
        ];

        // Batch-send using PostHog's /batch/ endpoint to minimise round trips
        await fetch("https://eu.i.posthog.com/batch/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: posthogKey,
            batch: events,
          }),
        });
      } catch (err) {
        console.error("[posthog] widget event forwarding failed", err);
      }
    });
  }

  return corsJson({ ok: true });
}
