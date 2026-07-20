'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CreateTaskSchema, UpdateTaskPlannedDatesSchema, UpdateTaskStatusSchema, type CreateTaskInput } from '@/lib/validations/tasks';
import { getStartBlockingPrerequisites, getFinishBlockingPrerequisites, formatUnmetPrerequisites } from '@/lib/utils/status-rules';
import { validateTaskDates, getAllBlockedDates, isWorkingDay } from '@/lib/utils/working-days';
import type { ActionResult } from '@/lib/types/tasks';

interface CreatedTask {
  id: string;
  taskId: string;
  taskName: string;
}

// Shared by createTask (the /works/[workId]/new form, which redirects to
// the new task's detail page) and createTaskFromCanvas (the flowchart's
// inline creation, which stays on the canvas) — both need the exact same
// task-create + checklist-seed + activity-log behavior, just different
// post-creation navigation. Callers are responsible for date validation
// before calling this (see validateTaskDates() at each call site) and for
// revalidatePath/redirect after.
async function createTaskCore(data: CreateTaskInput, taskIdOverride?: string): Promise<ActionResult<CreatedTask>> {
  let task;
  try {
    // Use the work's code as the task ID prefix, and derive the project name from the work
    let prefix = 'WRK';
    let projectName = 'Unassigned';
    try {
      const work = await prisma.work.findUnique({
        where: { id: data.work_id },
        select: { code: true, project: { select: { name: true } } },
      });
      if (work) {
        prefix = work.code;
        if (work.project) projectName = work.project.name;
      }
    } catch { /* fallback */ }

    task = await prisma.task.create({
      data: {
        taskId: taskIdOverride ?? `${prefix}-${Date.now().toString().slice(-6)}`,
        taskName: data.task_name,
        projectName,
        description: data.description ?? null,
        plannedStartDate: data.planned_start_date ? new Date(data.planned_start_date) : null,
        dueDate: data.due_date ? new Date(data.due_date) : null,
        taskTypeId: data.task_type_id || null,
        assignedTo: data.assigned_to || null,
        workId: data.work_id,
        totalSft: data.total_sft || null,
      },
      select: { id: true, taskId: true, taskName: true },
    });
  } catch {
    return { success: false, error: 'Failed to create task. Please try again.' };
  }

  // Auto-seed dependency checklist items from the current template
  const templateItems = await prisma.dependencyTemplateItem.findMany().catch(() => []);
  if (templateItems.length > 0) {
    await prisma.dependencyItem.createMany({
      data: templateItems.map((ti) => ({
        taskId: task.id,
        category: ti.category,
        itemLabel: ti.label,
        sortOrder: ti.sortOrder,
      })),
    }).catch(() => {});
  }

  await prisma.activityLog.create({
    data: {
      taskId: task.id,
      actionType: 'task_created',
      payload: { taskId: task.taskId },
    },
  }).catch(() => {});

  return { success: true, data: task };
}

export async function createTask(
  _prevState: ActionResult<{ taskId: string }>,
  formData: FormData
): Promise<ActionResult<{ taskId: string }>> {
  const parsed = CreateTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  // Server-side safety net — the date picker already refuses to let a user
  // click a Sunday/holiday, but that's only a UI restriction; a direct
  // request to this action must be rejected the same way.
  const dateErrors = await validateTaskDates({
    plannedStartDate: parsed.data.planned_start_date,
    dueDate: parsed.data.due_date,
  });
  if (dateErrors) {
    return { success: false, error: dateErrors };
  }

  const result = await createTaskCore(parsed.data);
  if (!result.success || !result.data) return result;

  revalidatePath('/tasks');
  redirect(`/tasks/${result.data.id}`);
}

