-- Adds ARCHIVED as a soft-delete status for Campaign - see the DELETE
-- handler in app/api/campaigns/[id]/route.ts and the enum comment in
-- schema.prisma. Deleting a campaign now archives it (hides it, stops it
-- being served) instead of a hard row delete whenever it has real history
-- (captured leads or recorded events) that a hard delete would cascade away.

-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'ARCHIVED';
