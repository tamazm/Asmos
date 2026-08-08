-- AlterTable
-- AI popup variation roadmap, Phase 0 (data integrity): capture a real
-- per-visitor id and flexible behavioral context (scroll depth, dismiss
-- timing, funnel step reached, referrer/UTMs) on every CampaignEvent instead
-- of only forwarding it to PostHog and discarding it locally.
ALTER TABLE "CampaignEvent" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "CampaignEvent" ADD COLUMN "details" JSONB;

-- CreateIndex
CREATE INDEX "CampaignEvent_visitorId_idx" ON "CampaignEvent"("visitorId");
