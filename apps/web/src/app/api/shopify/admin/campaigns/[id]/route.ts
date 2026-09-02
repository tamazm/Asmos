import { prisma } from "@/lib/prisma";
import { getEmbeddedAccount } from "@/lib/shopify/embeddedAuth";
import { emitIntegrationEvent } from "@/lib/integrations/emit";

// Embedded admin — manage one campaign (activate/pause + placement). Authed by
// the shop session (getEmbeddedAccount), NOT Clerk, like every /api/shopify/
// admin/* route. This is the "which popup shows, and where" control surface the
// merchant drives from inside the Shopify admin iframe (/shopify-admin).

// The trigger/page-targeting shape the storefront widget actually reads. It
// lives on each Variant's `targeting` JSON, identical across a campaign's
// variants (see public/widget/asmos-widget.js matchesPageTargeting/setupTriggers
// and generateCampaign.ts, which carries it through unchanged).
type PageMode = "all" | "include" | "exclude";
type Trigger = "time_delay" | "exit_intent" | "scroll_depth";

interface Placement {
  trigger: Trigger;
  delaySeconds: number;
  pages: { mode: PageMode; patterns: string[] };
}

const TRIGGERS: Trigger[] = ["time_delay", "exit_intent", "scroll_depth"];
const PAGE_MODES: PageMode[] = ["all", "include", "exclude"];

// Normalize whatever the client sent into a safe, widget-compatible Placement.
// Rejects nothing — clamps/defaults instead — so a merchant can't wedge a
// campaign into an unrenderable targeting state from the UI.
function normalizePlacement(raw: unknown): Placement {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const trigger = TRIGGERS.includes(r.trigger as Trigger) ? (r.trigger as Trigger) : "time_delay";

  let delaySeconds = Number(r.delaySeconds);
  if (!Number.isFinite(delaySeconds)) delaySeconds = 5;
  delaySeconds = Math.min(120, Math.max(0, Math.round(delaySeconds)));

  const pagesRaw = (r.pages && typeof r.pages === "object" ? r.pages : {}) as Record<string, unknown>;
  const mode = PAGE_MODES.includes(pagesRaw.mode as PageMode) ? (pagesRaw.mode as PageMode) : "all";
  const patterns = Array.isArray(pagesRaw.patterns)
    ? pagesRaw.patterns
        .map((p) => String(p).trim())
        .filter(Boolean)
        .slice(0, 100)
    : [];

  return { trigger, delaySeconds, pages: { mode, patterns } };
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/shopify/admin/campaigns/[id]">,
): Promise<Response> {
  const account = await getEmbeddedAccount(request);
  if (!account) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    select: { id: true, accountId: true, name: true, websiteId: true, status: true },
  });
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: "activate" | "pause";
    placement?: unknown;
  };

  // ── Placement (where/when it shows) ──────────────────────────────────────
  // Written to every ACTIVE variant so the widget's representative-variant read
  // is consistent no matter which arm an A/B split serves. Merged into existing
  // targeting so any non-placement keys already there survive.
  if (body.placement !== undefined) {
    const placement = normalizePlacement(body.placement);
    const variants = await prisma.variant.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, targeting: true },
    });
    await prisma.$transaction(
      variants.map((v: { id: string; targeting: unknown }) =>
        prisma.variant.update({
          where: { id: v.id },
          data: {
            targeting: {
              ...((v.targeting && typeof v.targeting === "object" ? v.targeting : {}) as object),
              trigger: placement.trigger,
              delaySeconds: placement.delaySeconds,
              pages: placement.pages,
            },
          },
        }),
      ),
    );
  }

  // ── Activate / pause (which popup shows) ─────────────────────────────────
  // The widget serves the most-recent ACTIVE campaign for the website, so
  // activation is exclusive: turning one on pauses every other live campaign on
  // the same store. Otherwise two ACTIVE campaigns would silently race and the
  // merchant couldn't predict which shopper-facing popup wins.
  let status = campaign.status;
  if (body.action === "activate") {
    if (campaign.status === "GENERATING" || campaign.status === "FAILED") {
      return Response.json(
        { error: "This popup is still generating — wait for it to finish before going live." },
        { status: 409 },
      );
    }
    await prisma.$transaction([
      prisma.campaign.updateMany({
        where: { websiteId: campaign.websiteId, status: "ACTIVE", id: { not: campaign.id } },
        data: { status: "PAUSED" },
      }),
      prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } }),
    ]);
    status = "ACTIVE";
    if (campaign.status !== "ACTIVE") {
      try {
        await emitIntegrationEvent(campaign.accountId, {
          event: "campaign.activated",
          payload: {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            changed_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error("[integrations] Shopify campaign.activated emit failed", err);
      }
    }
  } else if (body.action === "pause") {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
    status = "PAUSED";
    if (campaign.status !== "PAUSED") {
      try {
        await emitIntegrationEvent(campaign.accountId, {
          event: "campaign.paused",
          payload: {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            changed_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error("[integrations] Shopify campaign.paused emit failed", err);
      }
    }
  }

  return Response.json({ id: campaign.id, status });
}
