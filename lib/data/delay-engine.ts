import { prisma } from '@/lib/prisma';
import { getAllBlockedDates } from '@/lib/utils/working-days';
import {
  computeProjectDelays,
  type DelayEngineTaskInput,
  type DelayEngineDependency,
  type TaskDelayInfo,
} from '@/lib/utils/delay-engine';
import type { TaskStatus } from '@/lib/types/hvac';

export interface TaskRef {
  id: string;
  taskCode: string; // human-readable business ID, e.g. "HVAC-003"
  taskName: string;
}

export interface DownstreamImpact extends TaskRef {
  totalDelayDays: number;
}

export interface TaskScheduleImpact {
  // TaskDelayInfo.taskId is HvacTask.id (the UUID) — taskCode is the
  // human-readable business code (e.g. "HVAC-003") for display.
  self: TaskDelayInfo & {
    taskCode: string;
    taskName: string;
    plannedStartDate: Date | null;
    dueDate: Date | null;
    actualStartDate: Date | null;
    actualEndDate: Date | null;
    status: TaskStatus;
  };
  drivingPrerequisite: TaskRef | null;
  // Tasks for which this task is the drivingPrerequisiteTaskId — the most
  // direct answer to "if this task is delayed, how many days does it impact
  // that task". Straightforward to compute here since the whole project's
  // delay map is already built; sorted worst-impact-first.
  downstreamImpacted: DownstreamImpact[];
}

// Recomputes the delay graph for the ENTIRE project on every call — fine at
// today's ~100-task scale (a single in-memory pass over a plain array), but
// would need caching/memoization if the dataset grows an order of magnitude
// or this gets called from a hot path. Not attempted here — out of scope
// for this pass (see the prompt's non-goals: no dashboard-wide rollup yet).
export async function getTaskScheduleImpact(taskId: string): Promise<TaskScheduleImpact | null> {
  const [tasks, deps] = await Promise.all([
    prisma.hvacTask.findMany({
      select: {
        id: true, taskId: true, taskName: true, status: true,
        plannedStartDate: true, dueDate: true, actualStartDate: true, actualEndDate: true,
      },
    }),
    prisma.taskDependency.findMany({ select: { taskId: true, dependsOnTaskId: true } }),
  ]);

  const byId = new Map(tasks.map((t) => [t.id, t]));
  if (!byId.has(taskId)) return null;

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
  }));

  const delays = computeProjectDelays(engineTasks, engineDeps, blockedDates);
  const info = delays.get(taskId);
  if (!info) return null;

  const selfTask = byId.get(taskId)!;
  const toRef = (id: string): TaskRef => {
    const t = byId.get(id)!;
    return { id: t.id, taskCode: t.taskId, taskName: t.taskName };
  };

  const downstreamImpacted: DownstreamImpact[] = [...delays.entries()]
    .filter(([id, d]) => id !== taskId && d.drivingPrerequisiteTaskId === taskId)
    .map(([id, d]) => ({ ...toRef(id), totalDelayDays: d.totalDelayDays }))
    .sort((a, b) => b.totalDelayDays - a.totalDelayDays);

  return {
    self: {
      ...info,
      taskCode: selfTask.taskId,
      taskName: selfTask.taskName,
      plannedStartDate: selfTask.plannedStartDate,
      dueDate: selfTask.dueDate,
      actualStartDate: selfTask.actualStartDate,
      actualEndDate: selfTask.actualEndDate,
      status: selfTask.status,
    },
    drivingPrerequisite: info.drivingPrerequisiteTaskId ? toRef(info.drivingPrerequisiteTaskId) : null,
    downstreamImpacted,
  };
}
