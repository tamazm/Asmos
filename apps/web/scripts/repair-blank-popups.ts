// One-time repair for the "popup renders with no text" bug.
//
// resolveFlow() in lib/templates/runtime.ts computed the opening step from the
// campaign goal alone:
//
//   const startingStep = g === "DISCOUNT" ? 3 : hasTeaser ? 1 : g === "BOTH" ? 1 : 2;
//
// For a goal="BOTH" popup whose DNA said step_flow: "one_step", hasTeaser is
// false, so no `data-step="1"` section is rendered at all - but startingStep
// was still 1, so the capture and reveal sections both kept their `hidden`
// attribute. `.popup-step[hidden] { display: none !important }` then did
// exactly what it says. The result shipped to merchants as an empty card or an
// empty full-screen gradient with nothing in it but a close button: 100%
// impressions, 0% conversions, and no way for a visitor to submit anything.
//
// Variant.generatedCode is a *snapshot* taken at generation time, so fixing
// resolveFlow only helps popups generated from now on. This script re-renders
// generatedCode from each Variant's stored popupSpec using the fixed renderer,
// which repairs already-live variants without regenerating them through the
// model (same copy, same DNA, same template - only the markup is rebuilt).
//
// DRY RUN BY DEFAULT - prints what it would change and writes nothing.
//
// Usage (from apps/web/):
//   npx tsx scripts/repair-blank-popups.ts             # dry run
//   npx tsx scripts/repair-blank-popups.ts --apply     # actually applies it
//   npx tsx scripts/repair-blank-popups.ts --all       # re-render every variant,
//                                                      # not just the broken ones
//
// Safe against production: it only ever writes Variant.generatedCode, and only
// for variants that still have the popupSpec it was originally rendered from.

import { prisma } from "../src/lib/prisma";
import { renderPopupTemplate } from "../src/lib/templates";
import { normalizeDna, type PopupDna } from "../src/lib/popupDna";
import { resolveFlow } from "../src/lib/templates/runtime";

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");

type Goal = "EMAIL" | "DISCOUNT" | "BOTH";

type StoredSpec = {
  template_id?: string | null;
  headline?: string;
  subhead?: string;
  cta?: string;
  coupon_code?: string | null;
  layout_style?: "split-left" | "split-right" | "centered" | "minimal";
  image_url?: string | null;
  dna?: Partial<PopupDna> | null;
  discount_percent?: number | null;
  design_tokens?: {
    type_display?: string | null;
    type_body?: string | null;
    palette?: string[] | null;
  } | null;
};

/**
 * Reproduces the pre-fix startingStep calculation. A variant is "blank" if the
 * step it was told to open on is a step its own markup never rendered.
 */
function wasBlank(goal: Goal, dna: PopupDna): boolean {
  const hasTeaser = goal === "BOTH" && dna.step_flow === "two_step";
  const oldStartingStep = goal === "DISCOUNT" ? 3 : hasTeaser ? 1 : goal === "BOTH" ? 1 : 2;
  const flow = resolveFlow(goal, dna);
  const renderedSteps = new Set<number>();
  if (flow.hasTeaser) renderedSteps.add(1);
  if (flow.hasCapture) renderedSteps.add(2);
  if (flow.hasReveal) renderedSteps.add(3);
  return !renderedSteps.has(oldStartingStep);
}

async function main() {
  const variants = await prisma.variant.findMany({
    select: {
      id: true,
      name: true,
      popupSpec: true,
      design: true,
      generatedCode: true,
      campaign: {
        select: { id: true, name: true, status: true, generationContext: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let noSpec = 0;
  let healthy = 0;
  let repaired = 0;
  let unchanged = 0;
  let errors = 0;

  for (const variant of variants) {
    // Prisma types these columns as JsonValue, which has no overlap with a
    // concrete shape (JsonValue permits number where StoredSpec wants string),
    // so a direct `as` is rejected under strict mode. Route through unknown.
    const spec = variant.popupSpec as unknown as StoredSpec | null;
    if (!spec || typeof spec !== "object" || !spec.headline) {
      // Legacy/WHEEL variants render through the widget's own card fallback and
      // were never affected by this bug.
      noSpec++;
      continue;
    }

    const goal =
      ((variant.campaign.generationContext as unknown as { goal?: Goal } | null)?.goal as Goal) ??
      "BOTH";
    const dna = normalizeDna(spec.dna);
    const blank = wasBlank(goal, dna);

    if (!blank && !ALL) {
      healthy++;
      continue;
    }

    const primaryColor =
      (variant.design as unknown as { primaryColor?: string } | null)?.primaryColor ?? "#165DFF";

    let rendered: string;
    try {
      rendered = renderPopupTemplate(spec.template_id, {
        headline: spec.headline ?? "",
        subhead: spec.subhead ?? "",
        cta: spec.cta ?? "",
        primaryColor,
        couponCode: spec.coupon_code ?? null,
        goal,
        layoutStyle: spec.layout_style,
        imageUrl: spec.image_url ?? null,
        dna: spec.dna ?? null,
        brandFonts: spec.design_tokens ?? null,
        palette: spec.design_tokens?.palette ?? null,
        discountPercent: spec.discount_percent ?? null,
      });
    } catch (err) {
      errors++;
      console.error(`ERROR rendering variant ${variant.id} ("${variant.name}"):`, err);
      continue;
    }

    if (rendered === variant.generatedCode) {
      unchanged++;
      continue;
    }

    repaired++;
    console.log(
      `${blank ? "BLANK" : "STALE"} variant ${variant.id} ("${variant.name}") ` +
        `campaign ${variant.campaign.id} ("${variant.campaign.name}", ${variant.campaign.status}) ` +
        `goal=${goal} flow=${dna.step_flow} template=${spec.template_id ?? "split-screen"} -> re-rendered`,
    );

    if (APPLY) {
      try {
        await prisma.variant.update({
          where: { id: variant.id },
          data: { generatedCode: rendered },
        });
      } catch (err) {
        errors++;
        console.error(`      ERROR writing variant ${variant.id}:`, err);
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Total variants:              ${variants.length}`);
  console.log(`No popupSpec (legacy card):  ${noSpec}`);
  console.log(`Already fine:                ${healthy}`);
  console.log(`Re-render produced no diff:  ${unchanged}`);
  console.log(`Needing repair:              ${repaired}`);
  if (APPLY) {
    console.log(`Applied. Errors:             ${errors}`);
  } else {
    console.log(`\nThis was a DRY RUN - nothing was changed. Re-run with --apply to execute.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
