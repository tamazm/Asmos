import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_ORIGINS = new Set([
  "https://asmos.io",
  "https://app.asmos.io",
]);

function allowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

// Echo only the verified origin. `Vary: Origin` prevents a CDN from serving
// one domain's CORS response to the other domain (or to an unapproved one).
function cors<T extends NextResponse>(res: T, origin: string): T {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Vary", "Origin");
  return res;
}

function forbiddenOrigin() {
  const response = NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  response.headers.set("Vary", "Origin");
  return response;
}

export async function OPTIONS(req: NextRequest) {
  const origin = allowedOrigin(req);
  return origin ? cors(new NextResponse(null, { status: 204 }), origin) : forbiddenOrigin();
}

export async function POST(req: NextRequest) {
  const origin = allowedOrigin(req);
  if (!origin) return forbiddenOrigin();

  try {
    const body = await req.json();
    const { email, storeUrl, storeName, industry, score, grade, gradeLabel, topIssue, topFindings } = body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return cors(NextResponse.json({ error: "Invalid email" }, { status: 400 }), origin);
    }
    if (!storeUrl || typeof storeUrl !== "string") {
      return cors(NextResponse.json({ error: "Missing storeUrl" }, { status: 400 }), origin);
    }

    // Upsert - don't create duplicates for same email + store
    const lead = await prisma.analyzeLead.upsert({
      where: {
        // no unique constraint on combo, so use create/findFirst pattern
        id: "noop",
      },
      update: {},
      create: {
        email: email.toLowerCase().trim(),
        storeUrl,
        storeName: storeName ?? null,
        industry: industry ?? null,
        score: typeof score === "number" ? score : null,
        grade: grade ?? null,
      },
    }).catch(async () => {
      // Fallback: just create (upsert by id won't work - use findFirst + create)
      const existing = await prisma.analyzeLead.findFirst({
        where: { email: email.toLowerCase().trim(), storeUrl },
      });
      if (existing) return existing;
      return prisma.analyzeLead.create({
        data: {
          email: email.toLowerCase().trim(),
          storeUrl,
          storeName: storeName ?? null,
          industry: industry ?? null,
          score: typeof score === "number" ? score : null,
          grade: grade ?? null,
        },
      });
    });

    // Send the report email asynchronously. score/grade are persisted on
    // the lead record above, but gradeLabel/topIssue/topFindings are only
    // needed for this one-time email - passed straight through from the
    // request instead of adding columns for data nothing else reads.
    after(async () => {
      try {
        const { sendReportEmail } = await import("@/lib/email");
        await sendReportEmail({
          to: lead.email,
          storeName: lead.storeName,
          storeUrl: lead.storeUrl,
          score: typeof score === "number" ? score : null,
          grade: typeof grade === "string" ? grade : null,
          gradeLabel: typeof gradeLabel === "string" ? gradeLabel : null,
          topIssue: typeof topIssue === "string" ? topIssue : null,
          topFindings: Array.isArray(topFindings)
            ? topFindings
                .filter((f): f is { label: string; headline: string } =>
                  Boolean(f && typeof f.label === "string" && typeof f.headline === "string"),
                )
                .slice(0, 3)
            : [],
        });
      } catch (err) {
        console.error("[analyze/lead] Failed to send report email:", err);
      }
    });

    // Notify the internal sales channel independently from report delivery.
    // A Discord outage must never delay or fail lead capture/email delivery.
    after(async () => {
      try {
        const { sendAnalyzeLeadToDiscord } = await import("@/lib/analyzeLeadDiscord");
        await sendAnalyzeLeadToDiscord({
          leadId: lead.id,
          email: lead.email,
          storeName: lead.storeName,
          storeUrl: lead.storeUrl,
          industry: lead.industry,
          score: lead.score,
          grade: lead.grade,
          gradeLabel: typeof gradeLabel === "string" ? gradeLabel : null,
          topIssue: typeof topIssue === "string" ? topIssue : null,
          topFindings: Array.isArray(topFindings)
            ? topFindings
                .filter((f): f is { label: string; headline: string } =>
                  Boolean(f && typeof f.label === "string" && typeof f.headline === "string"),
                )
                .slice(0, 3)
            : [],
          origin,
          capturedAt: lead.createdAt,
        });
      } catch (err) {
        console.error("[analyze/lead] Failed to send Discord notification:", err);
      }
    });

    return cors(NextResponse.json({ ok: true, id: lead.id }), origin);
  } catch (e) {
    console.error("[analyze/lead] Failed to save lead:", e);
    // Don't fail the UX - return ok so the frontend flow continues
    return cors(NextResponse.json({ ok: true, saved: false }), origin);
  }
}
