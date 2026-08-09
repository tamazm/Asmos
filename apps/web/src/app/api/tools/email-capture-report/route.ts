import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, storeUrl, inputs, result } = body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    after(async () => {
      try {
        const { sendCalculatorReportEmail } = await import("@/lib/email");
        await sendCalculatorReportEmail({ to: email, storeUrl: storeUrl ?? null, inputs, result });
      } catch (err) {
        console.error("[tools/email-capture-report] Failed to send report email:", err);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[tools/email-capture-report] Failed:", e);
    return NextResponse.json({ ok: true, saved: false });
  }
}
