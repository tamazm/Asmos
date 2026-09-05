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
    from: "Asmos <hello@asmos.io>",
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
    from: "Asmos <hello@asmos.io>",
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
    from: "Asmos Contact Form <hello@asmos.io>",
    to: "saba@asmos.io",
    replyTo: email,
    subject: `[Contact] ${inquiryType} - ${company || name}`,
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
    from: "Asmos <hello@asmos.io>",
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
    from: "Asmos Blog <hello@asmos.io>",
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

export type ReportSignal = {
  key: string;
  found: boolean;
  description?: string | null;
};

export type ReportEmailParams = {
  to: string;
  storeName: string | null;
  storeUrl: string;
  // Optional - when present, the email cites this store's actual findings
  // instead of being a generic "your report is ready" notice. Ephemeral:
  // passed straight through from the results page's submit call
  // (api/analyze/lead/route.ts), not persisted on AnalyzeLead.
  score?: number | null;
  grade?: string | null;
  gradeLabel?: string | null;
  topIssue?: string | null;
  topFindings?: { label: string; headline: string }[];
  auditSignals?: ReportSignal[];
};

type EmailFinding = {
  label: string;
  title: string;
  evidence: string;
  why: string;
  recommendation: string;
  tip: string;
};

const SIGNAL_PLAYBOOK: Record<string, Omit<EmailFinding, "evidence">> = {
  popup: {
    label: "Visitor capture",
    title: "Create a deliberate capture moment",
    why: "Interested visitors can leave without giving you a way to continue the relationship.",
    recommendation: "Test one focused capture experience tied to the product or offer on the page.",
    tip: "Wait for meaningful engagement, then show one clear benefit. Do not ask on arrival and again moments later.",
  },
  emailCapture: {
    label: "Email capture",
    title: "Give non-buyers a useful next step",
    why: "Visitors who are interested but not ready to purchase have no low-commitment path forward.",
    recommendation: "Pair email capture with a specific benefit that matches the store's buying cycle.",
    tip: "Offer product guidance, useful access, or a first-order benefit instead of a generic newsletter request.",
  },
  socialProof: {
    label: "Social proof",
    title: "Move proof closer to the decision",
    why: "The page asks visitors to trust the offer before showing evidence that other customers already have.",
    recommendation: "Place your strongest credible proof beside the primary decision point.",
    tip: "Use a real review count, a specific customer outcome, or a relevant quote directly below the main CTA.",
  },
  urgency: {
    label: "Urgency",
    title: "Give the decision a real reason to happen now",
    why: "The offer may be clear without giving an interested visitor a reason to act during this session.",
    recommendation: "Test urgency only when it reflects a real constraint such as inventory, delivery timing, or an expiring offer.",
    tip: "Put the genuine constraint beside the CTA. Avoid evergreen countdowns that reset and weaken trust.",
  },
  exitIntent: {
    label: "Exit recovery",
    title: "Recover high-intent exits",
    why: "Visitors at the point of leaving are not given a relevant alternative or a way to continue later.",
    recommendation: "Use exit intent for a distinct recovery message instead of repeating the page CTA.",
    tip: "Offer to save the cart, answer an objection, or send product details for later.",
  },
  stickyBar: {
    label: "Persistent action",
    title: "Keep the primary action available while scrolling",
    why: "The main action can disappear while visitors evaluate the rest of a long page.",
    recommendation: "Test a compact sticky action on smaller screens and longer product pages.",
    tip: "Keep the product, price, and action visible without covering content or competing with chat widgets.",
  },
  liveChat: {
    label: "Assisted support",
    title: "Create an answer path for unresolved objections",
    why: "Visitors with a specific pre-purchase question may need to leave the buying journey to find help.",
    recommendation: "Add assisted support only where product complexity or order value justifies it.",
    tip: "Offer help after sustained product-page engagement instead of opening chat immediately.",
  },
};

const GENERAL_FINDINGS: EmailFinding[] = [
  {
    label: "Offer clarity",
    title: "Make the value obvious before asking for action",
    evidence: "This is a recommended optimization test, not a failed automated check.",
    why: "Visitors decide whether an offer is relevant before they study the details.",
    recommendation: "Test one concrete benefit in the headline and keep the primary CTA focused on the same outcome.",
    tip: "Read the first screen with product imagery hidden. The offer should still be understandable in a few seconds.",
  },
  {
    label: "Trigger timing",
    title: "Match the interruption to visitor intent",
    evidence: "This is a recommended optimization test, not a failed automated check.",
    why: "A strong message shown at the wrong moment can still suppress engagement.",
    recommendation: "Compare an engagement-based trigger with your current timing rather than changing the offer and timing together.",
    tip: "Keep one variable per test so the result tells you what actually changed behavior.",
  },
  {
    label: "Measurement",
    title: "Judge lift by completed outcomes",
    evidence: "This is a recommended measurement practice for the next test.",
    why: "More signups do not automatically mean more customers or profitable orders.",
    recommendation: "Track the full path from view to capture to purchase before choosing a winner.",
    tip: "Use revenue per visitor or completed purchase rate as the deciding metric, with capture rate as supporting context.",
  },
];

