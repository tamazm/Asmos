import { prisma } from './src/lib/prisma';

async function main() {
  await prisma.campaign.updateMany({
    where: { status: 'GENERATING' },
    data: { status: 'DRAFT' } // Reset to DRAFT so it can be retried
  });
  console.log('Reset stuck campaigns to DRAFT');
}

main().catch(console.error).finally(() => prisma.$disconnect());
