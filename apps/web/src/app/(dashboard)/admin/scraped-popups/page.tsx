import { currentUser } from "@/lib/auth-adapter";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { isSuperadminEmail } from "@/lib/superadmin";
import Link from "next/link";
import { ScrapeForm } from "./ScrapeForm";
import type { ScrapedPopupDesign } from "@/lib/popupScraping";

// The scraped popup design library (see lib/popupScraping.ts and
// popupGeneration.ts's getScrapedExamplesSection): trigger a new scrape
// (ScrapeForm → actions.ts's runScrapeBatch → lib/inngest/scrapePopupBatch.ts)
// and browse what's already there. No approve/reject step, unlike
// /admin/learned-patterns — the source sites are hand-picked to already be
// high-traffic and high-quality, so a scraped row feeds generation the
// moment it's inserted.
export default async function ScrapedPopupsPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    redirect("/campaigns");
  }

  const examples = await prisma.scrapedPopupExample.findMany({
    where: { present: true },
    orderBy: { scrapedAt: "desc" },
    take: 200,
  });

  const byIndustry = new Map<string, typeof examples>();
  for (const e of examples) {
    const list = byIndustry.get(e.industry) ?? [];
    list.push(e);
    byIndustry.set(e.industry, list);
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <div>
        <div className="flex items-center gap-3 mb-2 text-sm text-[color:var(--color-text-secondary)]">
          <Link href="/admin" className="hover:text-[color:var(--color-text-primary)]">Admin</Link>
          <span>/</span>
          <span className="text-[color:var(--color-text-primary)] font-medium">Scraped Popups</span>
        </div>
        <PageHeader title="Scraped Popup Design Library" />
        <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] max-w-2xl">
          Real popups captured from high-traffic live sites, grouped by industry. Every row here is already
          being read by generation (see getScrapedExamplesSection) — there is no review step, since the source
          sites are hand-picked to already be high quality.
        </p>
      </div>

      <ScrapeForm />

      {examples.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
          Nothing scraped yet. Paste some sites above and run a scrape — it takes a few minutes to land.
        </div>
      ) : (
        [...byIndustry.entries()].map(([industry, rows]) => (
          <div key={industry} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
              {industry} ({rows.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((e) => {
                const d = (e.design ?? {}) as Partial<ScrapedPopupDesign>;
                const swatches = [d.backgroundColor, d.accentColor, d.textColor].filter(
                  (c): c is string => typeof c === "string",
                );
                return (
                  <div
                    key={e.id}
                    className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden flex flex-col"
                  >
                    {e.screenshot ? (
                      // eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not an optimizable remote image
                      <img
                        src={`data:image/jpeg;base64,${e.screenshot}`}
                        alt=""
                        className="w-full h-40 object-cover object-top bg-[color:var(--color-surface-sunken)]"
                      />
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center bg-[color:var(--color-surface-sunken)] text-xs text-[color:var(--color-text-secondary)]">
                        No screenshot captured
                      </div>
                    )}
                    <div className="p-4 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="neutral">{d.template ?? "unknown"}</Badge>
                        <Badge variant="neutral">{d.layout ?? "unknown"}</Badge>
                        {d.buttonShape && <Badge variant="neutral">{d.buttonShape} button</Badge>}
                        {d.density && <Badge variant="neutral">{d.density}</Badge>}
                      </div>
                      {swatches.length > 0 && (
                        <div className="flex items-center gap-1.5" title="background / accent / text">
                          {swatches.map((hex, i) => (
                            <span
                              key={i}
                              className="inline-block h-4 w-4 rounded-full border border-black/10"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                          <span className="font-mono text-[10px] text-[color:var(--color-text-secondary)]">
                            {swatches.join(" / ")}
                          </span>
                        </div>
                      )}
                      {(d.headlineFont || d.bodyFont) && (
                        <p className="text-[11px] text-[color:var(--color-text-secondary)] truncate">
                          {[d.headlineFont, d.bodyFont].filter(Boolean).join(" / ")}
                        </p>
                      )}
                      {d.headline && (
                        <p className="text-sm font-medium text-[color:var(--color-text-primary)] leading-snug">
                          {d.headline}
                        </p>
                      )}
                      {d.subhead && (
                        <p className="text-xs text-[color:var(--color-text-secondary)] leading-snug">{d.subhead}</p>
                      )}
                      {d.ctaText && (
                        <span className="text-xs font-medium text-[color:var(--color-primary)]">CTA: {d.ctaText}</span>
                      )}
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] truncate mt-1"
                      >
                        {e.sourceUrl}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
