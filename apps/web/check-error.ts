import { prisma } from './src/lib/prisma';
async function main() {
  const log = await prisma.systemLog.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log('LATEST SYSTEM LOG:', log);
  const campaign = await prisma.campaign.findFirst({ where: { status: 'FAILED' }, orderBy: { updatedAt: 'desc' } });
  console.log('LATEST FAILED CAMPAIGN ERROR:', campaign?.lastError);
}
main().catch(console.error).finally(() => process.exit(0));
