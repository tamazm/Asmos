const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- LATEST CAMPAIGN ---');
  const campaign = await prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 1, include: { variants: true } });
  console.log(JSON.stringify(campaign, null, 2));

  console.log('\n--- LATEST SYSTEM LOG ---');
  const logs = await prisma.systemLog.findMany({ orderBy: { createdAt: 'desc' }, take: 2 });
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
