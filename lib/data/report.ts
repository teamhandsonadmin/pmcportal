import { prisma } from '@/lib/prisma';
import { format, differenceInCalendarDays, addDays, startOfDay } from 'date-fns';
import { getProjectSftProgress, type ProjectSftProgress } from '@/lib/data/sft';
import { classifyTaskStatus, type ProgressBucket } from '@/lib/utils/progress-bucket';

export interface ReportProgressBreakdown {
  completed: number;
  inProgress: number;
  notStarted: number;
  total: number;
  completedPct: number;
  inProgressPct: number;
  notStartedPct: number;
}

export interface ReportUpcomingTask {
  id: string;
  taskName: string;
  workName: string;
  dateLabel: string;
}

export interface ReportGanttTask {
  id: string;
  taskName: string;
  plannedStartDate: Date | null;
  dueDate: Date | null;
  bucket: ProgressBucket;
  // Not completed AND past its own dueDate — same rule the schedule
  // summary's delayedDays uses (see ReportScheduleSummary), just at the
  // per-task level so the report's Timeline can flag exactly which bars are
  // the reason the project is behind, not just the aggregate day-count.
  isOverdue: boolean;
  overdueDays: number;
}

export interface ReportGanttWork {
  workId: string;
  workName: string;
  workColor: string;
  tasks: ReportGanttTask[];
}

export interface ReportWorkBreakdown {
  workId: string;
  workName: string;
  workColor: string;
  completed: number;
  inProgress: number;
  notStarted: number;
  total: number;
  completedPct: number;
  inProgressPct: number;
  notStartedPct: number;
}

// A simple rollup — NOT the working-day/CPM figures from
// lib/utils/delay-engine.ts (that engine is built for the internal Gantt's
// per-task dependency-chain projections, a different, more detailed
// question). plannedDays/actualDays are whole-project spans (planned total
// duration vs calendar days actually elapsed); delayedDays is NOT their
// difference — it's the largest gap between today and any not-yet-completed
// task's own dueDate, i.e. real per-task lateness, not "has the whole
// project run over its whole schedule yet" (see getProjectReportData's own
// comment for why that distinction matters). null when the (possibly
// date-filtered) task set has no dates to anchor to at all.
export interface ReportScheduleSummary {
  plannedDays: number;
  actualDays: number;
  delayedDays: number;
  // The original commitment vs. where completion actually lands given the
  // current slippage — plannedEndDate is the latest dueDate on record;
  // projectedEndDate is that same date pushed out by delayedDays (0 shift
  // when nothing's overdue, so it just equals plannedEndDate). This is what
  // actually answers "the project is delayed by how much, and when will it
  // really finish" — the day-count alone doesn't say what date that lands on.
  plannedEndDate: Date;
  projectedEndDate: Date;
}

export interface ReportDateRange {
  from: Date;
  to: Date;
}

export interface ProjectReportData {
  projectId: string;
  projectName: string;
  asOfLabel: string;
  rangeLabel: string | null;
  // Which Work this report was generated for, or null for the whole project
  // (every Work combined) — set from the `work` query param, distinct from
  // rangeLabel's date scoping so the header can show both independently
  // ("Civil Works — Jul 8 to Jul 17" vs. just one or the other).
  scopedWorkName: string | null;
  progress: ReportProgressBreakdown;
  overdueCount: number;
  workBreakdown: ReportWorkBreakdown[];
  schedule: ReportScheduleSummary | null;
  sft: ProjectSftProgress | null;
  upcoming: ReportUpcomingTask[];
  ganttWorks: ReportGanttWork[];
  reportSentAt: Date | null;
}

// Largest-remainder rounding — three independent Math.round() calls can sum
// to 99 or 101 (e.g. 1/3, 1/3, 1/3), and a client-facing percentage
// breakdown must sum to exactly 100.
function roundToHundred(counts: number[]): number[] {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const floors = raw.map(Math.floor);
  const remainder = 100 - floors.reduce((s, f) => s + f, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].i] += 1;
  }
  return result;
}

