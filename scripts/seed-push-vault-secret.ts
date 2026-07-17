import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SECRET_NAME = 'push_edge_function_key';

async function main() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set in env');

  const existing = await prisma.$queryRawUnsafe<any[]>(
    `select id from vault.secrets where name = $1`,
    SECRET_NAME
  );

  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `select vault.update_secret($1::uuid, $2)`,
      existing[0].id,
      key
    );
    console.log('Updated existing vault secret:', SECRET_NAME);
  } else {
    await prisma.$executeRawUnsafe(
      `select vault.create_secret($1, $2, 'service-role key used by the push-notification trigger to call the Edge Function')`,
      key,
      SECRET_NAME
    );
    console.log('Created vault secret:', SECRET_NAME);
  }

  const check = await prisma.$queryRawUnsafe<any[]>(
    `select name::text, length(decrypted_secret) as len from vault.decrypted_secrets where name = $1`,
    SECRET_NAME
  );
  console.log('Verify (name + secret length only, not the value):', JSON.stringify(check));
}

main().finally(() => pool.end());
