import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hvac = await prisma.work.upsert({
    where: { code: 'HVAC' },
    update: { name: 'HVAC', color: '#6366F1' },
    create: {
      name: 'HVAC',
      code: 'HVAC',
      description: 'Heating, Ventilation & Air Conditioning works',
      color: '#6366F1',
    },
  });

  const updated = await prisma.hvacTask.updateMany({
    where: { workId: null },
    data: { workId: hvac.id },
  });

  console.log(`Seeded HVAC work (id: ${hvac.id})`);
  console.log(`Linked ${updated.count} existing tasks to HVAC work`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
