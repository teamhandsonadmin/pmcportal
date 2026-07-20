import { prisma } from '@/lib/prisma';

export interface WorkSftBreakdown {
  workId: string;
  workName: string;
  workCode: string;
  workColor: string;
  completed: number;
  target: number | null;
  percentage: number | null; // null when this Work's tasks have no totalSft set at all
}

export interface ProjectSftProgress {
  completed: number;
  target: number | null; // null when Project.totalSft is unset — "no target set", not 0
  percentage: number | null; // null when target is null; never divides by zero
  byWork: WorkSftBreakdown[];
}

// Task has no direct projectId of its own — the only path from a task to
// its project is task.work.projectId, confirmed against prisma/schema.prisma
// before writing this (Work.projectId -> Project, Task.workId -> Work).
// SftProgressEntry.sftCompleted is additive (see the model's own doc
// comment) — summing every entry for every task under every Work in this
// project is the correct "completed so far" figure, the same join path
// already used ad hoc on the project dashboard page before this function
// existed.
export async function getProjectSftProgress(projectId: string): Promise<ProjectSftProgress> {
  const [project, works, sftAgg] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { totalSft: true } }),
    prisma.work.findMany({
      where: { projectId },
      select: { id: true, name: true, code: true, color: true },
    }),
    prisma.sftProgressEntry.aggregate({
      where: { task: { work: { projectId } } },
      _sum: { sftCompleted: true },
    }),
  ]);

  const completed = sftAgg._sum.sftCompleted != null ? Number(sftAgg._sum.sftCompleted) : 0;
  const target = project?.totalSft != null ? Number(project.totalSft) : null;
  const percentage = target != null && target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : null;

  // Per-Work breakdown — cheap to add given the aggregate query above just
  // needs to be grouped by Work instead of collapsed to one project-wide
  // sum. Each Work's own "target" is the sum of its tasks' individual
  // totalSft values (there's no per-Work target field in the schema, only
  // per-task and per-project) — a reasonable, already-established proxy,
  // matching what the project dashboard used before Project.totalSft existed.
  const byWork: WorkSftBreakdown[] = await Promise.all(
    works.map(async (w) => {
      const [workSftAgg, tasks] = await Promise.all([
        prisma.sftProgressEntry.aggregate({
          where: { task: { workId: w.id } },
          _sum: { sftCompleted: true },
        }),
        prisma.task.findMany({ where: { workId: w.id }, select: { totalSft: true } }),
      ]);
      const workCompleted = workSftAgg._sum.sftCompleted != null ? Number(workSftAgg._sum.sftCompleted) : 0;
      const workTargetSum = tasks.reduce((s, t) => s + (t.totalSft != null ? Number(t.totalSft) : 0), 0);
      const workTarget = workTargetSum > 0 ? workTargetSum : null;
      const workPct = workTarget != null ? Math.min(100, Math.round((workCompleted / workTarget) * 100)) : null;
      return {
        workId: w.id,
        workName: w.name,
        workCode: w.code,
        workColor: w.color,
        completed: workCompleted,
        target: workTarget,
        percentage: workPct,
      };
    })
  );

  return { completed, target, percentage, byWork };
}
