import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import {
  MAX_CODES_PER_GENERATE_REQUEST,
  MAX_CODES_PER_IMPORT_REQUEST,
  MAX_COUPON_CODES_PER_ACCOUNT,
} from "@/lib/limits";

async function findOwnedReward(rewardId: string, accountId: string) {
  return prisma.rewardRule.findFirst({
    where: { id: rewardId, campaign: { accountId } },
  });
}

function randomCode(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return prefix ? `${prefix}-${suffix}` : suffix;
}

// Lists codes for the "manage codes" batch-select panel on the rewards
// page. Capped at 500 per request — this is a management UI, not the CSV
// export (which streams all of them via codes/export/route.ts).
export async function GET(
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
    take: 500,
    select: { id: true, code: true, usedAt: true, createdAt: true },
  });
  const total = await prisma.couponCode.count({ where: { rewardRuleId: reward.id } });

  return Response.json({ codes, total, truncated: total > codes.length });
}

// Batch removal — either specific code ids, or a bulk "clear all unused"
// sweep. Deleting a used code is allowed too (it's just historical
// bookkeeping at that point; the lead's claimed code text is preserved on
// the Lead row regardless via rewardClaimedCode).
export async function DELETE(
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
    codeIds?: string[];
    mode?: "unused";
  };

  if (body.mode === "unused") {
    const result = await prisma.couponCode.deleteMany({
      where: { rewardRuleId: reward.id, usedAt: null },
    });
    return Response.json({ deleted: result.count });
  }

  const ids = Array.isArray(body.codeIds) ? body.codeIds.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) {
    return Response.json({ error: "Provide codeIds or mode: 'unused'" }, { status: 400 });
  }
  const result = await prisma.couponCode.deleteMany({
    where: { id: { in: ids }, rewardRuleId: reward.id },
  });
  return Response.json({ deleted: result.count });
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

  // Per-tier request-size caps replace the old flat 1000/5000 limits — see
  // lib/limits.ts for why a single flat cap wasn't enough (it bounded one
  // request, but nothing stopped unbounded repeated requests from piling up
  // an unlimited total). The frontend mirrors these for UX, but this check
  // is the one that actually matters — the frontend's is just to avoid a
  // wasted round trip for an obviously-oversized request.
  const generateCap = MAX_CODES_PER_GENERATE_REQUEST[account.planTier] ?? 25;
  const importCap = MAX_CODES_PER_IMPORT_REQUEST[account.planTier] ?? 100;

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
    if (codesToCreate.length > importCap) {
      return Response.json(
        { error: `Import is limited to ${importCap.toLocaleString()} codes at a time on the ${account.planTier} plan.` },
        { status: 400 },
      );
    }
  } else if (body.mode === "generate") {
    const count = Math.floor(Number(body.count));
    if (!Number.isFinite(count) || count < 1 || count > generateCap) {
      return Response.json(
        { error: `count must be between 1 and ${generateCap.toLocaleString()} on the ${account.planTier} plan.` },
        { status: 400 },
      );
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

  // Account-wide total cap: bounds outstanding code liability regardless of
  // how many separate generate/import requests (or reward rules) someone
  // uses to get there.
  const totalCap = MAX_COUPON_CODES_PER_ACCOUNT[account.planTier] ?? 100;
  const existingTotal = await prisma.couponCode.count({
    where: { rewardRule: { campaign: { accountId: account.id } } },
  });
  const remaining = totalCap - existingTotal;
  if (remaining <= 0) {
    return Response.json(
      {
        error: `This account has reached its ${totalCap.toLocaleString()}-code limit on the ${account.planTier} plan. Delete unused codes or upgrade to add more.`,
      },
      { status: 400 },
    );
  }
  if (codesToCreate.length > remaining) {
    return Response.json(
      {
        error: `Only ${remaining.toLocaleString()} more code(s) can be added on the ${account.planTier} plan (limit ${totalCap.toLocaleString()} total, ${existingTotal.toLocaleString()} already exist). Reduce the count or upgrade.`,
      },
      { status: 400 },
    );
  }

  const result = await prisma.couponCode.createMany({
    data: codesToCreate.map((code) => ({ rewardRuleId: reward.id, code })),
    skipDuplicates: true,
  });

  return Response.json({ created: result.count, requested: codesToCreate.length });
}