export interface CanvasTaskInput {
  taskName: string;
  workId: string;
  plannedStartDate?: string | null;
  dueDate?: string | null;
  taskTypeId?: string | null;
  // Omitted (or undefined) leaves the new task auto-laid-out — eligible for
  // layoutWithDagre's own placement now, AND for completeConnection's
  // relayout-after-connect the moment a real dependency links it to
  // something. Only set this for an explicit "place it here" gesture (the
  // canvas's own +Add Task double-click); Duplicate deliberately leaves it
  // unset, since a copy that's about to become an FS successor needs to
  // stay auto-eligible to land in proper alignment — a hardcoded pixel
  // offset here previously opted every duplicate out of that entirely,
  // which is exactly what produced a cramped, badly-spaced connector once
  // the copy got linked to its original.
  manualPositionX?: number;
  manualPositionY?: number;
  // The taskId of the task this one is being duplicated from, if any (e.g.
  // "1a") — when it follows this project's "<number><letter>" series
  // convention, the new task continues that series (e.g. "1f") instead of
  // getting a generic "<WORK_CODE>-<timestamp>" code. See nextSeriesTaskId.
  duplicateFromTaskId?: string;
}

export interface CanvasTaskResult extends CreatedTask {
  manualPositionX: number | null;
  manualPositionY: number | null;
}

// Spreadsheet-column-style increment (a -> b, ..., z -> aa) so a series
// never silently stalls once it passes 'z' — every real series seen so far
// (1a-1e, 17a-17q, etc.) stays well under one letter, but this keeps working
// correctly if a phase ever grows past 26 tasks.
function incrementLetterSuffix(letters: string): string {
  const chars = letters.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] === 'z') { chars[i] = 'a'; continue; }
    chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
    return chars.join('');
  }
  return 'a' + chars.join(''); // every position rolled over past 'z'
}

// null for anything that isn't this project's "<number><letter>" taskId
// convention (e.g. the generic "<WORK_CODE>-<timestamp>" codes most tasks
// use) — callers fall back to the normal auto-generated code in that case.
async function nextSeriesTaskId(sourceTaskId: string): Promise<string | null> {
  const match = sourceTaskId.match(/^(\d+)([a-z]+)$/);
  if (!match) return null;
  const [, number, sourceLetters] = match;

  const candidates = await prisma.task.findMany({
    where: { taskId: { startsWith: number } },
    select: { taskId: true },
  });
  const seriesPattern = new RegExp(`^${number}([a-z]+)$`);
  const siblingLetters = candidates
    .map((t) => t.taskId.match(seriesPattern)?.[1])
    .filter((letters): letters is string => !!letters);

  const maxLetters = siblingLetters.length > 0
    ? siblingLetters.reduce((a, b) => (a.length !== b.length ? (a.length > b.length ? a : b) : (a > b ? a : b)))
    : sourceLetters;

  const existing = new Set(candidates.map((t) => t.taskId));
  let nextLetters = incrementLetterSuffix(maxLetters);
  // Defensive against a race with another creation landing between the read
  // above and this one's insert — keep advancing to the next free letter
  // instead of failing outright on the taskId unique-constraint violation.
  while (existing.has(`${number}${nextLetters}`)) nextLetters = incrementLetterSuffix(nextLetters);
  return `${number}${nextLetters}`;
}

