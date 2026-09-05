import { analyzeStoreForCampaign } from "@/app/api/analyze/route";
import { auth } from "@/lib/auth-adapter";

/**
 * Authenticated, higher-fidelity store analysis for popup generation.
 * The public /api/analyze endpoint intentionally remains on the fast preset.
 */
export async function POST(request: Request) {
  const startedAt = performance.now();
  const [session, payload] = await Promise.all([
    auth(),
    request.json().catch(() => null) as Promise<{ url?: unknown } | null>,
  ]);

  if (!session.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = payload?.url;
  if (typeof url !== "string" || !url.trim()) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  const result = await analyzeStoreForCampaign(url);
  const totalMs = Math.round((performance.now() - startedAt) * 10) / 10;
  console.info("[campaign-analysis:timing]", {
    userId: String(session.userId),
    totalMs,
    stages: result.analysisTimingMs,
  });

  return Response.json(result, {
    headers: { "X-Asmos-Campaign-Analysis-Ms": String(totalMs) },
  });
}
