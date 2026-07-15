import type { TaskStatus } from '@/lib/types/hvac';
import { addWorkingDaysSync, countWorkingDaysBetween } from '@/lib/utils/working-days';

// `taskId` here must be HvacTask.id (the UUID primary key), NOT the
// human-readable business code stored in HvacTask.taskId (e.g. "HVAC-003").
// TaskDependency.taskId/dependsOnTaskId are UUID foreign keys to HvacTask.id,
// so the dependency graph only resolves using that value. Callers that want
// to display the human-readable code should keep a separate
// id -> {taskId, taskName} lookup and join it in after calling this.
export interface DelayEngineTaskInput {
  taskId: string;
  plannedStartDate: Date | null;
  dueDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  status: TaskStatus;
}

export interface DelayEngineDependency {
  taskId: string;
  dependsOnTaskId: string;
}

export interface TaskDelayInfo {
  taskId: string;
  projectedStart: Date;
  projectedFinish: Date;
  inheritedDelayDays: number;
  ownDelayDays: number;
  totalDelayDays: number;
  drivingPrerequisiteTaskId: string | null;
  // Signed, unclamped working-day gap between where prerequisites/plan
  // implied this task could start and where it actually started — positive
  // means it started later than that, negative means earlier. null when
  // actualStartDate isn't set yet (nothing to compare). This is a
  // diagnostic, not a delay figure — no UI surfaces it in this pass, per the
  // prompt's explicit "store it, don't need a UI for this" instruction.
  actualStartDiscrepancyDays: number | null;
}

// Working-day OFFSET between two dates — e.g. same day = 0, next working day
// = 1. Deliberately NOT the same as countWorkingDaysBetween's inclusive span
// (which is 1 and 2 respectively for those two cases) — delay figures are
// deltas ("how far did this move"), not spans ("how long does this take"),
// so every delta in this file must go through this one definition rather
// than each computation subtracting 1 by hand inconsistently.
function workingDayGap(from: Date, to: Date, blockedDates: Set<string>): number {
  if (to <= from) return 0;
  return Math.max(0, countWorkingDaysBetween(from, to, blockedDates) - 1);
}

function pickDrivingPrerequisite(
  prereqIds: string[],
  result: Map<string, TaskDelayInfo>,
  grounded: Map<string, boolean>,
  inheritedDelayDays: number
): string | null {
  // Only a grounded prerequisite (one whose projectedFinish traces back to
  // a real date, not the no-schedule-data fallback) can legitimately be
  // "responsible" for a delay — see the grounded-tracking comment above.
  const candidates = prereqIds.filter((id) => grounded.get(id));
  if (candidates.length === 0 || inheritedDelayDays <= 0) return null;
  let driving: string | null = null;
  let latestFinish: Date | null = null;
  // Sorted ascending so that on an exact tie, the first (lowest-id) one
  // encountered wins — `finish > latestFinish` is strict, so a later
  // candidate with an equal (not greater) finish never overwrites it.
  for (const id of candidates.sort()) {
    const finish = result.get(id)!.projectedFinish;
    if (!latestFinish || finish > latestFinish) {
      latestFinish = finish;
      driving = id;
    }
  }
  return driving;
}

