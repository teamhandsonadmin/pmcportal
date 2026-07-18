import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // Capped well below pg.Pool's own default (10) — in a serverless deployment
  // each concurrent function instance gets its OWN pool via this same
  // factory, so a handful of concurrent requests can otherwise multiply out
  // to way more real backend connections than the pooler in front of it
  // actually has room for (this is exactly what took the whole app down:
  // DATABASE_URL used Supabase's session-mode pooler, hard-capped at 15
  // total connections project-wide, and even a few concurrent instances at
  // the default max easily blew through that). Switching DATABASE_URL to
  // the transaction-mode pooler (port 6543, see .env.local) is the real fix
  // for serverless — this cap is a second line of defense on top of that,
  // not a substitute for it.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
