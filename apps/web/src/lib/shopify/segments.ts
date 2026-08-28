import { adminGraphql } from "./admin-client";

// Customer segments overview for the embedded "Audiences" panel. This is also
// where the App Store "Forms" category's `segments` + `customerSegmentMembers`
// query requirements are satisfied — both run on each embedded load once the
// merchant has granted read_customers (the optional scope both queries need).
//
// Genuine merchant value, not just a compliance ping: it shows how the shop's
// customers are already segmented so the merchant can reason about who their
// popups are converting versus who they already have.

export interface SegmentSummary {
  id: string;
  name: string;
  // Number of members sampled back from customerSegmentMembers for this segment
  // (Shopify doesn't return an exact total cheaply; the panel shows "N+").
  memberCount: number;
}

export interface SegmentsOverview {
  segments: SegmentSummary[];
}

// Requires the read_customers optional scope. Throws on permission errors — the
// caller decides whether that's expected (scope not yet granted) or worth
// surfacing.
export async function getSegmentsOverview(
  shopDomain: string,
  { segmentLimit = 5, memberSample = 10 }: { segmentLimit?: number; memberSample?: number } = {},
): Promise<SegmentsOverview> {
  // 1) segments query.
  const segData = await adminGraphql<{
    segments?: { edges: { node: { id: string; name: string } }[] };
  }>(
    shopDomain,
    `query AsmosSegments($first: Int!) {
      segments(first: $first) { edges { node { id name } } }
    }`,
    { first: segmentLimit },
  );

  const segments = segData?.segments?.edges?.map((e) => e.node) ?? [];
  if (segments.length === 0) return { segments: [] };

  // 2) customerSegmentMembers query — sample members of each segment so the
  //    panel can show a rough size. Run in parallel; a per-segment failure just
  //    yields a 0 count rather than failing the whole overview.
  const withCounts = await Promise.all(
    segments.map(async (seg): Promise<SegmentSummary> => {
      try {
        const memData = await adminGraphql<{
          customerSegmentMembers?: { edges: { node: { id: string } }[] };
        }>(
          shopDomain,
          `query AsmosSegmentMembers($segmentId: ID!, $first: Int!) {
            customerSegmentMembers(segmentId: $segmentId, first: $first) {
              edges { node { id } }
            }
          }`,
          { segmentId: seg.id, first: memberSample },
        );
        return {
          id: seg.id,
          name: seg.name,
          memberCount: memData?.customerSegmentMembers?.edges?.length ?? 0,
        };
      } catch (err) {
        console.error("[shopify/segments] customerSegmentMembers failed", shopDomain, seg.id, err);
        return { id: seg.id, name: seg.name, memberCount: 0 };
      }
    }),
  );

  return { segments: withCounts };
}
