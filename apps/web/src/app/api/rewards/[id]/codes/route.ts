import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

async function findOwnedReward(rewardId: string, accountId: string) {
  return prisma.rewardRule.findFirst({
    where: { id: rewardId, variant: { campaign: { accountId } } },
  });
}

function randomCode(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return prefix ? `${prefix}-${suffix}` : suffix;
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/rewards/[id]/codes">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const reward = await findOwnedReward(id, account.id);
  if (!reward) {
    return Response.json({ error: "Reward not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "import" | "generate";
    codes?: string[];
    prefix?: string;
    count?: number;
  };

  let codesToCreate: string[] = [];

  if (body.mode === "import") {
    const raw = Array.isArray(body.codes) ? body.codes : [];
    codesToCreate = Array.from(
      new Set(
        raw
          .map((c) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
          .filter((c) => c.length > 0),
      ),
    );
    if (codesToCreate.length === 0) {
      return Response.json({ error: "No valid codes found to import" }, { status: 400 });
    }
    if (codesToCreate.length > 5000) {
      return Response.json({ error: "Import is limited to 5,000 codes at a time" }, { status: 400 });
    }
  } else if (body.mode === "generate") {
    const count = Math.floor(Number(body.count));
    if (!Number.isFinite(count) || count < 1 || count > 1000) {
      return Response.json({ error: "count must be between 1 and 1000" }, { status: 400 });
    }
    const prefix = (body.prefix ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const generated = new Set<string>();
    while (generated.size < count) {
      generated.add(randomCode(prefix));
    }
    codesToCreate = Array.from(generated);
  } else {
    return Response.json({ error: "mode must be 'import' or 'generate'" }, { status: 400 });
  }

  const result = await prisma.couponCode.createMany({
    data: codesToCreate.map((code) => ({ rewardRuleId: reward.id, code })),
    skipDuplicates: true,
  });

  return Response.json({ created: result.count, requested: codesToCreate.length });
}
