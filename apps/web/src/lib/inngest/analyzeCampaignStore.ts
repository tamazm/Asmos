import type { Prisma } from ".prisma/client";
import { analyzeStore } from "@/app/api/analyze/route";
import { prisma } from "@/lib/prisma";

type StepRunner = {
  run<T>(id: string, callback: () => Promise<T>): Promise<T>;
};

/**
 * Enrich a newly created campaign with the same full store analysis used by
 * /api/analyze, but inside the durable generation workflow instead of before
 * the browser can navigate to the campaign page.
 */
export async function analyzeCampaignStore(
  step: StepRunner,
  campaignId: string,
  context: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!context || context.analysisPending !== true) return context;

  const storeUrl = typeof context.storeUrl === "string" ? context.storeUrl : null;
  if (!storeUrl) throw new Error("Missing store URL for background analysis");

  return step.run("analyze-store", async () => {
    await prisma.campaign
      .update({
        where: { id: campaignId },
        data: { generationStage: "ANALYZING" },
      })
      .catch((error) => {
        console.error(
          `[generateCampaign] failed to set stage=ANALYZING for campaign ${campaignId}:`,
          error,
        );
      });

    const startedAt = Date.now();
    const rawAnalysis = await analyzeStore(storeUrl);

    // The screenshot is useful to the analyzer's vision calls but not to popup
    // generation afterward. Keeping its base64 bytes out of Prisma and Inngest
    // step output prevents a large payload from slowing every replay.
    const analysisWithoutScreenshot = { ...rawAnalysis };
    delete analysisWithoutScreenshot.screenshotBase64;
    const serializableAnalysis = JSON.parse(
      JSON.stringify(analysisWithoutScreenshot),
    ) as Record<string, unknown>;
    const mergedContext = {
      ...serializableAnalysis,
      ...context,
      storeUrl,
      analysisPending: false,
    };

    const analyzedStoreName =
      typeof serializableAnalysis.storeName === "string"
        ? serializableAnalysis.storeName.trim()
        : "";
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        generationContext: mergedContext as Prisma.InputJsonValue,
        ...(context.autoName === true && analyzedStoreName
          ? { name: `${analyzedStoreName}: Email Capture` }
          : {}),
      },
    });

    console.info("[generateCampaign] store analysis completed", {
      campaignId,
      analysisMs: Date.now() - startedAt,
      source: serializableAnalysis.analysisSource ?? "unknown",
    });
    return mergedContext;
  });
}
