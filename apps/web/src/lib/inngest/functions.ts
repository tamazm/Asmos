import { generateCampaign } from "./generateCampaign";
import { evaluateKnockout } from "./evaluateKnockout";
import { sweepStaleCampaigns } from "./sweepStaleCampaigns";
import { mineCrossAccountPatterns } from "./mineCrossAccountPatterns";
import { scrapePopupBatch } from "./scrapePopupBatch";

export const functions = [
  generateCampaign,
  evaluateKnockout,
  sweepStaleCampaigns,
  mineCrossAccountPatterns,
  scrapePopupBatch,
];
