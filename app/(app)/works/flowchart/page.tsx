import Link from 'next/link';
import { TasksExplorer } from '@/components/tasks/TasksExplorer';
import { getWorksData } from '@/lib/data/works';
import { getGanttDelayData } from '@/lib/data/gantt-delay';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ work?: string }>;
}

export default async function WorksFlowchartPage({ searchParams }: Props) {
  const [{ rows, edges, parallelEdges, works }, taskTypes, { delayById, groundedIds }] = await Promise.all([
    getWorksData(),
    prisma.taskType.findMany({ select: { id: true, name: true, defaultDurationDays: true }, orderBy: { name: 'asc' } }),
    getGanttDelayData(),
  ]);
  const { work } = await searchParams;
  const workOptions = works.map((w) => ({ id: w.id, name: w.name, code: w.code, color: w.color }));

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link
          href="/works"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          Tasks &amp; Works
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Flowchart</h1>
      </div>

      <TasksExplorer
        rows={rows}
        edges={edges}
        parallelEdges={parallelEdges}
        initialWork={work}
        works={workOptions}
        taskTypes={taskTypes}
        delayById={delayById}
        groundedIds={groundedIds}
      />
    </div>
  );
}
