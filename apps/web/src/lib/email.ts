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