// The flowchart's inline "+ Add Task" — same validation/creation/checklist-
// seed/activity-log as createTask above, but takes plain args (not
// FormData, since there's no <form> on the canvas) and returns the created
// task instead of redirecting, since creating a task shouldn't navigate the
// admin away from the board they're building.
export async function createTaskFromCanvas(input: CanvasTaskInput): Promise<ActionResult<CanvasTaskResult>> {
  const parsed = CreateTaskSchema.safeParse({
    task_name: input.taskName,
    work_id: input.workId,
    planned_start_date: input.plannedStartDate ?? '',
    due_date: input.dueDate ?? '',
    task_type_id: input.taskTypeId ?? '',
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const dateErrors = await validateTaskDates({
    plannedStartDate: parsed.data.planned_start_date,
    dueDate: parsed.data.due_date,
  });
  if (dateErrors) return { success: false, error: dateErrors };

  const taskIdOverride = input.duplicateFromTaskId
    ? await nextSeriesTaskId(input.duplicateFromTaskId).catch(() => null)
    : null;

  const result = await createTaskCore(parsed.data, taskIdOverride ?? undefined);
  if (!result.success) return result;
  if (!result.data) return { success: false, error: 'Failed to create task. Please try again.' };

  const hasManualPosition = input.manualPositionX != null && input.manualPositionY != null;
  if (hasManualPosition) {
    await prisma.task.update({
      where: { id: result.data.id },
      data: { manualPositionX: input.manualPositionX, manualPositionY: input.manualPositionY },
    }).catch(() => {});
  }

  revalidatePath('/works/flowchart');
  revalidatePath('/works');
  return {
    success: true,
    data: {
      ...result.data,
      manualPositionX: hasManualPosition ? input.manualPositionX! : null,
      manualPositionY: hasManualPosition ? input.manualPositionY! : null,
    },
  };
}

export async function updateTaskStatus(
  taskId: string,
  status: string
): Promise<ActionResult> {
  const parsed = UpdateTaskStatusSchema.safeParse({ status });
  if (!parsed.success) {
    return { success: false, error: 'Invalid status value' };
  }

  let existing;
  try {
    existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, actualStartDate: true, actualEndDate: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }

  if (!existing) return { success: false, error: 'Task not found' };
  if (existing.status === 'completed') return { success: false, error: 'Completed tasks are locked' };

  if (parsed.data.status === 'in_progress' || parsed.data.status === 'completed') {
    if (parsed.data.status === 'in_progress' && existing.status !== 'ready') {
      return { success: false, error: 'Task must be in Ready state before starting' };
    }

    // Cross-trade gate — independent of the checklist system above. A task
    // can be checklist-`ready` and still be waiting on another trade's task.
    // Fetches every dependency type; which ones actually gate THIS
    // transition is decided below by getStartBlockingPrerequisites (FS/SS,
    // for entering in_progress) vs getFinishBlockingPrerequisites (FF/SF,
    // for entering completed) — see their doc comments in status-rules.ts.
    const prereqRows = await prisma.taskDependency.findMany({
      where: { taskId },
      select: {
        type: true,
        dependsOnTask: { select: { id: true, taskId: true, taskName: true, status: true, actualStartDate: true } },
      },
    }).catch(() => []);
    const typedPrereqs = prereqRows.map((r) => ({ type: r.type, task: r.dependsOnTask }));

    const blockers = parsed.data.status === 'in_progress'
      ? getStartBlockingPrerequisites(typedPrereqs)
      : getFinishBlockingPrerequisites(typedPrereqs);
    if (blockers.length > 0) {
      const verb = parsed.data.status === 'in_progress' ? 'start' : 'complete';
      return { success: false, error: `Cannot ${verb} — ${formatUnmetPrerequisites(blockers)}` };
    }
  }

  // Auto-capture actual dates the moment a task genuinely starts/finishes —
  // server-side `now`, never client-supplied, and only ever set once (never
  // overwritten by a later re-transition — e.g. completed -> in_progress ->
  // completed again does NOT push actualEndDate forward). Moving a task OUT
  // of `completed` back to something else does NOT clear actualEndDate
  // either: it's a factual record of what happened, not a live mirror of the
  // current status. Do not "fix" that later — it's intentional.
  const now = new Date();
  const actualDateUpdate: { actualStartDate?: Date; actualEndDate?: Date } = {};
  let capturedField: 'actualStartDate' | 'actualEndDate' | null = null;
  if (parsed.data.status === 'in_progress' && !existing.actualStartDate) {
    actualDateUpdate.actualStartDate = now;
    capturedField = 'actualStartDate';
  }
  if (parsed.data.status === 'completed' && !existing.actualEndDate) {
    actualDateUpdate.actualEndDate = now;
    capturedField = 'actualEndDate';
  }

  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: parsed.data.status as never, ...actualDateUpdate },
    });
  } catch {
    return { success: false, error: 'Failed to update status' };
  }

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'status_change',
      payload: { from: existing.status, to: parsed.data.status, ...(capturedField ? { autoCapturedActualDate: capturedField } : {}) },
    },
  }).catch(() => {});

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/tasks/${taskId}/overview`);
  revalidatePath('/tasks');
  return { success: true };
}

// Post-creation date editing — planned dates only (see the scope note on
// validateTaskDates()). Takes the full desired end-state for both fields
// (null means "clear it"), diffs against what's currently stored, and logs
// exactly which fields actually changed.
export async function updateTaskPlannedDates(
  taskId: string,
  data: { plannedStartDate: string | null; dueDate: string | null }
): Promise<ActionResult> {
  const parsed = UpdateTaskPlannedDatesSchema.safeParse({
    planned_start_date: data.plannedStartDate ?? '',
    due_date: data.dueDate ?? '',
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const dateErrors = await validateTaskDates({
    plannedStartDate: parsed.data.planned_start_date,
    dueDate: parsed.data.due_date,
  });
  if (dateErrors) return { success: false, error: dateErrors };

  let existing;
  try {
    existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { plannedStartDate: true, dueDate: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }
  if (!existing) return { success: false, error: 'Task not found' };

  const toKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
  const next = {
    plannedStartDate: parsed.data.planned_start_date ? new Date(parsed.data.planned_start_date) : null,
    dueDate: parsed.data.due_date ? new Date(parsed.data.due_date) : null,
  };

  const changedFields = (['plannedStartDate', 'dueDate'] as const)
    .filter((f) => toKey(existing[f]) !== toKey(next[f]));

  if (changedFields.length === 0) return { success: true };

  try {
    // A manual re-plan supersedes any tracked auto-cascade push — the admin
    // just set a fresh commitment by hand, so a stale "pushed by the
    // cascade" marker from before this edit would be misleading now.
    await prisma.task.update({
      where: { id: taskId },
      data: { ...next, currentPlannedStartDate: null, currentDueDate: null, cascadeDelayDays: null },
    });
  } catch {
    return { success: false, error: 'Failed to update dates' };
  }

  const fieldColumn: Record<(typeof changedFields)[number], string> = {
    plannedStartDate: 'planned_start_date',
    dueDate: 'due_date',
  };
  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'planned_dates_updated',
      payload: { fields: changedFields.map((f) => fieldColumn[f]) },
    },
  }).catch(() => {});

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
  return { success: true };
}

function shiftForwardWorkingDays(date: Date, days: number, blocked: Set<string>): Date {
  let cursor = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
    if (isWorkingDay(cursor, blocked)) remaining--;
  }
  return cursor;
}

// Transitive FS-only closure from `rootId`, walking backward (toward
// prerequisites, not successors) — every (transitive) prerequisite of
// rootId, not just its direct one. Used to find whether some earlier task in
// the chain still has a real, unresolved delay of its own before a closer
// edit is allowed to erase what that earlier delay already pushed onto
// everything after it. SS/FF/SF don't push a successor's START the way FS
// does (see lib/utils/delay-engine.ts's own ES/EF split), so only FS edges
// are walked here.
async function getFsUpstreamClosure(rootId: string): Promise<string[]> {
  const deps = await prisma.taskDependency.findMany({
    where: { type: 'FS' },
    select: { taskId: true, dependsOnTaskId: true },
  });
  const parentsOf = new Map<string, string[]>();
  for (const d of deps) {
    (parentsOf.get(d.taskId) ?? parentsOf.set(d.taskId, []).get(d.taskId)!).push(d.dependsOnTaskId);
  }
  const seen = new Set<string>();
  const queue = [...(parentsOf.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(parentsOf.get(id) ?? []));
  }
  return [...seen];
}

// Every task the delay on rootId should reach: its whole FS-downstream
// closure, PLUS every task connected to any of those (or to rootId itself)
// through any number of hops across a mix of FS-forward and parallel edges.
// An earlier version of this only mirrored parallel ONE hop out from the FS
// closure — fine when a parallel link always sat directly off the FS
// backbone, but it silently missed a track like Toilets Works, which is only
// reachable via Ground Floor -> [parallel] -> Mezzanine Floor -> [parallel]
// -> Toilets Works: two parallel hops removed from anything FS-connects to.
// Real project delay should reach every one of those tracks, not just the
// first one over, so this is a genuine transitive closure now, not a
// single-hop mirror.
async function getFullCascadeClosure(rootId: string): Promise<string[]> {
  const [fsDeps, parallelLinks] = await Promise.all([
    prisma.taskDependency.findMany({ where: { type: 'FS' }, select: { taskId: true, dependsOnTaskId: true } }),
    prisma.taskParallelLink.findMany({ select: { taskAId: true, taskBId: true } }),
  ]);
  const childrenOf = new Map<string, string[]>();
  for (const d of fsDeps) {
    (childrenOf.get(d.dependsOnTaskId) ?? childrenOf.set(d.dependsOnTaskId, []).get(d.dependsOnTaskId)!).push(d.taskId);
  }
  const partnersOf = new Map<string, string[]>();
  for (const l of parallelLinks) {
    (partnersOf.get(l.taskAId) ?? partnersOf.set(l.taskAId, []).get(l.taskAId)!).push(l.taskBId);
    (partnersOf.get(l.taskBId) ?? partnersOf.set(l.taskBId, []).get(l.taskBId)!).push(l.taskAId);
  }

  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of [...(childrenOf.get(id) ?? []), ...(partnersOf.get(id) ?? [])]) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  seen.delete(rootId);
  return [...seen];
}

// Auto-reschedule: when a task's own actual finish lands later than its own
// due date, push every FS-downstream task's Planned Start/End forward by
// that same flat number of working days — not a re-run of the CPM cascade
// engine (lib/utils/delay-engine.ts), which for a not-yet-`completed` task
// inflates the figure to "at least as late as today" rather than trusting
// the recorded actual date. This only fires off actualEndDate (the
// definitive "here's when it really finished" signal) — actualStartDate
// alone doesn't trigger it, so entering both fields in the same Edit Task
// save (two separate calls) can't double-shift downstream tasks. Completed
// downstream tasks are skipped — their Planned dates are historical record
// at that point, not a live plan to push.
//
// Also pushes to direct parallel partners (see getParallelPartners) — same
// flat shift, same cosmetic-only fields, just mirrored sideways across a
// Parallel link instead of forward across an FS chain. Requested explicitly:
// a parallel link is "these two run together," so a real delay on one side
// should visually show up on its partner too, not just on whatever that
// task's own FS-successors are.
//
// Exported (not just called from updateTaskActualDate below) so
// addTaskDependency/createParallelLink (task-dependencies.ts,
// task-parallel-links.ts) can re-run it against the prerequisite/partner
// whenever a NEW edge is created — this function only pushes tasks that are
// ALREADY in the closure (FS-downstream or parallel-partner) at the moment
// the delay is recorded; a task linked in LATER (e.g. a new parallel
// partner added after the other side was already marked late) would
// otherwise never receive the push at all, since nothing else re-triggers
// this once the delay is already sitting on the other task's own row.
//
// delayDays prefers the task's OWN actualEndDate-vs-dueDate gap, but falls
// back to its OWN cascadeDelayDays (a delay it only ever INHERITED from
// further upstream, with no real actualEndDate of its own) — otherwise
// linking a new task onto an already-cascaded-but-never-actually-finished
// task (e.g. task B is late only because task A pushed it, B itself has no
// actual dates yet) would find nothing to propagate to the new task C, even
// though B is genuinely running late right now and C should inherit that.
//
// It also takes the max against any FS-ancestor's own unresolved delay
// (walking the whole upstream chain, not just the direct predecessor).
// Without this, editing an intermediate task's actual date back to on-time
// (its own delay = 0) would wipe cascadeDelayDays for everything after it —
// even though the TRUE root cause further upstream (e.g. the very first
// task in the chain) still has a real, unfixed delay of its own. That root
// delay has to keep winning until it's actually resolved at the source,
// regardless of what any one task in the middle of the chain reports.
export async function cascadePlannedDatesFromActualDelay(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { dueDate: true, actualEndDate: true, cascadeDelayDays: true },
  });
  if (!task) return;

  const ownDelayDays = (task.dueDate && task.actualEndDate)
    ? Math.round((task.actualEndDate.getTime() - task.dueDate.getTime()) / 86_400_000)
    : null;

  const upstreamIds = await getFsUpstreamClosure(taskId);
  let upstreamOwnDelay = 0;
  if (upstreamIds.length > 0) {
    const upstreamTasks = await prisma.task.findMany({
      where: { id: { in: upstreamIds } },
      select: { dueDate: true, actualEndDate: true },
    });
    for (const u of upstreamTasks) {
      if (!u.dueDate || !u.actualEndDate) continue;
      const gap = Math.round((u.actualEndDate.getTime() - u.dueDate.getTime()) / 86_400_000);
      if (gap > upstreamOwnDelay) upstreamOwnDelay = gap;
    }
  }

  const delayDays = Math.max(
    (ownDelayDays && ownDelayDays > 0) ? ownDelayDays : 0,
    task.cascadeDelayDays ?? 0,
    upstreamOwnDelay
  );

  // taskId itself is included here too, not just its downstream/parallel
  // closure — otherwise a task edited to be on-time (own delay = 0) never
  // shows the delay it's still inheriting from further upstream (delayDays
  // above already accounts for that), even though every task after it
  // correctly does. The card's own display always prefers a real ownDelay
  // over this when one exists, so setting it here is harmless for a task
  // that's genuinely on time or genuinely its own delay source — it only
  // matters for the on-time-but-still-mid-chain case this was missing.
  const targetIds = [taskId, ...(await getFullCascadeClosure(taskId))];
  if (targetIds.length === 0) return;

  const affectedTasks = await prisma.task.findMany({
    where: { id: { in: targetIds }, status: { not: 'completed' } },
    select: { id: true, taskId: true, plannedStartDate: true, dueDate: true },
  });
  if (affectedTasks.length === 0) return;

  const affectedIds = affectedTasks.map((t) => t.id);

  if (delayDays <= 0) {
    // This task no longer has a delay of its own to push (its actual date
    // was cleared, or corrected back to on-time) — the downstream closure's
    // cascadeDelayDays from the LAST time this ran is now stale and needs
    // clearing too, not just left in place. Same last-write-wins model as
    // the push below (whichever task's actual date was most recently
    // touched owns the whole closure's cascade figure), just resetting to
    // "no delay" instead of shifting forward. One bulk statement — see the
    // comment on the push branch below for why this used to be 100+
    // sequential row updates.
    await prisma.$executeRaw`
      UPDATE tasks
      SET current_planned_start_date = NULL, current_due_date = NULL, cascade_delay_days = NULL
      WHERE id = ANY(${affectedIds}::uuid[])
    `;
    revalidatePath('/works/flowchart');
    revalidatePath('/gantt');
    for (const t of affectedTasks) {
      revalidatePath(`/tasks/${t.id}`);
      revalidatePath(`/tasks/${t.id}/overview`);
    }
    return;
  }

  const years = new Set(
    affectedTasks.flatMap((t) => [t.plannedStartDate, t.dueDate]).filter((d): d is Date => !!d).map((d) => d.getUTCFullYear())
  );
  const blocked = new Set<string>();
  for (const y of years) for (const d of await getAllBlockedDates(y)) blocked.add(d);

  // Shifted FROM the original plannedStartDate/dueDate every time (not from
  // a possibly-already-shifted currentDueDate) — recomputing off the same
  // immutable baseline each run makes this idempotent: firing the same
  // delayDays twice lands on the same current date instead of compounding it
  // further. plannedStartDate/dueDate themselves are never touched here —
  // that's the whole point (see schema comment).
  const newPlannedStarts = affectedTasks.map((t) => t.plannedStartDate ? shiftForwardWorkingDays(t.plannedStartDate, delayDays, blocked) : null);
  const newDueDates = affectedTasks.map((t) => t.dueDate ? shiftForwardWorkingDays(t.dueDate, delayDays, blocked) : null);

  // A single bulk UPDATE...FROM unnest(...) instead of a $transaction of one
  // prisma.task.update() per row — the per-row form was ~100+ sequential
  // round trips inside one interactive transaction, which measured ~23.5s
  // for 123 rows and genuinely timed out once ("rollback cannot be executed
  // on an expired transaction") against Prisma's 5s default before a 90s
  // override papered over it. This form is one round trip regardless of how
  // many rows are affected. COALESCE onto the existing column mirrors the
  // old `? shiftForwardWorkingDays(...) : undefined` (a null array element
  // only ever happens when the source date was null, meaning "don't touch
  // this column" — same as Prisma's `undefined` skip-field behavior).
  await prisma.$executeRaw`
    UPDATE tasks AS t
    SET
      current_planned_start_date = COALESCE(v.new_planned, t.current_planned_start_date),
      current_due_date = COALESCE(v.new_due, t.current_due_date),
      cascade_delay_days = ${delayDays}
    FROM (
      SELECT * FROM unnest(${affectedIds}::uuid[], ${newPlannedStarts}::date[], ${newDueDates}::date[]) AS v(id, new_planned, new_due)
    ) v
    WHERE t.id = v.id
  `;

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'cascade_planned_dates',
      payload: { delayDays, shiftedTaskIds: affectedTasks.map((t) => t.taskId) },
    },
  }).catch(() => {});

  revalidatePath('/works/flowchart');
  revalidatePath('/gantt');
  for (const t of affectedTasks) {
    revalidatePath(`/tasks/${t.id}`);
    revalidatePath(`/tasks/${t.id}/overview`);
  }
}

// Manual correction for an actual date that updateTaskStatus already
// auto-captured (or filling one in that was never captured at all, e.g. for
// a task that was already `completed` before auto-capture existed). Not
// working-day-restricted like validateTaskDates()'s planned-date rule — an
// actual event can genuinely have happened on a Sunday or a holiday, so the
// only real constraint here is chronological order between the two actual
// dates themselves.
export async function updateTaskActualDate(
  taskId: string,
  field: 'actualStartDate' | 'actualEndDate',
  value: string | null, // 'YYYY-MM-DD', or null to clear
  // When the OTHER actual-date field is ALSO being changed in the same
  // caller-side edit (e.g. a form that lets both be edited together, then
  // saves them as two sequential calls like this one), pass its new pending
  // value here. Without it, this validates the new value against the
  // OTHER field's still-old row in the database — so moving both dates
  // forward together (e.g. start 10th -> 11th, end 10th -> 11th) falsely
  // rejects the first call, since the database's end is still the 10th at
  // that point even though the caller's own end value is about to become
  // the 11th too. `undefined` (the default) means "not being changed in
  // this same edit," matching every existing single-field caller exactly.
  otherFieldPendingValue?: string | null
): Promise<ActionResult> {
  if (field !== 'actualStartDate' && field !== 'actualEndDate') {
    return { success: false, error: 'Invalid field' };
  }

  let existing;
  try {
    existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { actualStartDate: true, actualEndDate: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }
  if (!existing) return { success: false, error: 'Task not found' };

  const newDate = value ? new Date(value) : null;
  const otherDate = otherFieldPendingValue !== undefined
    ? (otherFieldPendingValue ? new Date(otherFieldPendingValue) : null)
    : undefined;
  const nextStart = field === 'actualStartDate' ? newDate : (otherDate !== undefined ? otherDate : existing.actualStartDate);
  const nextEnd = field === 'actualEndDate' ? newDate : (otherDate !== undefined ? otherDate : existing.actualEndDate);
  if (nextStart && nextEnd && nextEnd < nextStart) {
    return { success: false, error: 'Actual completion date cannot be before actual start date' };
  }

  try {
    // A real actual date makes this task's own lateness ground truth —
    // clear any inherited cascadeDelayDays marker so a stale one from an
    // earlier upstream push doesn't linger once there's a truer signal.
    await prisma.task.update({ where: { id: taskId }, data: { [field]: newDate, cascadeDelayDays: null } });
  } catch {
    return { success: false, error: 'Failed to update date' };
  }

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'actual_date_captured',
      payload: { field, value },
    },
  }).catch(() => {});

  if (field === 'actualEndDate') {
    // Also runs when newDate is null (the date is being cleared) — without
    // this, clearing a completion date that had previously pushed a delay
    // downstream left every task in that closure stuck showing the old
    // delay forever, since nothing ever re-ran the cascade to reset them.
    await cascadePlannedDatesFromActualDelay(taskId);
  }

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/tasks/${taskId}/overview`);
  return { success: true };
}

