import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { TaskForm } from '@/components/hvac/TaskForm';

interface Props {
  params: Promise<{ workId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function NewWorkTaskPage({ params }: Props) {
  const { workId } = await params;
  const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true, name: true, code: true, color: true } }).catch(() => null);
  if (!work) notFound();

  return (
    <div className="max-w-xl">
      <div className="mb-1">
        <Link
          href={`/works/${workId}`}
          className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {work.name}
        </Link>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">New Task</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Task will be created in <span className="font-medium text-foreground">{work.name}</span> with 5 dependency checklists auto-populated.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mt-6 card-shadow">
        <TaskForm workId={work.id} />
      </div>
    </div>
  );
}
