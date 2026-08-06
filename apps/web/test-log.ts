import { prisma } from './src/lib/prisma';
async function main() {
  const logs = await prisma.systemLog.findMany({ orderBy: { createdAt: 'desc' }, take: 3 });
  console.log('LATEST SYSTEM LOGS:', logs);
}
main();
