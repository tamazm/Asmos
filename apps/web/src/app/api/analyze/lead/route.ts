import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, storeUrl, storeName, industry, score, grade, gradeLabel, topIssue, topFindings } = body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!storeUrl || typeof storeUrl !== "string") {
      return NextResponse.json({ error: "Missing storeUrl" }, { status: 400 });
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

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (e) {
    console.error("[analyze/lead] Failed to save lead:", e);
    // Don't fail the UX - return ok so the frontend flow continues
    return NextResponse.json({ ok: true, saved: false });
  }
}
