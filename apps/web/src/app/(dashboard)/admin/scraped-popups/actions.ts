"use server";

import { currentUser } from "@/lib/auth-adapter";
import { isSuperadminEmail } from "@/lib/superadmin";
import { inngest } from "@/lib/inngest/client";

const MAX_ROWS_PER_BATCH = 100;

type RunScrapeResult = { ok: true; count: number } | { ok: false; error: string };

// Triggered from ScrapeForm.tsx on this page — parses pasted "url, industry"
// lines and queues lib/inngest/scrapePopupBatch.ts. Runs in the background:
// this action only has to send the event, not wait through N sequential
// Browserless calls, so it returns in well under a second regardless of
// batch size.
export async function runScrapeBatch(rawText: string): Promise<RunScrapeResult> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    return { ok: false, error: "Unauthorized: Superadmin access required." };
  }

  const rows = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^url\s*,/i.test(line)) // tolerate a pasted CSV header line
    .map((line) => {
      const [url, ...rest] = line.split(",");
      return { url: url?.trim() ?? "", segment: rest.join(",").trim() };
    })
    .filter((r) => r.url.length > 0);

  if (rows.length === 0) {
    return { ok: false, error: "No valid rows found — one per line, as \"url, industry\"." };
  }
  if (rows.length > MAX_ROWS_PER_BATCH) {
    return { ok: false, error: `Too many rows (${rows.length}) — max ${MAX_ROWS_PER_BATCH} per batch.` };
  }

  await inngest.send({ name: "popup.scrape_batch", data: { rows } });
  return { ok: true, count: rows.length };
}
