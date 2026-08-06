import { generateCampaign } from "./generateCampaign";
import { evaluateKnockout } from "./evaluateKnockout";
import { sweepStaleCampaigns } from "./sweepStaleCampaigns";

export const functions = [
  generateCampaign,
  evaluateKnockout,
  sweepStaleCampaigns
];
