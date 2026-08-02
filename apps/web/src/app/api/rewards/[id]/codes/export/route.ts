import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/rewards/[id]/codes/export">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const reward = await prisma.rewardRule.findFirst({
    where: { id, variant: { campaign: { accountId: account.id } } },
  });
  if (!reward) {
    return Response.json({ error: "Reward not found" }, { status: 404 });
  }

  const status = new URL(request.url).searchParams.get("status") ?? "all";
  const where =
    status === "used"
      ? { rewardRuleId: reward.id, usedAt: { not: null } }
      : status === "unused"
        ? { rewardRuleId: reward.id, usedAt: null }
        : { rewardRuleId: reward.id };

  const codes = await prisma.couponCode.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: { code: true, usedAt: true, leadId: true, createdAt: true },
  });

  const header = "code,status,used_at,lead_id,created_at";
  const rows = codes.map((c) =>
    [
      csvEscape(c.code),
      c.usedAt ? "used" : "unused",
      c.usedAt ? c.usedAt.toISOString() : "",
      c.leadId ?? "",
      c.createdAt.toISOString(),
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");

  const filename = `${reward.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "reward"}-codes-${status}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
