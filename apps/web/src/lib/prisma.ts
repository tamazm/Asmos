import { PrismaClient } from ".prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// max defaults to 10 in node-postgres. On Vercel, each serverless function
// instance is effectively single-concurrency - it only ever runs a handful
// of queries at once (e.g. one Promise.all in a page's data fetch) - so a
// pool of 10 just reserves 10 Postgres connections per instance for work
// that needs 2-3. Under a handful of concurrent users hitting different
// routes (= different function instances warming up), that adds up fast
// against a free-tier Postgres connection cap and produces exactly the
// intermittent "Error in Server Components render" / self-resolving-on-retry
// symptom this was causing. Keep this small; raise only with a measured need.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Cache on globalThis in every environment, not just dev - a warm serverless
// instance reuses this module's exports across invocations, so recreating
// the pool here would only matter on true cold start regardless, but caching
// unconditionally also protects against Next.js re-evaluating this module
// more than once per instance (e.g. across separate route bundles) and
// quietly opening a second pool.
globalForPrisma.prisma = prisma;
