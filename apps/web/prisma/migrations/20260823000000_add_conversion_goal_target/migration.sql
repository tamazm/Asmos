-- Conversion-goal target for the dashboard Conversion Goal card.
-- targetCvr is percentage points (30 = 30%), not a 0-1 fraction.
ALTER TABLE "Account" ADD COLUMN "targetCvr" DOUBLE PRECISION;
ALTER TABLE "Account" ADD COLUMN "goalTargetAt" TIMESTAMP(3);
