"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function uploadCoupons(rewardId: string, codes: string[]) {
  const reward = await prisma.rewardRule.findUnique({
    where: { id: rewardId }
  });
  if (!reward) throw new Error("Reward not found");

  const data = codes.map((code) => ({
    rewardRuleId: rewardId,
    code: code
  }));

  await prisma.coupon.createMany({
    data: data,
    skipDuplicates: true
  });

  revalidatePath("/rewards");
}

export async function exportCoupons(rewardId: string): Promise<string> {
  const coupons = await prisma.coupon.findMany({
    where: { rewardRuleId: rewardId },
    orderBy: { createdAt: "desc" }
  });

  if (coupons.length === 0) return "";

  const header = "Code,Used,UsedAt,UsedByEmail,CreatedAt\n";
  const rows = coupons.map((c: any) => {
    return `${c.code},${c.isUsed ? "Yes" : "No"},${c.usedAt ? c.usedAt.toISOString() : ""},${c.usedByEmail || ""},${c.createdAt.toISOString()}`;
  });

  return header + rows.join("\n");
}
