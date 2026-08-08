import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    after(async () => {
      try {
        const { sendNewsletterNotification } = await import("@/lib/email");
        await sendNewsletterNotification({ email: email.toLowerCase().trim() });
      } catch (err) {
        console.error("[api/newsletter] Failed to send notification:", err);
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true, saved: false });
  }
}
