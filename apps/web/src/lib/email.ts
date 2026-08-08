import { Resend } from "resend";

export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  accountName: string;
  acceptUrl: string;
}) {
  const { to, inviterName, accountName, acceptUrl } = params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "Asmos <onboarding@resend.dev>",
    to,
    subject: `${inviterName} invited you to join ${accountName} on Asmos`,
    html: `<p>${inviterName} invited you to join <strong>${accountName}</strong> on Asmos.</p><p><a href="${acceptUrl}">Accept invite</a></p>`,
  });
}

export async function sendRewardEmail(params: {
  to: string;
  rewardLabel: string;
  couponCode: string | null;
  brandName: string;
}) {
  const { to, rewardLabel, couponCode, brandName } = params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "Asmos <onboarding@resend.dev>",
    to,
    subject: `Your reward from ${brandName}: ${rewardLabel}`,
    html: couponCode
      ? `<p>You got: <strong>${rewardLabel}</strong></p><p>Your code: <strong>${couponCode}</strong></p>`
      : `<p>You got: <strong>${rewardLabel}</strong></p><p>${brandName} will be in touch.</p>`,
  });
}

export async function sendContactNotification(params: {
  name: string;
  email: string;
  company: string;
  website?: string | null;
  inquiryType: string;
  message: string;
}) {
  const { name, email, company, website, inquiryType, message } = params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "Asmos Contact Form <onboarding@resend.dev>",
    to: "saba@asmos.io",
    replyTo: email,
    subject: `[Contact] ${inquiryType} — ${company || name}`,
    html: `
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company)}</p>
      ${website ? `<p><strong>Website:</strong> ${escapeHtml(website)}</p>` : ""}
      <p><strong>Inquiry type:</strong> ${escapeHtml(inquiryType)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
    `,
  });
}

export async function sendCalculatorReportEmail(params: {
  to: string;
  storeUrl: string | null;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
}) {
  const { to, storeUrl, inputs, result } = params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "Asmos <onboarding@resend.dev>",
    to,
    subject: "Your Email Capture Revenue Calculator results",
    html: `
      <p>Here's a copy of your Email Capture Revenue Calculator results${storeUrl ? ` for <strong>${escapeHtml(storeUrl)}</strong>` : ""}.</p>
      <p><strong>Inputs:</strong></p>
      <pre>${escapeHtml(JSON.stringify(inputs, null, 2))}</pre>
      <p><strong>Results:</strong></p>
      <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
      <p>This is an estimate, not a revenue guarantee. Actual performance varies by store and customer behavior.</p>
      <p><a href="https://asmos.io/analyze">Try the Free Optimization Analysis</a> to see what Asmos would test on your store.</p>
    `,
  });
}

export async function sendNewsletterNotification(params: { email: string }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Asmos Blog <onboarding@resend.dev>",
    to: "saba@asmos.io",
    subject: "New blog newsletter signup",
    html: `<p>New newsletter signup: ${escapeHtml(params.email)}</p>`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendReportEmail(params: {
  to: string;
  storeName: string | null;
  storeUrl: string;
  // Optional — when present, the email cites this store's actual findings
  // instead of being a generic "your report is ready" notice. Ephemeral:
  // passed straight through from the results page's submit call
  // (api/analyze/lead/route.ts), not persisted on AnalyzeLead.
  score?: number | null;
  grade?: string | null;
  gradeLabel?: string | null;
  topIssue?: string | null;
  topFindings?: { label: string; headline: string }[];
}) {
  const { to, storeName, storeUrl, score, grade, gradeLabel, topIssue, topFindings } = params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const displayStoreName = escapeHtml(storeName ?? storeUrl);
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/sign-up` : 'https://asmos.com/sign-up';

  const hasScore = typeof score === "number" && grade;
  const scoreBlock = hasScore
    ? `<div style="margin:20px 0;padding:16px 20px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;">
         <p style="margin:0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Your CRO score</p>
         <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#111827;">${score}<span style="font-size:16px;color:#6b7280;"> / 100 &middot; ${escapeHtml(grade ?? "")}</span></p>
         ${gradeLabel ? `<p style="margin:4px 0 0;font-size:14px;color:#374151;">${escapeHtml(gradeLabel)}</p>` : ""}
       </div>`
    : "";

  const topIssueBlock = topIssue
    ? `<p style="font-size:15px;color:#111827;"><strong>Your #1 opportunity:</strong> ${escapeHtml(topIssue)}</p>`
    : "";

  const findingsBlock =
    topFindings && topFindings.length > 0
      ? `<div style="margin:16px 0;">
           <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">What we found</p>
           ${topFindings
             .map(
               (f) =>
                 `<div style="padding:10px 0;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:13px;font-weight:700;color:#6366f1;">${escapeHtml(f.label)}</p>
                    <p style="margin:2px 0 0;font-size:14px;color:#374151;">${escapeHtml(f.headline)}</p>
                  </div>`,
             )
             .join("")}
         </div>`
      : "";

  const intro = hasScore
    ? `<p>We just finished analyzing <strong>${displayStoreName}</strong> — here's what stood out.</p>`
    : `<p>We have finished analyzing <strong>${displayStoreName}</strong>.</p>`;

  await resend.emails.send({
    from: "Asmos <onboarding@resend.dev>",
    to,
    subject: hasScore
      ? `${displayStoreName} scored ${score}/100 — here's why`
      : `Your CRO report for ${displayStoreName} is ready`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;">
      <p>Hi there,</p>
      ${intro}
      ${scoreBlock}
      ${topIssueBlock}
      ${findingsBlock}
      <p style="margin-top:20px;"><a href="${loginUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">View your full report &amp; AI-generated popup</a></p>
    </div>`,
  });
}
