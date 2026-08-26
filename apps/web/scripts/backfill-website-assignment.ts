// One-time backfill for the "same campaign everywhere" bug: /api/campaigns
// used to attach every campaign to the account's very first Website row
// forever, ignoring whatever store URL was actually typed for that
// campaign. This script re-derives the correct Website for each campaign
// from its own generationContext.storeUrl and repoints campaign.websiteId
// at it (creating the Website row if it doesn't exist yet for that
// account), so the live widget starts serving the right campaign per store.
//
// DRY RUN BY DEFAULT - prints exactly what it would change and does not
// write anything. Review the output, then re-run with --apply to execute.
//
// Usage (from apps/web/):
//   npx tsx scripts/backfill-website-assignment.ts            # dry run
//   npx tsx scripts/backfill-website-assignment.ts --apply    # actually applies it
//
// Safe to run against production DATABASE_URL - it only ever touches
// Campaign.websiteId and creates missing Website rows; it never deletes
// anything (old, now-empty Website rows are left in place - harmless, and
// deleting them could break an already-installed widget snippet that still
// references that URL).

import { prisma } from "../src/lib/prisma";
import { normalizeHost } from "../src/lib/host";

const APPLY = process.argv.includes("--apply");

async function main() {
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      accountId: true,
      websiteId: true,
      generationContext: true,
      website: { select: { id: true, url: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let correct = 0;
  let skippedNoUrl = 0;
  let toFix = 0;
  let websitesToCreate = 0;
  let errors = 0;

  // Cache Website find-or-create decisions within this run so campaigns
  // sharing the same (accountId, url) - which is normal and fine - only
  // resolve/create the Website row once instead of racing each other.
  const resolved = new Map<string, { id: string; url: string; isNew: boolean }>();

  for (const campaign of campaigns) {
    const storeUrlRaw = (campaign.generationContext as { storeUrl?: unknown } | null)?.storeUrl;
    if (typeof storeUrlRaw !== "string" || !storeUrlRaw.trim()) {
      console.log(`SKIP  campaign ${campaign.id} ("${campaign.name}") - no generationContext.storeUrl to derive from. Currently on website ${campaign.websiteId} (${campaign.website.url}). Leave as-is or fix manually.`);
      skippedNoUrl++;
      continue;
    }

    const correctUrl = normalizeHost(storeUrlRaw);
    if (correctUrl === campaign.website.url) {
      correct++;
      continue;
    }

    toFix++;
    const cacheKey = `${campaign.accountId}::${correctUrl}`;
    let target = resolved.get(cacheKey);

    if (!target) {
      const existing = await prisma.website.findFirst({
        where: { accountId: campaign.accountId, url: correctUrl },
        select: { id: true, url: true },
      });
      if (existing) {
        target = { ...existing, isNew: false };
      } else {
        target = { id: "(will be created)", url: correctUrl, isNew: true };
        websitesToCreate++;
      }
      resolved.set(cacheKey, target);
    }

    console.log(
      `FIX   campaign ${campaign.id} ("${campaign.name}", account ${campaign.accountId}): ` +
      `website ${campaign.websiteId} (${campaign.website.url}) -> ${target.isNew ? "NEW website" : target.id} (${target.url})`,
    );

    if (APPLY) {
      try {
        let websiteId = target.id;
        if (target.isNew) {
          const created = await prisma.website.create({
            data: { accountId: campaign.accountId, url: correctUrl, installVerified: false },
          });
          websiteId = created.id;
          target.id = created.id;
          target.isNew = false;
          resolved.set(cacheKey, target);
          console.log(`      created website ${websiteId} (${correctUrl})`);
        }
        await prisma.campaign.update({ where: { id: campaign.id }, data: { websiteId } });
      } catch (err) {
        errors++;
        console.error(`      ERROR applying fix for campaign ${campaign.id}:`, err);
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Total campaigns:        ${campaigns.length}`);
  console.log(`Already correct:        ${correct}`);
  console.log(`Skipped (no storeUrl):  ${skippedNoUrl}`);
  console.log(`Needing reassignment:   ${toFix} (${websitesToCreate} new website row(s))`);
  if (APPLY) {
    console.log(`Applied. Errors:        ${errors}`);
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
