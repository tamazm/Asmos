import { stitch } from "@google/stitch-sdk";
import { inngest } from "./client";
import { prisma } from "@/lib/prisma";

/**
 * lib/inngest/generateStitchDesign.ts
 *
 * Generates one AI design mockup (Google Stitch) for a merchant's free-text
 * prompt. This is a design *reference* only - see StitchDesign's model
 * comment in schema.prisma. Never writes to Variant.generatedCode/popupSpec,
 * never touches lib/templates/runtime.ts's live-serving contract.
 *
 * Mirrors generateCampaign.ts's shape: terminal on failure (retries: 0) with
 * an explicit Retry button in the UI, rather than silent auto-retry.
 *
 * The whole Stitch SDK call chain (createProject → generate → getHtml/
 * getImage) lives in a single step.run rather than being split across
 * several: Inngest step outputs are memoized/serialized between steps, and
 * there's no way to rehydrate the SDK's Project/Screen objects from just an
 * id across a step boundary. Real measured duration is 90-180s, which fits
 * inside the client's checkpointing.maxRuntime and the Inngest route's
 * maxDuration=300 - no infra changes needed, that budget already exists for
 * slow AI calls (see client.ts).
 *
 * Uses the `stitch` singleton (reads STITCH_API_KEY from the environment)
 * rather than constructing a client by hand - the SDK's `Stitch` class
 * constructor takes an already-authenticated StitchToolClient, not a plain
 * { apiKey } object, so the singleton is the documented, correct entry point.
 */
export const generateStitchDesign = inngest.createFunction(
  { id: "generate-stitch-design", triggers: { event: "stitch.design.generate" }, retries: 0 },
  async ({ event, step }) => {
    const { stitchDesignId } = event.data;

    const design = await step.run("fetch-design", async () => {
      return prisma.stitchDesign.findUnique({
        where: { id: stitchDesignId, status: "QUEUED" },
        include: { variant: { select: { campaign: { select: { accountId: true } } } } },
      });
    });

    if (!design) return { message: "Skipping" };

    await prisma.stitchDesign.update({
      where: { id: design.id },
      data: { status: "GENERATING" },
    }).catch((err) => {
      // Non-fatal - a missed status update shouldn't abort generation itself.
      console.error(`[generateStitchDesign] failed to mark GENERATING for ${design.id}:`, err);
    });

    try {
      const { projectId, screenId, htmlUrl, imageUrl } = await step.run("stitch-generate", async () => {
        if (!process.env.STITCH_API_KEY) throw new Error("STITCH_API_KEY is not set");

        const project = await stitch.createProject(`Asmos - ${design.id}`);
        const screen = await project.generate(
          design.prompt,
          design.deviceType as "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC",
        );
        const htmlUrl = await screen.getHtml();
        const imageUrl = await screen.getImage();

        return { projectId: project.id, screenId: screen.id, htmlUrl, imageUrl };
      });

      await step.run("persist-design", async () => {
        const [htmlRes, imageRes] = await Promise.all([fetch(htmlUrl), fetch(imageUrl)]);
        if (!htmlRes.ok) throw new Error(`Failed to fetch Stitch HTML: ${htmlRes.status}`);
        if (!imageRes.ok) throw new Error(`Failed to fetch Stitch image: ${imageRes.status}`);

        const htmlContent = await htmlRes.text();
        const imageContentType = imageRes.headers.get("content-type") ?? "image/png";
        const imageData = Buffer.from(await imageRes.arrayBuffer());

        await prisma.$transaction([
          prisma.stitchDesign.update({
            where: { id: design.id },
            data: {
              status: "COMPLETE",
              stitchProjectId: projectId,
              stitchScreenId: screenId,
              stitchHtmlUrl: htmlUrl,
              stitchImageUrl: imageUrl,
              htmlContent,
              imageData,
              imageContentType,
              lastError: null,
            },
          }),
          // Costs real money like any other AI call - counts against the same
          // AI_GENERATION_LIMITS budget as campaign/knockout generation.
          prisma.account.update({
            where: { id: design.variant.campaign.accountId },
            data: { aiGenerationsCount: { increment: 1 } },
          }),
        ]);
      });

      return { message: "Stitch design generated" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Design generation failed for an unknown reason";
      console.error(`[generateStitchDesign] design ${design.id} failed:`, err);
      await prisma.systemLog.create({
        data: {
          level: "ERROR",
          message: `Stitch design generation failed: ${message}`,
          details: err instanceof Error ? String(err.stack ?? message) : message,
        },
      }).catch(() => {});
      await prisma.stitchDesign.update({
        where: { id: design.id },
        data: { status: "FAILED", lastError: message },
      });
      return { message: "Design generation failed", error: message };
    }
  },
);
