import { currentUser } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { isSuperadminEmail } from "@/lib/superadmin";
import { readShopSessionFromCookies } from "@/lib/shopify/session-cookie";

// Lets a verified superadmin act on a specific account (e.g. editing that
// account's rewards from /admin/accounts/[id]) by passing an explicit
// accountId, while leaving ordinary account-holder requests completely
// unchanged: explicitAccountId is only ever honored after confirming the
// caller's own email is in the superadmin allowlist, so a non-superadmin
// passing an arbitrary accountId has zero effect - they still just get
// their own account via getOrCreateAccount(), exactly as before this
// function existed. Returns null only for "explicit id given, caller is a
// superadmin, but that account doesn't exist" - callers should 404 on that.
export async function resolveAccountForRequest(explicitAccountId?: string | null) {
  if (explicitAccountId) {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (isSuperadminEmail(email)) {
      return prisma.account.findUnique({ where: { id: explicitAccountId } });
    }
  }
  return getOrCreateAccount();
}

export async function getOrCreateAccount() {
  const user = await currentUser();
  if (!user) {
    // Embedded Shopify context — no Clerk user. Resolve the shop's Account
    // from the signed session cookie set during token exchange
    // (/api/shopify/session). This is what lets the reused dashboard UI render
    // inside the Shopify admin iframe without a Clerk sign-in.
    const shopSession = await readShopSessionFromCookies();
    if (shopSession) {
      const account = await prisma.account.findUnique({
        where: { id: shopSession.accountId },
        include: { websites: true },
      });
      if (account) return account;
    }
    throw new Error("Not authenticated");
  }

  const existing = await prisma.user.findUnique({
    where: { clerkUserId: user.id },
    include: { account: { include: { websites: true } } },
  });
  if (existing) return existing.account;

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

  // Check if they ran the analyzer before signing up
  const lead = email ? await prisma.analyzeLead.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  }) : null;

  try {
    const account = await prisma.account.create({
      data: {
        name: name ?? lead?.storeName ?? email ?? "New Account",
        users: {
          create: { clerkUserId: user.id, email, name },
        },
        // If we have a lead, consider onboarding done
        onboardingCompletedAt: lead ? new Date() : null,
        websites: lead?.storeUrl ? {
          create: { url: lead.storeUrl, installVerified: false }
        } : undefined,
      },
      include: { websites: true },
    });

    // Auto-generate campaign if lead exists
    if (lead && lead.storeUrl && account.websites[0]) {
      const campaign = await prisma.campaign.create({
        data: {
          accountId: account.id,
          websiteId: account.websites[0].id,
          name: `${lead.storeName ?? lead.storeUrl}: Email Capture`,
          type: "FORM",
          status: "GENERATING",
          generationContext: { 
            storeUrl: lead.storeUrl,
            storeName: lead.storeName,
            industry: lead.industry,
          }
        }
      });

      try {
        await inngest.send({
          name: "campaign.generate",
          data: { campaignId: campaign.id },
        });
      } catch (err) {
        console.error("[account] inngest.send failed for campaign.generate", err);
        await prisma.campaign
          .update({
            where: { id: campaign.id },
            data: {
              status: "FAILED",
              lastError: "Failed to queue campaign generation. Please retry.",
            },
          })
          .catch(() => {});
      }
    }

    try {
      await fetch("https://discord.com/api/webhooks/1481271682214789120/jBi0EZ9iL7pR7LkZ_1QypqIhw1hWqQ_U9WGeEAzV-9m6P28WXhcsBphiDWPxZ-VVL3yb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "🎉 New Asmos Signup",
            color: 0x00FF00,
            fields: [
              { name: "Name", value: name || "Unknown", inline: true },
              { name: "Email", value: email || "Unknown", inline: true },
              { name: "Store URL", value: lead?.storeUrl || "None provided", inline: false }
            ],
            timestamp: new Date().toISOString()
          }]
        })
      });
    } catch (e) {
      console.error("Failed to send discord notification", e);
    }

    return account;
  } catch (err: any) {
    if (err.code === 'P2002') {
      // Race condition: another request created the user/account first
      const retryUser = await prisma.user.findUnique({
        where: { clerkUserId: user.id },
        include: { account: { include: { websites: true } } },
      });
      if (retryUser) return retryUser.account;
    }
    throw err;
  }
}
