import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY_MS);

const TEMPLATE_DEFAULTS = {
  architect: ['Design Intent', '2D Autocad Plan', '3D Renders', 'GFC Drawings', 'Specifications', 'Material Selection'],
  client: ['Design Approval', 'Material Approval', 'Equipment Approval', 'Payment Clearances', 'Contract Approach'],
  consultant: ['Technical Drawing', 'Specification', 'Vendor Suggestion', 'Quality List', 'Estimated Cost'],
  contractor: ['Manpower', 'Deadlines', 'Quality of Work', 'Mockup on Site'],
} as const;

const CATEGORIES = Object.keys(TEMPLATE_DEFAULTS) as (keyof typeof TEMPLATE_DEFAULTS)[];

async function seedTemplate() {
  const existing = await prisma.dependencyTemplateItem.count();
  if (existing > 0) {
    console.log('Dependency template already seeded, skipping.');
    return;
  }
  for (const category of CATEGORIES) {
    await prisma.dependencyTemplateItem.createMany({
      data: TEMPLATE_DEFAULTS[category].map((label, idx) => ({ category, label, sortOrder: idx })),
    });
  }
  console.log('Seeded dependency template items.');
}

async function seedUsers() {
  const specs = [
    { fullName: 'Priya Ramesh', email: 'priya.ramesh@example.com', role: 'senior_site_engineer' as const, phone: '+91 98765 43210' },
    { fullName: 'Arjun Kumar', email: 'arjun.kumar@example.com', role: 'site_engineer' as const, phone: '+91 98765 43211' },
    { fullName: 'Meera Nair', email: 'meera.nair@example.com', role: 'site_engineer' as const, phone: '+91 98765 43212' },
  ];
  const users = [];
  for (const u of specs) {
    const user = await prisma.userProfile.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, phone: u.phone, status: 'active', isActive: true },
      create: { ...u, status: 'active', isActive: true },
    });
    users.push(user);
  }
  console.log(`Seeded ${users.length} users.`);
  return users;
}

async function seedProjectAndWorks() {
  let project = await prisma.project.findFirst({ where: { name: 'ABC Villa Construction' } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'ABC Villa Construction',
        address: '14 Palm Grove Avenue, Bengaluru',
        area: '4,200 sq.ft',
        budget: '₹2.4 Cr',
      },
    });
    console.log(`Created project: ${project.name}`);
  } else {
    console.log('Demo project already exists — reusing it (works/tasks below have their own idempotency checks, so this no longer skips them).');
  }

  const workSpecs = [
    { name: 'HVAC', code: 'HVAC', color: '#6366F1', description: 'Heating, Ventilation & Air Conditioning works' },
    { name: 'Electrical', code: 'ELEC', color: '#F59E0B', description: 'Electrical conduit, wiring and fixtures' },
    { name: 'Plumbing', code: 'PLUM', color: '#06B6D4', description: 'CPVC/PVC piping and sanitary fittings' },
    { name: 'Civil Works', code: 'CIVIL', color: '#6B7280', description: 'Masonry, plastering and structural finishing' },
    { name: 'Flooring', code: 'FLOOR', color: '#F97316', description: 'Tiling, marble and floor protection' },
  ];

  const works = [];
  for (const w of workSpecs) {
    const work = await prisma.work.upsert({
      where: { code: w.code },
      update: { name: w.name, color: w.color, description: w.description, projectId: project.id },
      create: { ...w, projectId: project.id },
    });
    works.push(work);
  }
  console.log(`Seeded ${works.length} works under ${project.name}.`);
  return { project, works };
}

interface TaskSpec {
  name: string;
  plannedStartDate: Date;
  dueDate: Date;
  assigneeId: string | null;
  deliveredCategoryCount: number; // 0-5, how many of the 5 categories are fully delivered
  finalStatus: 'blocked' | 'ready' | 'in_progress' | 'on_hold' | 'completed';
}

let taskCounter = 1;
const FORECAST_HISTORY_DAYS = 10;

async function seedTask(projectName: string, workId: string, workCode: string, spec: TaskSpec) {
  const templateItems = await prisma.dependencyTemplateItem.findMany({ orderBy: { sortOrder: 'asc' } });

  const task = await prisma.hvacTask.create({
    data: {
      taskId: `${workCode}-${String(taskCounter++).padStart(3, '0')}`,
      taskName: spec.name,
      projectName,
      status: 'draft',
      plannedStartDate: spec.plannedStartDate,
      dueDate: spec.dueDate,
      assignedTo: spec.assigneeId,
      workId,
    },
  });

  await prisma.dependencyItem.createMany({
    data: templateItems.map((ti) => ({
      taskId: task.id,
      category: ti.category,
      itemLabel: ti.label,
      sortOrder: ti.sortOrder,
    })),
  });

  const items = await prisma.dependencyItem.findMany({ where: { taskId: task.id } });
  const categoriesToDeliver = CATEGORIES.slice(0, spec.deliveredCategoryCount);

  let deliveredIdx = 0;
  for (const item of items) {
    if (!categoriesToDeliver.includes(item.category as (typeof CATEGORIES)[number])) continue;
    await prisma.dependencyCompletion.create({
      data: {
        itemId: item.id,
        status: 'YES',
        completedAt: daysAgo(deliveredIdx % FORECAST_HISTORY_DAYS),
      },
    });
    deliveredIdx++;
  }

  await prisma.activityLog.create({
    data: { taskId: task.id, actionType: 'task_created', payload: { taskId: task.taskId } },
  });

  // Advance status beyond the DB trigger's auto-computed state where the task
  // is meant to represent further progress (in_progress / on_hold / completed).
  if (spec.finalStatus === 'in_progress' || spec.finalStatus === 'on_hold' || spec.finalStatus === 'completed') {
    await prisma.hvacTask.update({ where: { id: task.id }, data: { status: spec.finalStatus } });
    await prisma.activityLog.create({
      data: { taskId: task.id, actionType: 'status_change', payload: { from: 'ready', to: spec.finalStatus } },
    });
  }

  return task;
}

