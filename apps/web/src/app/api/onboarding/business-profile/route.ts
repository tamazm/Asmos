import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { industry, name, role, conversionGoal, monthlyTraffic, emailPlatform } = (await request.json()) as {
    industry?: string;
    name?: string;
    role?: string;
    conversionGoal?: string;
    monthlyTraffic?: string;
    emailPlatform?: string;
  };

  const account = await getOrCreateAccount();
  const updated = await prisma.account.update({
    where: { id: account.id },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      industry: industry?.trim() || null,
      ...(role?.trim() ? { ownerRole: role.trim() } : {}),
      ...(conversionGoal?.trim() ? { conversionGoal: conversionGoal.trim() } : {}),
      ...(monthlyTraffic?.trim() ? { monthlyTraffic: monthlyTraffic.trim() } : {}),
      ...(emailPlatform?.trim() ? { emailPlatform: emailPlatform.trim() } : {}),
    },
  });

  return Response.json({
    account: { industry: updated.industry },
  });
}
