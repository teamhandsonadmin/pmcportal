import { prisma } from '@/lib/prisma';
import { DependencyTemplateEditor } from '@/components/tasks/DependencyTemplateEditor';

export const dynamic = 'force-dynamic';

export default async function DependencyTemplatesPage() {
  const [items, projects] = await Promise.all([
    prisma.dependencyTemplateItem.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return <DependencyTemplateEditor items={items} projects={projects} />;
}
