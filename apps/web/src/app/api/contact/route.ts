import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, website, inquiryType, message } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid work email is required" }, { status: 400 });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    try {
      const { sendContactNotification } = await import("@/lib/email");
      await sendContactNotification({
        name: name.trim(),
        email: email.trim(),
        company: typeof company === "string" ? company.trim() : "",
        website: typeof website === "string" ? website.trim() : null,
        inquiryType: typeof inquiryType === "string" ? inquiryType : "Other",
        message: message.trim(),
      });
    } catch (err) {
      // Don't fail the UX if email delivery has an issue — log for follow-up.
      console.error("[api/contact] Failed to send notification email:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/contact] Failed to process submission:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
