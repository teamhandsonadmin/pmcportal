import { prisma } from '@/lib/prisma';
import { getAllBlockedDates } from '@/lib/utils/working-days';
import {
  computeProjectDelays,
  type DelayEngineTaskInput,
  type DelayEngineDependency,
  type TaskDelayInfo,
} from '@/lib/utils/delay-engine';

export interface GanttDelayData {
  delayById: Record<string, TaskDelayInfo>;
  // computeProjectDelays() tracks "groundedness" — whether a task's projected
  // dates trace back to any real date, its own or an inherited one — purely
  // as an internal Map, not part of TaskDelayInfo's return shape, and this
  // feature's own brief says not to modify that function. This mirrors that
  // exact same rule (same topological order, same hasOwnAnchor check) so the
  // Gantt chart can tell a genuinely-unscheduled task apart from one that's
  // legitimately on schedule, without touching lib/utils/delay-engine.ts.
  groundedIds: string[];
}

function computeGroundedIds(
  tasks: DelayEngineTaskInput[],
  dependencies: DelayEngineDependency[]
): Set<string> {
  const taskMap = new Map(tasks.map((t) => [t.taskId, t]));
  const prereqsOf = new Map<string, string[]>();
  const dependentsOf = new Map<string, string[]>();
  for (const t of tasks) {
    prereqsOf.set(t.taskId, []);
    dependentsOf.set(t.taskId, []);
  }
  for (const d of dependencies) {
    if (!taskMap.has(d.taskId) || !taskMap.has(d.dependsOnTaskId)) continue;
    prereqsOf.get(d.taskId)!.push(d.dependsOnTaskId);
    dependentsOf.get(d.dependsOnTaskId)!.push(d.taskId);
  }

  const inDegree = new Map<string, number>();
  for (const t of tasks) inDegree.set(t.taskId, prereqsOf.get(t.taskId)!.length);
  const order: string[] = [];
  const queue = tasks.map((t) => t.taskId).filter((id) => inDegree.get(id) === 0);
  while (queue.length > 0) {
    queue.sort();
    const id = queue.shift()!;
    order.push(id);
    for (const dependent of dependentsOf.get(id)!) {
      const next = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, next);
      if (next === 0) queue.push(dependent);
    }
  }
  // If this doesn't fully sort, computeProjectDelays() itself will throw
  // when it runs over the same input — no need to duplicate that check here.

  const grounded = new Map<string, boolean>();
  for (const taskId of order) {
    const task = taskMap.get(taskId)!;
    const hasOwnAnchor = !!(task.plannedStartDate || task.dueDate || task.actualStartDate || task.actualEndDate);
    const prereqIds = prereqsOf.get(taskId)!;
    grounded.set(taskId, hasOwnAnchor || prereqIds.some((p) => grounded.get(p)));
  }
  return new Set([...grounded.entries()].filter(([, g]) => g).map(([id]) => id));
}

// Computes the delay graph ONCE for the whole board (unlike
// getTaskScheduleImpact, which recomputes per-task on demand for the detail
// popup) — the Gantt chart needs every visible task's projected dates to
// draw bars, not just one task's.
export async function getGanttDelayData(): Promise<GanttDelayData> {
  const [tasks, deps] = await Promise.all([
    prisma.task.findMany({
      select: {
        id: true, plannedStartDate: true, dueDate: true,
        actualStartDate: true, actualEndDate: true, status: true,
      },
    }),
    prisma.taskDependency.findMany({ select: { taskId: true, dependsOnTaskId: true, type: true } }),
  ]);

  const years = new Set(
    tasks
      .flatMap((t) => [t.plannedStartDate, t.dueDate, t.actualStartDate, t.actualEndDate])
      .filter((d): d is Date => !!d)
      .map((d) => d.getUTCFullYear())
  );
  const blockedDates = new Set<string>();
  for (const year of years) {
    for (const d of await getAllBlockedDates(year)) blockedDates.add(d);
  }

  const engineTasks: DelayEngineTaskInput[] = tasks.map((t) => ({
    taskId: t.id,
    plannedStartDate: t.plannedStartDate,
    dueDate: t.dueDate,
    actualStartDate: t.actualStartDate,
    actualEndDate: t.actualEndDate,
    status: t.status,
  }));
  const engineDeps: DelayEngineDependency[] = deps.map((d) => ({
    taskId: d.taskId,
    dependsOnTaskId: d.dependsOnTaskId,
    type: d.type,
  }));

  const delays = computeProjectDelays(engineTasks, engineDeps, blockedDates, new Date());
  const groundedIds = computeGroundedIds(engineTasks, engineDeps);

  const delayById: Record<string, TaskDelayInfo> = {};
  for (const [id, info] of delays) delayById[id] = info;

  return { delayById, groundedIds: [...groundedIds] };
}
