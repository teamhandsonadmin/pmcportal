import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Topbar } from '@/components/layout/Topbar';
import { WorkForm } from '@/components/works/WorkForm';

async function getProject(id: string) {
  try {
    return await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } });
  } catch {
    return null;
  }
}

export default async function NewWorkForProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  return (
    <div>
      <Topbar
        title="Add Work"
        breadcrumb={[
          { label: 'Projects', href: '/projects' },
          { label: project.name, href: `/projects/${project.id}` },
          { label: 'New Work' },
        ]}
      />
      <div className="bg-card border border-border rounded-xl p-6 max-w-lg card-shadow">
        <p className="text-[13px] text-muted-foreground mb-6">
          Adding a work to <strong>{project.name}</strong>. Works group related tasks with 5 dependency checklists each.
        </p>
        <WorkForm projectId={project.id} />
      </div>
    </div>
  );
}
