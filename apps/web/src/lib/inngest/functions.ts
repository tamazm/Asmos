import { generateCampaign } from "./generateCampaign";
import { evaluateKnockout } from "./evaluateKnockout";
import { sweepStaleCampaigns } from "./sweepStaleCampaigns";
import { mineCrossAccountPatterns } from "./mineCrossAccountPatterns";
import { scrapePopupBatch } from "./scrapePopupBatch";
import { shopifyOrderPaid, shopifyCustomerCreated } from "./shopifyWebhooks";
import { deliverIntegration } from "./deliverIntegration";
import { pruneIntegrationDeliveries } from "./pruneIntegrationDeliveries";

export const functions = [
  generateCampaign,
  evaluateKnockout,
  sweepStaleCampaigns,
  mineCrossAccountPatterns,
  scrapePopupBatch,
  shopifyOrderPaid,
  shopifyCustomerCreated,
  deliverIntegration,
  pruneIntegrationDeliveries,
];