// Flowchart inline rename — one of several "quick fields" the flowchart's
// edit dialog covers (name, description, task type, dates); anything beyond
// those still goes through the task detail page.
export async function updateTaskName(taskId: string, taskName: string): Promise<ActionResult> {
  const trimmed = taskName.trim();
  if (trimmed.length < 3) return { success: false, error: 'Task name must be at least 3 characters' };
  if (trimmed.length > 200) return { success: false, error: 'Task name is too long' };

  try {
    await prisma.task.update({ where: { id: taskId }, data: { taskName: trimmed } });
  } catch {
    return { success: false, error: 'Failed to update task name' };
  }

  revalidatePath('/works/flowchart');
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function updateTaskDescription(taskId: string, description: string): Promise<ActionResult> {
  const trimmed = description.trim();
  if (trimmed.length > 2000) return { success: false, error: 'Description is too long' };

  try {
    await prisma.task.update({ where: { id: taskId }, data: { description: trimmed || null } });
  } catch {
    return { success: false, error: 'Failed to update description' };
  }

  revalidatePath('/works/flowchart');
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

// taskTypeId is set here WITHOUT recomputing dueDate — the flowchart's edit
// dialog already computes the suggested due date client-side (via
// computeDueDate, same helper the Create Task form uses) and saves it
// through updateTaskPlannedDates itself, so this only ever needs to persist
// which type was picked, not re-derive dates from it.
export async function updateTaskType(taskId: string, taskTypeId: string | null): Promise<ActionResult> {
  try {
    await prisma.task.update({ where: { id: taskId }, data: { taskTypeId: taskTypeId || null } });
  } catch {
    return { success: false, error: 'Failed to update task type' };
  }

  revalidatePath('/works/flowchart');
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

// Drag-to-reposition on the flowchart — persisted once per drag (on drag
// end), not per frame of movement.
export async function updateTaskManualPosition(
  taskId: string,
  positionX: number,
  positionY: number
): Promise<ActionResult> {
  try {
    await prisma.task.update({
      where: { id: taskId },
      data: { manualPositionX: positionX, manualPositionY: positionY },
    });
  } catch {
    return { success: false, error: 'Failed to save position' };
  }
  revalidatePath('/works/flowchart');
  return { success: true };
}

export interface TaskDeleteImpact {
  taskName: string;
  humanTaskId: string;
  status: string;
  dependentCount: number;
}

// Read-only — powers the flowchart's delete confirmation dialog so it can
// disable/explain the confirm button (completed task, or N dependents)
// *before* the admin attempts the delete, rather than reacting to a generic
// error after the fact.
export async function getTaskDeleteImpact(taskId: string): Promise<ActionResult<TaskDeleteImpact>> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { taskId: true, taskName: true, status: true },
  });
  if (!task) return { success: false, error: 'Task not found' };

  const dependentCount = await prisma.taskDependency.count({ where: { dependsOnTaskId: taskId } });

  return {
    success: true,
    data: { taskName: task.taskName, humanTaskId: task.taskId, status: task.status, dependentCount },
  };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  let task;
  try {
    task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }

  if (!task) return { success: false, error: 'Task not found' };
  if (task.status === 'completed') return { success: false, error: 'Completed tasks cannot be deleted' };

  try {
    await prisma.task.delete({ where: { id: taskId } });
  } catch {
    return { success: false, error: 'Failed to delete task' };
  }

  revalidatePath('/tasks');
  revalidatePath('/works');
  revalidatePath('/works/flowchart');
  return { success: true };
}
