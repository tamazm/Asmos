// @ts-nocheck
import { prisma } from "@/lib/prisma";
import type { CampaignEventType } from ".prisma/client";

// Dev-only convenience: populates the first account with realistic-looking
// campaigns/variants/events/leads so every page has something to show.
// Not linked from any UI — hit it directly, then delete this route.

function randomDateWithinDays(days: number): Date {
  const now = Date.now();
  const past = now - Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(past);
}

async function seedEvents(variantId: string, counts: Record<CampaignEventType, number>) {
  const rows: { variantId: string; type: CampaignEventType; createdAt: Date }[] = [];
  for (const [type, count] of Object.entries(counts) as [CampaignEventType, number][]) {
    for (let i = 0; i < count; i++) {
      rows.push({ variantId, type, createdAt: randomDateWithinDays(14) });
    }
  }
  await prisma.campaignEvent.createMany({ data: rows });
}

const FIRST_NAMES = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Drew"];
const LAST_INITIALS = ["A", "B", "C", "D", "E", "F"];

function randomLead() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const initial = LAST_INITIALS[Math.floor(Math.random() * LAST_INITIALS.length)];
  const email = `${first.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`;
  return { name: `${first} ${initial}.`, email };
}

function blockInProduction() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

export async function POST() {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  const account = await prisma.account.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) {
    return Response.json({ error: "No account found — sign in once first." }, { status: 400 });
  }

  let website = await prisma.website.findFirst({ where: { accountId: account.id } });
  if (!website) {
    website = await prisma.website.create({
      data: { accountId: account.id, url: "demo-shop.com", installVerified: true, installVerifiedAt: new Date() },
    });
  }

  // Campaign 1 — active A/B test with a declared winner.
  const campaign1 = await prisma.campaign.create({
    data: {
      accountId: account.id,
      websiteId: website.id,
      name: "Spring Sale Popup",
      type: "WHEEL",
      status: "ACTIVE",
      variants: {
        create: [
          {
            name: "Control",
            isControl: true,
            trafficPercent: 50,
            design: {
              headline: "Spin to Win 20% Off!",
              body: "Give it a spin for an exclusive discount.",
              primaryColor: "#165DFF",
              ctaText: "Spin Now",
            },
            formFields: ["email"],
            targeting: { trigger: "exit_intent", delaySeconds: null },
            rewards: {
              create: [
                { label: "20% Off", type: "DISCOUNT_PERCENT", weight: 3 },
                { label: "10% Off", type: "DISCOUNT_PERCENT", weight: 2 },
                { label: "Free Shipping", type: "FREE_SHIPPING", weight: 1 },
              ],
            },
          },
          {
            name: "Variant B",
            isControl: false,
            trafficPercent: 50,
            design: {
              headline: "Win Big Savings Today!",
              body: "Try your luck for a special offer.",
              primaryColor: "#4a3aa7",
              ctaText: "Try Your Luck",
            },
            formFields: ["email"],
            targeting: { trigger: "exit_intent", delaySeconds: null },
            rewards: {
              create: [
                { label: "20% Off", type: "DISCOUNT_PERCENT", weight: 3 },
                { label: "10% Off", type: "DISCOUNT_PERCENT", weight: 2 },
                { label: "Free Shipping", type: "FREE_SHIPPING", weight: 1 },
              ],
            },
          },
        ],
      },
    },
    include: { variants: true },
  });

  const control1 = campaign1.variants.find((v) => v.isControl)!;
  const variantB1 = campaign1.variants.find((v) => !v.isControl)!;

  await prisma.campaign.update({
    where: { id: campaign1.id },
    data: { winningVariantId: control1.id },
  });

  await seedEvents(control1.id, {
    IMPRESSION: 2400,
    INTERACTION: 340,
    SUBMISSION: 96,
    DISMISSED: 0,
    GIFT_CLAIMED: 40,
  });
  await seedEvents(variantB1.id, {
    IMPRESSION: 2200,
    INTERACTION: 260,
    SUBMISSION: 61,
    DISMISSED: 0,
    GIFT_CLAIMED: 22,
  });

  for (let i = 0; i < 15; i++) {
    const variant = i % 2 === 0 ? control1 : variantB1;
    const { name, email } = randomLead();
    await prisma.lead.create({
      data: {
        variantId: variant.id,
        name,
        email,
        consentGiven: true,
        consentAt: randomDateWithinDays(14),
        rewardClaimedCode: i % 3 === 0 ? "SAVE20XY" : null,
        createdAt: randomDateWithinDays(14),
      },
    });
  }

  // Campaign 2 — active, single variant, no A/B test.
  const campaign2 = await prisma.campaign.create({
    data: {
      accountId: account.id,
      websiteId: website.id,
      name: "Exit Intent Discount",
      type: "FORM",
      status: "ACTIVE",
      variants: {
        create: [
          {
            name: "Control",
            isControl: true,
            trafficPercent: 100,
            design: {
              headline: "Wait! Get 15% Off",
              body: "Before you go, here's a discount just for you.",
              primaryColor: "#165DFF",
              ctaText: "Claim Discount",
            },
            formFields: ["email"],
            targeting: { trigger: "exit_intent", delaySeconds: null },
            rewards: { create: [{ label: "15% Off", type: "DISCOUNT_PERCENT", weight: 1 }] },
          },
        ],
      },
    },
    include: { variants: true },
  });

  const control2 = campaign2.variants[0];
  await seedEvents(control2.id, {
    IMPRESSION: 1800,
    INTERACTION: 210,
    SUBMISSION: 78,
    DISMISSED: 0,
    GIFT_CLAIMED: 78,
  });

  for (let i = 0; i < 10; i++) {
    const { name, email } = randomLead();
    await prisma.lead.create({
      data: {
        variantId: control2.id,
        name,
        email,
        consentGiven: true,
        consentAt: randomDateWithinDays(14),
        rewardClaimedCode: "WELCOME15",
        createdAt: randomDateWithinDays(14),
      },
    });
  }

  // Campaign 3 — paused A/B test, no winner yet.
  const campaign3 = await prisma.campaign.create({
    data: {
      accountId: account.id,
      websiteId: website.id,
      name: "Holiday Scratch Card",
      type: "SCRATCH_CARD",
      status: "PAUSED",
      variants: {
        create: [
          {
            name: "Control",
            isControl: true,
            trafficPercent: 50,
            design: {
              headline: "Scratch & Save",
              body: "Reveal your holiday discount.",
              primaryColor: "#165DFF",
              ctaText: "Scratch Now",
            },
            formFields: ["name", "email"],
            targeting: { trigger: "time_delay", delaySeconds: 8 },
            rewards: { create: [{ label: "25% Off", type: "DISCOUNT_PERCENT", weight: 1 }] },
          },
          {
            name: "Variant B",
            isControl: false,
            trafficPercent: 50,
            design: {
              headline: "Unwrap a Deal",
              body: "Scratch to reveal your surprise offer.",
              primaryColor: "#e34948",
              ctaText: "Reveal Offer",
            },
            formFields: ["name", "email"],
            targeting: { trigger: "time_delay", delaySeconds: 8 },
            rewards: { create: [{ label: "25% Off", type: "DISCOUNT_PERCENT", weight: 1 }] },
          },
        ],
      },
    },
    include: { variants: true },
  });

  const control3 = campaign3.variants.find((v) => v.isControl)!;
  const variantB3 = campaign3.variants.find((v) => !v.isControl)!;

  await seedEvents(control3.id, {
    IMPRESSION: 640,
    INTERACTION: 88,
    SUBMISSION: 21,
    DISMISSED: 0,
    GIFT_CLAIMED: 21,
  });
  await seedEvents(variantB3.id, {
    IMPRESSION: 600,
    INTERACTION: 70,
    SUBMISSION: 15,
    DISMISSED: 0,
    GIFT_CLAIMED: 15,
  });

  return Response.json({
    ok: true,
    website: website.url,
    campaigns: [campaign1.name, campaign2.name, campaign3.name],
  });
}

export async function DELETE() {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  const account = await prisma.account.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) {
    return Response.json({ error: "No account found" }, { status: 400 });
  }
  const { count } = await prisma.campaign.deleteMany({ where: { accountId: account.id } });
  return Response.json({ ok: true, deletedCampaigns: count });
}
