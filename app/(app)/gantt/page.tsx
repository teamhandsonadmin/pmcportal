import { getWorksData } from '@/lib/data/works';
import { getGanttDelayData } from '@/lib/data/gantt-delay';
import { GanttBoard } from '@/components/gantt/GanttBoard';

export const dynamic = 'force-dynamic';

export default async function GanttPage() {
  const [{ rows }, { delayById, groundedIds }] = await Promise.all([
    getWorksData(),
    getGanttDelayData(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Gantt Chart</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Planned vs. projected schedule across {rows.length} task{rows.length === 1 ? '' : 's'}, grouped by trade.
        </p>
      </div>

      <GanttBoard rows={rows} delayById={delayById} groundedIds={groundedIds} />
    </div>
  );
}