// Pure function: no I/O, no Date.now()/wall-clock dependence — same inputs
// always produce the same outputs, deterministically, including tie-breaks.
export function computeProjectDelays(
  tasks: DelayEngineTaskInput[],
  dependencies: DelayEngineDependency[],
  blockedDates: Set<string>
): Map<string, TaskDelayInfo> {
  const taskMap = new Map(tasks.map((t) => [t.taskId, t]));

  const prereqsOf = new Map<string, string[]>();
  const dependentsOf = new Map<string, string[]>();
  for (const t of tasks) {
    prereqsOf.set(t.taskId, []);
    dependentsOf.set(t.taskId, []);
  }
  for (const d of dependencies) {
    // Ignore edges referencing a task not in this input set (e.g. a
    // project-scoped call) rather than crashing on a dangling reference.
    if (!taskMap.has(d.taskId) || !taskMap.has(d.dependsOnTaskId)) continue;
    prereqsOf.get(d.taskId)!.push(d.dependsOnTaskId);
    dependentsOf.get(d.dependsOnTaskId)!.push(d.taskId);
  }

  // ── Kahn's algorithm — deterministic tie-break via sorted queue ──
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

  if (order.length !== tasks.length) {
    // The graph is guaranteed acyclic by addTaskDependency's cycle check —
    // reaching here means the data was corrupted some other way (e.g. a
    // manual DB edit bypassing that check). Throw rather than silently
    // producing wrong delay numbers for a partial/garbage ordering.
    const stuck = tasks.map((t) => t.taskId).filter((id) => !order.includes(id));
    throw new Error(
      `computeProjectDelays: cycle detected in task dependency graph — ` +
      `unable to topologically sort ${stuck.length} task(s): ${stuck.join(', ')}`
    );
  }

  // Fallback anchor for a task with no plannedStartDate, no actualStartDate,
  // and no prerequisites — i.e. no schedule data entered for it at all.
  // Falls back to the earliest date found anywhere in the input so the
  // return type stays a real Date without fabricating "today" (which would
  // make results non-reproducible run to run). Callers should check the
  // source task's own plannedStartDate/dueDate before trusting this task's
  // delay figures as meaningful — see the null-guards below.
  const allKnownDates = tasks
    .flatMap((t) => [t.plannedStartDate, t.dueDate, t.actualStartDate, t.actualEndDate])
    .filter((d): d is Date => !!d);
  const projectAnchor = allKnownDates.length > 0
    ? allKnownDates.reduce((a, b) => (a < b ? a : b))
    : new Date(Date.UTC(2000, 0, 1));

  const result = new Map<string, TaskDelayInfo>();

  // A task is "grounded" if its projectedFinish traces back to at least one
  // real date on the record (its own plannedStartDate/dueDate/actual dates,
  // or — transitively — a grounded prerequisite). A task with none of those
  // has no real schedule commitment at all; its projectedFinish only exists
  // to satisfy the return type (see projectAnchor above) and must NOT be
  // allowed to push a downstream task's start or be blamed as "driving" a
  // delay — otherwise a long chain of never-scheduled tasks fabricates a
  // large, meaningless "delay" purely from chain length. This was caught by
  // running the engine against the real seeded dataset (see delivery notes):
  // 80 of 95 tasks have no planned dates at all, and without this guard
  // several genuinely-scheduled tasks showed 15-40 "inherited delay" working
  // days blamed on undated prerequisites that have never been scheduled.
  const grounded = new Map<string, boolean>();

  for (const taskId of order) {
    const task = taskMap.get(taskId)!;
    const prereqIds = prereqsOf.get(taskId)!;
    const hasOwnAnchor = !!(task.plannedStartDate || task.dueDate || task.actualStartDate || task.actualEndDate);
    grounded.set(taskId, hasOwnAnchor || prereqIds.some((p) => grounded.get(p)));

    if (task.status === 'completed') {
      // Ground truth is actualEndDate when it's been captured — but this
      // app currently has no UI to record actual dates (deliberately
      // deferred; see lib/utils/working-days.ts's validateTaskDates note),
      // so real "completed" tasks routinely have status='completed' with
      // actualEndDate still null. Falling through to the projection branch
      // below for a task that's actually done would compute a speculative
      // multi-hop "projected" finish instead of trusting the closest real
      // date on record — so completed always short-circuits here, just with
      // a fallback chain for which real date stands in for actualEndDate.
      const projectedFinish = task.actualEndDate ?? task.dueDate ?? task.plannedStartDate ?? null;
      if (projectedFinish === null) {
        // Completed, but literally no date of any kind on record — same
        // "nothing to anchor to" situation as an unscheduled task; use the
        // shared project-wide fallback rather than a bespoke one here.
        result.set(taskId, {
          taskId, projectedStart: projectAnchor, projectedFinish: projectAnchor,
          inheritedDelayDays: 0, ownDelayDays: 0, totalDelayDays: 0,
          drivingPrerequisiteTaskId: null, actualStartDiscrepancyDays: null,
        });
        continue;
      }
      const projectedStart = task.actualStartDate ?? task.plannedStartDate ?? projectedFinish;
      const inheritedDelayDays = task.plannedStartDate
        ? workingDayGap(task.plannedStartDate, projectedStart, blockedDates)
        : 0;
      const totalDelayDays = task.dueDate
        ? workingDayGap(task.dueDate, projectedFinish, blockedDates)
        : 0;
      result.set(taskId, {
        taskId, projectedStart, projectedFinish,
        inheritedDelayDays,
        ownDelayDays: Math.max(0, totalDelayDays - inheritedDelayDays),
        totalDelayDays,
        drivingPrerequisiteTaskId: pickDrivingPrerequisite(prereqIds, result, grounded, inheritedDelayDays),
        actualStartDiscrepancyDays: null, // ground truth — nothing to compare against
      });
      continue;
    }

    // Not completed (draft/ready/blocked/in_progress/on_hold). Only grounded
    // prerequisites contribute a pushed start — an ungrounded one's
    // projectedFinish is fictitious (see the `grounded` comment above), so
    // treating it as a real constraint would fabricate delay.
    const prereqDrivenStarts = prereqIds
      .filter((p) => grounded.get(p))
      .map((p) => addWorkingDaysSync(result.get(p)!.projectedFinish, 1, blockedDates));
    const candidateStarts = [
      ...(task.plannedStartDate ? [task.plannedStartDate] : []),
      ...prereqDrivenStarts,
    ];
    const earliestPossibleStart = candidateStarts.length > 0
      ? candidateStarts.reduce((a, b) => (a > b ? a : b))
      : null;

    let projectedStart: Date;
    let actualStartDiscrepancyDays: number | null = null;

    if (task.actualStartDate) {
      projectedStart = task.actualStartDate;
      if (earliestPossibleStart) {
        // Signed, unclamped diagnostic — see the field's doc comment.
        const gapForward = workingDayGap(earliestPossibleStart, task.actualStartDate, blockedDates);
        const gapBackward = workingDayGap(task.actualStartDate, earliestPossibleStart, blockedDates);
        actualStartDiscrepancyDays = gapForward > 0 ? gapForward : -gapBackward;
      }
    } else if (earliestPossibleStart) {
      projectedStart = earliestPossibleStart;
    } else {
      // No plannedStartDate, no usable prerequisite, no actualStartDate —
      // nothing scheduled for this task yet. inheritedDelayDays/
      // totalDelayDays below both resolve to 0 in this case (guarded on
      // task.plannedStartDate/task.dueDate being present) — that 0 means
      // "not computable", not "on schedule". The UI layer distinguishes the
      // two by checking task.plannedStartDate itself.
      projectedStart = task.dueDate ?? projectAnchor;
    }

    const plannedDurationDays = (task.plannedStartDate && task.dueDate)
      ? countWorkingDaysBetween(task.plannedStartDate, task.dueDate, blockedDates)
      : 1; // unknown duration — 1-working-day placeholder (addWorkingDaysSync floors at 1 anyway)

    const projectedFinish = addWorkingDaysSync(projectedStart, plannedDurationDays, blockedDates);

    const inheritedDelayDays = task.plannedStartDate
      ? workingDayGap(task.plannedStartDate, projectedStart, blockedDates)
      : 0;
    const totalDelayDays = task.dueDate
      ? workingDayGap(task.dueDate, projectedFinish, blockedDates)
      : 0;

    result.set(taskId, {
      taskId, projectedStart, projectedFinish,
      inheritedDelayDays,
      ownDelayDays: Math.max(0, totalDelayDays - inheritedDelayDays),
      totalDelayDays,
      drivingPrerequisiteTaskId: pickDrivingPrerequisite(prereqIds, result, grounded, inheritedDelayDays),
      actualStartDiscrepancyDays,
    });
  }

  return result;
}
