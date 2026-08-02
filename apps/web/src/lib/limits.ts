import { PlanTier } from ".prisma/client";

export const AI_GENERATION_LIMITS: Record<PlanTier, number> = {
  FREE: 3,
  STARTER: 10,
  GROWTH: 50,
  SCALE: 250,
};