function signalEvidence(signal: ReportSignal, label: string): string {
  const description = signal.description?.trim();
  if (description && !/^none detected\.?$/i.test(description)) return description;
  return `No ${label.toLowerCase()} signal was detected in the scanned storefront experience.`;
}

function buildEmailFindings(params: ReportEmailParams): EmailFinding[] {
  const signalFindings = (params.auditSignals ?? [])
    .filter((signal) => !signal.found && SIGNAL_PLAYBOOK[signal.key])
    .slice(0, 3)
    .map((signal) => ({
      ...SIGNAL_PLAYBOOK[signal.key],
      evidence: signalEvidence(signal, SIGNAL_PLAYBOOK[signal.key].label),
    }));

  if (signalFindings.length > 0) return signalFindings;

  const legacyFindings = (params.topFindings ?? []).slice(0, 3).map((finding) => {
    const matchingPlaybook = Object.values(SIGNAL_PLAYBOOK).find((item) =>
      `${finding.label} ${finding.headline}`.toLowerCase().includes(item.label.toLowerCase()),
    );
    const fallback = matchingPlaybook ?? GENERAL_FINDINGS[0];
    return {
      ...fallback,
      label: finding.label,
      title: finding.headline,
      evidence: "This opportunity was identified during the storefront scan.",
    };
  });

  return legacyFindings.length > 0 ? legacyFindings : GENERAL_FINDINGS;
}

