import { prisma } from "@/lib/prisma";
import { getEmbeddedAccount } from "@/lib/shopify/embeddedAuth";

// Embedded admin — the shop's captured leads. Required by App Store rule 5.1.5:
// customer data collected by the app must be accessible to the merchant. A
// Shopify-only merchant never signs into the Clerk web dashboard, so this is
// their sole window onto the emails/phones their popups captured. Authed by the
// shop session (getEmbeddedAccount), same as every /api/shopify/admin/* route.
//
// GET            -> JSON list for the in-app table.
// GET ?format=csv -> CSV download (fetched with the App Bridge token, then
//                    turned into a client-side blob download by the embedded UI).

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  rewardClaimedCode: string | null;
  createdAt: Date;
  becameCustomerAt: Date | null;
  variant: { campaign: { name: string } };
}

export async function GET(request: Request): Promise<Response> {
  const account = await getEmbeddedAccount(request);
  if (!account) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const leads: LeadRow[] = await prisma.lead.findMany({
    where: { variant: { campaign: { accountId: account.id } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      rewardClaimedCode: true,
      createdAt: true,
      becameCustomerAt: true,
      variant: { select: { campaign: { select: { name: true } } } },
    },
  });

  if (new URL(request.url).searchParams.get("format") === "csv") {
    const header = ["Name", "Email", "Phone", "Campaign", "Reward Code", "Became Customer", "Created At"];
    const rows = leads.map((l) => [
      l.name ?? "",
      l.email ?? "",
      l.phone ?? "",
      l.variant.campaign.name,
      l.rewardClaimedCode ?? "",
      l.becameCustomerAt ? "yes" : "",
      l.createdAt.toISOString(),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => csvField(String(cell))).join(","))
      .join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="asmos-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return Response.json({
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      campaignName: l.variant.campaign.name,
      isCustomer: l.becameCustomerAt != null,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