// Exported for reuse by lib/data/notifications.ts's own upcoming-tasks
// query — same plain-language date phrasing, one place to change it.
export function upcomingDateLabel(date: Date, today: Date): string {
  const days = differenceInCalendarDays(date, today);
  if (days === 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  if (days <= 7) return `Starts in ${days} days`;
  return `Starts ${format(date, 'MMMM d')}`;
}

// Everything a client progress report needs, in one query pass — deliberately
// NOT reusing getWorksData() (unscoped by project, carries checklist/
// dependency internals the report must never show) or GanttBoard's TaskRow
// (same reason). This is its own project-scoped, client-safe projection.
//
// `range`, when given, scopes the ENTIRE report (progress split, per-work
// breakdown, schedule summary, upcoming list, and the Gantt view below it) to
// tasks planned to start within [from, to] — one consistent "generate the
// report for this window" filter rather than each section picking its own
// notion of what's in range. `workId`, when given, narrows the same report
// to just that one Work/trade (e.g. "generate a report for Civil Works
// only") — combines with `range` rather than replacing it.
export async function getProjectReportData(
  projectId: string,
  range?: ReportDateRange,
  workId?: string
): Promise<ProjectReportData | null> {
  const [project, scopedWork, tasks, sft] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true, reportSentAt: true } }),
    workId ? prisma.work.findUnique({ where: { id: workId }, select: { name: true } }) : Promise.resolve(null),
    prisma.hvacTask.findMany({
      where: {
        work: { projectId },
        deletedAt: null,
        ...(workId ? { workId } : {}),
        ...(range ? { plannedStartDate: { gte: range.from, lte: range.to } } : {}),
      },
      select: {
        id: true,
        taskName: true,
        status: true,
        plannedStartDate: true,
        dueDate: true,
        actualStartDate: true,
        actualEndDate: true,
        work: { select: { id: true, name: true, color: true } },
      },
      orderBy: { plannedStartDate: 'asc' },
    }),
    getProjectSftProgress(projectId),
  ]);

  if (!project) return null;

  const today = startOfDay(new Date());

  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  for (const t of tasks) {
    const bucket = classifyTaskStatus(t.status);
    if (bucket === 'completed') completed++;
    else if (bucket === 'inProgress') inProgress++;
    else notStarted++;
  }
  const total = tasks.length;
  const [completedPct, inProgressPct, notStartedPct] = roundToHundred([completed, inProgress, notStarted]);

  const windowEnd = addDays(today, 30);
  const upcoming: ReportUpcomingTask[] = tasks
    .filter((t) => !t.actualStartDate && t.plannedStartDate && t.plannedStartDate >= today && t.plannedStartDate <= windowEnd)
    .sort((a, b) => a.plannedStartDate!.getTime() - b.plannedStartDate!.getTime())
    .map((t) => ({
      id: t.id,
      taskName: t.taskName,
      workName: t.work?.name ?? 'Unassigned',
      dateLabel: upcomingDateLabel(t.plannedStartDate!, today),
    }));

  // Same rule as the schedule summary's delayedDays (not completed, past its
  // own dueDate) — computed once here, per task, so both the Timeline's bar
  // coloring/tooltips AND the schedule/task-summary rollups below read from
  // one shared source instead of two independently-written overdue checks
  // silently drifting apart.
  const overdueDaysByTaskId = new Map<string, number>();
  for (const t of tasks) {
    if (t.dueDate && t.dueDate < today && classifyTaskStatus(t.status) !== 'completed') {
      overdueDaysByTaskId.set(t.id, differenceInCalendarDays(today, t.dueDate));
    }
  }

  const ganttByWork = new Map<string, ReportGanttWork>();
  const workBreakdownById = new Map<string, ReportWorkBreakdown>();
  for (const t of tasks) {
    const workId = t.work?.id ?? 'unassigned';
    const workName = t.work?.name ?? 'Unassigned';
    const workColor = t.work?.color ?? '#9CA3AF';
    if (!ganttByWork.has(workId)) {
      ganttByWork.set(workId, { workId, workName, workColor, tasks: [] });
    }
    const bucket = classifyTaskStatus(t.status);
    const overdueDays = overdueDaysByTaskId.get(t.id) ?? 0;
    ganttByWork.get(workId)!.tasks.push({
      id: t.id,
      taskName: t.taskName,
      plannedStartDate: t.plannedStartDate,
      dueDate: t.dueDate,
      bucket,
      isOverdue: overdueDaysByTaskId.has(t.id),
      overdueDays,
    });

    if (!workBreakdownById.has(workId)) {
      workBreakdownById.set(workId, {
        workId, workName, workColor,
        completed: 0, inProgress: 0, notStarted: 0, total: 0,
        completedPct: 0, inProgressPct: 0, notStartedPct: 0,
      });
    }
    const wb = workBreakdownById.get(workId)!;
    wb.total++;
    if (bucket === 'completed') wb.completed++;
    else if (bucket === 'inProgress') wb.inProgress++;
    else wb.notStarted++;
  }
  const workBreakdown = [...workBreakdownById.values()]
    .map((wb) => {
      const [cPct, iPct, nPct] = roundToHundred([wb.completed, wb.inProgress, wb.notStarted]);
      return { ...wb, completedPct: cPct, inProgressPct: iPct, notStartedPct: nPct };
    })
    .sort((a, b) => a.workName.localeCompare(b.workName));

  // Whole-project schedule rollup — plain calendar days, not working days
  // (see ReportScheduleSummary's doc comment for why this doesn't reuse the
  // CPM delay engine). Anchors: planned span is the earliest plannedStartDate
  // to the latest dueDate on record; actual span runs from the earliest
  // actual (or planned, if work hasn't been marked started) start to either
  // today (still ongoing) or the latest actualEndDate/dueDate (every task in
  // scope is complete).
  const plannedStarts = tasks.map((t) => t.plannedStartDate).filter((d): d is Date => !!d);
  const dueDates = tasks.map((t) => t.dueDate).filter((d): d is Date => !!d);
  const actualStarts = tasks.map((t) => t.actualStartDate ?? t.plannedStartDate).filter((d): d is Date => !!d);
  const allComplete = tasks.length > 0 && tasks.every((t) => classifyTaskStatus(t.status) === 'completed');
  let schedule: ReportScheduleSummary | null = null;
  if (plannedStarts.length > 0 && dueDates.length > 0) {
    const planStart = plannedStarts.reduce((a, b) => (a < b ? a : b));
    const planEnd = dueDates.reduce((a, b) => (a > b ? a : b));
    const plannedDays = differenceInCalendarDays(planEnd, planStart) + 1;

    const actualStart = actualStarts.length > 0 ? actualStarts.reduce((a, b) => (a < b ? a : b)) : planStart;
    const actualEndCandidates = allComplete
      ? tasks.map((t) => t.actualEndDate ?? t.dueDate ?? t.plannedStartDate).filter((d): d is Date => !!d)
      : [];
    const actualEnd = allComplete && actualEndCandidates.length > 0
      ? actualEndCandidates.reduce((a, b) => (a > b ? a : b))
      : today;
    const actualDays = Math.max(1, differenceInCalendarDays(actualEnd, actualStart) + 1);

    // NOT (actualDays - plannedDays) — that only goes positive once the
    // WHOLE project's elapsed time exceeds its WHOLE planned time, so it
    // stays 0 for the entire life of the project right up until the very
    // end, even while individual tasks are already sitting well past their
    // own due dates. What "delayed" has to mean here is "how many days
    // behind is the task that's furthest behind" — the largest gap between
    // today and any not-yet-completed task's own dueDate (overdueDaysByTaskId,
    // computed once above and shared with each ReportGanttTask's own
    // isOverdue/overdueDays). That surfaces real slippage immediately, the
    // same day a task first goes overdue, instead of only once the
    // project's total planned span has been exhausted.
    const delayedDays = Math.max(0, ...overdueDaysByTaskId.values());
    const plannedEndDate = planEnd;
    const projectedEndDate = delayedDays > 0 ? addDays(planEnd, delayedDays) : planEnd;

    schedule = { plannedDays, actualDays, delayedDays, plannedEndDate, projectedEndDate };
  }

  const rangeLabel = range ? `${format(range.from, 'MMM d, yyyy')} – ${format(range.to, 'MMM d, yyyy')}` : null;

  return {
    projectId,
    projectName: project.name,
    rangeLabel,
    scopedWorkName: scopedWork?.name ?? null,
    workBreakdown,
    asOfLabel: format(new Date(), 'MMMM d, yyyy'),
    progress: { completed, inProgress, notStarted, total, completedPct, inProgressPct, notStartedPct },
    overdueCount: overdueDaysByTaskId.size,
    schedule,
    sft: sft.target != null ? sft : null,
    upcoming,
    ganttWorks: [...ganttByWork.values()],
    reportSentAt: project.reportSentAt,
  };
}

// Options for the report's "generate for just one trade" picker — only
// Works that actually have at least one task, so the dropdown doesn't fill
// up with trades that would just produce an empty report (this project has
// 16 Works defined but only Civil Works has any real tasks yet).
export async function getProjectWorkOptions(projectId: string): Promise<{ id: string; name: string }[]> {
  const works = await prisma.work.findMany({
    where: { projectId, tasks: { some: { deletedAt: null } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return works;
}

// The client(s) linked to a project — no existing query does this anywhere
// in the codebase (clientProjectId is otherwise only ever resolved in the
// reverse direction, one client user looking up their own project). A
// project can have more than one client-role UserProfile pointed at it
// (Project.clientProfiles is one-to-many), so "send" notifies all of them.
export async function getProjectClients(projectId: string) {
  return prisma.userProfile.findMany({
    where: { role: 'client', clientProjectId: projectId },
    select: { id: true, email: true, fullName: true },
  });
}
