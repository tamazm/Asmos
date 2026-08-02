import { prisma } from './src/lib/prisma';

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: "GENERATING" },
    include: { variants: true }
  });
  console.log("Generating campaigns:", JSON.stringify(campaigns, null, 2));

  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Recent System Logs:", JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