function renderFinding(finding: EmailFinding, index: number): string {
  return `<tr>
    <td style="padding:0 0 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e6eaf0;border-radius:16px;background:#ffffff;">
        <tr>
          <td style="padding:22px 22px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td width="42" valign="top" style="width:42px;">
                  <div style="width:32px;height:32px;line-height:32px;border-radius:9px;background:#165dff;color:#ffffff;font-size:12px;font-weight:700;text-align:center;">0${index + 1}</div>
                </td>
                <td valign="top">
                  <p style="margin:0 0 5px;color:#165dff;font-size:12px;font-weight:700;letter-spacing:.02em;">${escapeHtml(finding.label)}</p>
                  <h3 style="margin:0;color:#0f172a;font-size:19px;line-height:1.3;font-weight:700;">${escapeHtml(finding.title)}</h3>
                </td>
              </tr>
            </table>
            <div style="margin:18px 0 0;padding:12px 14px;border-left:3px solid #165dff;background:#f5f8ff;color:#334155;font-size:13px;line-height:1.55;">
              <strong style="color:#0f172a;">Evidence:</strong> ${escapeHtml(finding.evidence)}
            </div>
            <p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6;"><strong style="color:#0f172a;">Why it matters:</strong> ${escapeHtml(finding.why)}</p>
            <p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.6;"><strong style="color:#0f172a;">Recommended test:</strong> ${escapeHtml(finding.recommendation)}</p>
            <p style="margin:12px 0 0;padding:11px 13px;border-radius:10px;background:#f8fafc;color:#475569;font-size:13px;line-height:1.55;"><strong style="color:#0f172a;">Implementation tip:</strong> ${escapeHtml(finding.tip)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function renderReportEmail(params: ReportEmailParams): { subject: string; html: string; text: string } {
  const plainStoreName = (params.storeName ?? params.storeUrl).replace(/[\r\n]+/g, " ").trim();
  const displayStoreName = escapeHtml(plainStoreName);
  const displayStoreUrl = escapeHtml(params.storeUrl);
  const hasScore = typeof params.score === "number" && Boolean(params.grade);
  const findings = buildEmailFindings(params);
  const subject = hasScore
    ? `${plainStoreName} scored ${params.score}/100: your priority CRO review`
    : `Your CRO review for ${plainStoreName} is ready`;
  const preheader = hasScore
    ? `See what ${plainStoreName} should test first and how to implement it.`
    : `Your prioritized storefront recommendations are ready.`;

  const scoreBlock = hasScore
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;border:1px solid #dbe7ff;border-radius:16px;background:#f5f8ff;">
        <tr>
          <td style="padding:20px 22px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td valign="middle">
                  <p style="margin:0 0 5px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Conversion signal score</p>
                  <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.5;">${params.gradeLabel ? escapeHtml(params.gradeLabel) : "Storefront scan complete"}</p>
                </td>
                <td valign="middle" align="right" style="padding-left:18px;white-space:nowrap;">
                  <span style="color:#165dff;font-size:34px;line-height:1;font-weight:800;">${params.score}</span>
                  <span style="color:#64748b;font-size:13px;">/100</span>
                  <span style="display:inline-block;margin-left:8px;padding:5px 8px;border-radius:999px;background:#165dff;color:#ffffff;font-size:12px;font-weight:700;vertical-align:5px;">${escapeHtml(params.grade ?? "")}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : "";

  const topIssueBlock = params.topIssue
    ? `<div style="margin:16px 0 0;padding:16px 18px;border-radius:14px;background:#0f172a;color:#ffffff;">
        <p style="margin:0 0 5px;color:#a9c1ff;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;">Highest-priority signal</p>
        <p style="margin:0;color:#ffffff;font-size:15px;line-height:1.55;font-weight:600;">${escapeHtml(params.topIssue)}</p>
      </div>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media only screen and (max-width:620px) {
      .asmos-shell { width:100% !important; }
      .asmos-pad { padding-left:18px !important; padding-right:18px !important; }
      .asmos-title { font-size:30px !important; }
      .asmos-cta { display:block !important; width:auto !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f6fa;color:#0f172a;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f6fa;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" class="asmos-shell" style="width:620px;max-width:620px;border:1px solid #e3e8ef;border-radius:20px;background:#ffffff;box-shadow:0 18px 50px rgba(30,50,82,.10);">
          <tr>
            <td class="asmos-pad" style="padding:24px 34px 20px;border-bottom:1px solid #edf0f4;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="color:#0f172a;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.04em;">Asmos<span style="color:#165dff;">.</span></td>
                  <td align="right" style="color:#64748b;font-family:Arial,Helvetica,sans-serif;font-size:11px;">Free optimization analysis</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="asmos-pad" style="padding:38px 34px 12px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 12px;color:#165dff;font-size:12px;font-weight:700;letter-spacing:.04em;">REPORT READY</p>
              <h1 class="asmos-title" style="margin:0;color:#0f172a;font-size:38px;line-height:1.08;font-weight:700;letter-spacing:-.045em;">What to test first on ${displayStoreName}</h1>
              <p style="margin:16px 0 0;color:#475569;font-size:15px;line-height:1.65;">We reviewed the storefront signals visible at <span style="color:#165dff;">${displayStoreUrl}</span> and turned the strongest gaps into practical next tests.</p>
              ${scoreBlock}
              ${topIssueBlock}
            </td>
          </tr>
          <tr>
            <td class="asmos-pad" style="padding:24px 34px 6px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 8px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Priority review</p>
              <h2 style="margin:0 0 18px;color:#0f172a;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-.025em;">${findings.length} changes worth testing</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${findings.map(renderFinding).join("")}
              </table>
            </td>
          </tr>
          <tr>
            <td class="asmos-pad" style="padding:18px 34px 38px;font-family:Arial,Helvetica,sans-serif;">
              <div style="padding:24px;border-radius:16px;background:#eef4ff;text-align:center;">
                <h2 style="margin:0;color:#0f172a;font-size:23px;line-height:1.25;font-weight:700;letter-spacing:-.025em;">Turn the review into a live conversion experience</h2>
                <p style="margin:10px auto 18px;max-width:450px;color:#475569;font-size:14px;line-height:1.6;">Use Asmos to build, launch, and improve the popup experience behind these recommendations.</p>
                <a href="https://app.asmos.io/sign-up" class="asmos-cta" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#165dff;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Start building with Asmos</a>
                <p style="margin:12px 0 0;color:#64748b;font-size:11px;">No account was required for this audit. Create one when you are ready to put the findings to work.</p>
              </div>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;">Automated storefront observations are starting points for testing, not guaranteed outcomes.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Your optimization analysis for ${plainStoreName}`,
    hasScore ? `Conversion signal score: ${params.score}/100 (${params.grade}${params.gradeLabel ? `, ${params.gradeLabel}` : ""})` : "",
    params.topIssue ? `Highest-priority signal: ${params.topIssue}` : "",
    ...findings.flatMap((finding, index) => [
      `${index + 1}. ${finding.label}: ${finding.title}`,
      `Evidence: ${finding.evidence}`,
      `Why it matters: ${finding.why}`,
      `Recommended test: ${finding.recommendation}`,
      `Implementation tip: ${finding.tip}`,
    ]),
    "Start building with Asmos: https://app.asmos.io/sign-up",
    "Automated storefront observations are starting points for testing, not guaranteed outcomes.",
  ].filter(Boolean).join("\n\n");

  return { subject, html, text };
}

export async function sendReportEmail(params: ReportEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const email = renderReportEmail(params);

  await resend.emails.send({
    from: "Asmos <hello@asmos.io>",
    to: params.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
