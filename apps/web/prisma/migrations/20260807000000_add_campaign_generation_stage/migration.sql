-- AlterTable
-- Adds fine-grained progress tracking within status=GENERATING, so the UI can
-- show "AI is thinking", "Structure is forming", etc. instead of a single
-- generic "Generating…" state, and so a failure can be attributed to the
-- stage it happened in.
ALTER TABLE "Campaign" ADD COLUMN "generationStage" TEXT;
