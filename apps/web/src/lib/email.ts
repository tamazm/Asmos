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

export async function sendReportEmail(params: {
  to: string;
  storeName: string | null;
  storeUrl: string;
}) {
  const { to, storeName, storeUrl } = params;
  const resend = new Resend(process.env.RESEND_API_KEY);

  const displayStoreName = storeName ?? storeUrl;
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/sign-up` : 'https://asmos.com/sign-up';

  await resend.emails.send({
    from: "Asmos <onboarding@resend.dev>",
    to,
    subject: `Your CRO report for ${displayStoreName} is ready`,
    html: `<p>Hi there,</p><p>We have finished analyzing <strong>${displayStoreName}</strong>.</p><p><a href="${loginUrl}">Click here to view your CRO report and your AI-generated popup.</a></p>`,
  });
}