async function seedTasks(project: { name: string }, works: { id: string; code: string }[], users: { id: string }[]) {
  const existingTasks = await prisma.hvacTask.count();
  if (existingTasks > 3) {
    console.log('Tasks already seeded, skipping.');
    return;
  }

  const [eng1, eng2, eng3] = users;
  const byCode = new Map(works.map((w) => [w.code, w]));

  const plans: Record<string, TaskSpec[]> = {
    HVAC: [
      { name: 'AC Units Level Marking', plannedStartDate: daysAgo(20), dueDate: daysAgo(10), assigneeId: eng1?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'completed' },
      { name: 'HVAC Refrigerant Piping', plannedStartDate: daysAgo(8), dueDate: daysFromNow(4), assigneeId: eng2?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'in_progress' },
      { name: 'HVAC Drain Outlet Pipe Routing', plannedStartDate: daysFromNow(2), dueDate: daysAgo(2), assigneeId: eng3?.id ?? null, deliveredCategoryCount: 2, finalStatus: 'blocked' },
    ],
    ELEC: [
      { name: 'Ceiling Electrical Conduit Marking', plannedStartDate: daysAgo(15), dueDate: daysAgo(5), assigneeId: eng1?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'completed' },
      { name: 'Wall Electrical Conduit & Back Box Fixing', plannedStartDate: daysAgo(3), dueDate: daysFromNow(6), assigneeId: eng2?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'in_progress' },
      { name: 'Ceiling Down Lights Fixing', plannedStartDate: daysFromNow(5), dueDate: daysFromNow(15), assigneeId: null, deliveredCategoryCount: 0, finalStatus: 'blocked' },
    ],
    PLUM: [
      { name: 'CPVC & PVC Pipe Level Marking', plannedStartDate: daysAgo(18), dueDate: daysAgo(8), assigneeId: eng3?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'completed' },
      { name: 'Water Pressure Testing', plannedStartDate: daysAgo(1), dueDate: daysFromNow(3), assigneeId: eng1?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'ready' },
      { name: 'Toilet Plumbing Pipes & Ledge Wall Plastering', plannedStartDate: daysAgo(5), dueDate: daysAgo(1), assigneeId: eng2?.id ?? null, deliveredCategoryCount: 3, finalStatus: 'blocked' },
    ],
    CIVIL: [
      { name: 'Terrace/Balcony Debris Cleaning', plannedStartDate: daysAgo(6), dueDate: daysFromNow(2), assigneeId: eng2?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'in_progress' },
      { name: 'Sunken Filling', plannedStartDate: daysFromNow(1), dueDate: daysFromNow(10), assigneeId: eng3?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'ready' },
      { name: 'Toilet Floor Tile Laying', plannedStartDate: daysFromNow(8), dueDate: daysFromNow(18), assigneeId: null, deliveredCategoryCount: 1, finalStatus: 'blocked' },
    ],
    FLOOR: [
      { name: 'Tile Bull Marking', plannedStartDate: daysAgo(4), dueDate: daysFromNow(5), assigneeId: eng1?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'on_hold' },
      { name: 'Internal Marble Flooring', plannedStartDate: daysFromNow(3), dueDate: daysFromNow(12), assigneeId: eng2?.id ?? null, deliveredCategoryCount: 5, finalStatus: 'ready' },
      { name: 'Marble Polishing', plannedStartDate: daysFromNow(12), dueDate: daysFromNow(22), assigneeId: null, deliveredCategoryCount: 0, finalStatus: 'blocked' },
    ],
  };

  let created = 0;
  for (const [code, tasks] of Object.entries(plans)) {
    const work = byCode.get(code);
    if (!work) continue;
    for (const spec of tasks) {
      await seedTask(project.name, work.id, code, spec);
      created++;
    }
  }
  console.log(`Seeded ${created} demo tasks with dependency checklists.`);
}

async function main() {
  await seedTemplate();

  const hvac = await prisma.work.upsert({
    where: { code: 'HVAC' },
    update: { name: 'HVAC', color: '#6366F1' },
    create: { name: 'HVAC', code: 'HVAC', description: 'Heating, Ventilation & Air Conditioning works', color: '#6366F1' },
  });
  const updated = await prisma.hvacTask.updateMany({ where: { workId: null }, data: { workId: hvac.id } });
  console.log(`Linked ${updated.count} pre-existing task(s) to HVAC work.`);

  const users = await seedUsers();
  const { project, works } = await seedProjectAndWorks();
  if (works) {
    await seedTasks(project, works, users);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
