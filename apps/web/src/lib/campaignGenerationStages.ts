/**
 * lib/campaignGenerationStages.ts
 *
 * Shared vocabulary for the fine-grained progress shown while a campaign's
 * status is GENERATING (Campaign.generationStage). Keeping the stage codes,
 * labels, and ordering in one place keeps the Inngest job (which writes them)
 * and the UI (which reads them) in sync.
 *
 * When generation fails, Campaign.generationStage is left untouched so the
 * UI can say *where* it failed (e.g. "Failed while: Structure is forming"),
 * which is the whole point of splitting "Generating…" into stages.
 */

export const CAMPAIGN_GENERATION_STAGES = [
  {
    code: "QUEUED",
    label: "Queued",
    description: "Waiting for a generation slot to open up…",
  },
  {
    code: "AI_THINKING",
    label: "AI is thinking",
    description: "Analyzing your brand, store, and past results to plan the popup…",
  },
  {
    code: "STRUCTURING",
    label: "Structure is forming",
    description: "Turning the AI's plan into headline, copy, layout, and variants…",
  },
  {
    code: "SAVING",
    label: "Saving your campaign",
    description: "Writing the campaign and variants to your account…",
  },
] as const;

export type CampaignGenerationStageCode = (typeof CAMPAIGN_GENERATION_STAGES)[number]["code"];

const STAGE_BY_CODE = new Map(CAMPAIGN_GENERATION_STAGES.map((s) => [s.code, s]));

export function getGenerationStageInfo(code: string | null | undefined) {
  if (!code) return null;
  return STAGE_BY_CODE.get(code as CampaignGenerationStageCode) ?? null;
}

export function getGenerationStageIndex(code: string | null | undefined): number {
  if (!code) return -1;
  return CAMPAIGN_GENERATION_STAGES.findIndex((s) => s.code === code);
}
