'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CreateTaskSchema, UpdateTaskPlannedDatesSchema, UpdateTaskStatusSchema, type CreateTaskInput } from '@/lib/validations/hvac';
import { getBlockingPrerequisites } from '@/lib/utils/status-rules';
import { validateTaskDates } from '@/lib/utils/working-days';
import type { ActionResult } from '@/lib/types/hvac';

interface CreatedTask {
  id: string;
  taskId: string;
  taskName: string;
}

// Shared by createHvacTask (the /works/[workId]/new form, which redirects to
// the new task's detail page) and createTaskFromCanvas (the flowchart's
// inline creation, which stays on the canvas) — both need the exact same
// task-create + checklist-seed + activity-log behavior, just different
// post-creation navigation. Callers are responsible for date validation
// before calling this (see validateTaskDates() at each call site) and for
// revalidatePath/redirect after.
async function createHvacTaskCore(data: CreateTaskInput): Promise<ActionResult<CreatedTask>> {
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

    task = await prisma.hvacTask.create({
      data: {
        taskId: `${prefix}-${Date.now().toString().slice(-6)}`,
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

export async function createHvacTask(
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

  const result = await createHvacTaskCore(parsed.data);
  if (!result.success || !result.data) return result;

  revalidatePath('/hvac');
  redirect(`/hvac/${result.data.id}`);
}

export interface CanvasTaskInput {
  taskName: string;
  workId: string;
  plannedStartDate?: string | null;
  dueDate?: string | null;
  taskTypeId?: string | null;
  manualPositionX: number;
  manualPositionY: number;
}

export interface CanvasTaskResult extends CreatedTask {
  manualPositionX: number;
  manualPositionY: number;
}

// The flowchart's inline "+ Add Task" — same validation/creation/checklist-
// seed/activity-log as createHvacTask above, but takes plain args (not
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

  const result = await createHvacTaskCore(parsed.data);
  if (!result.success) return result;
  if (!result.data) return { success: false, error: 'Failed to create task. Please try again.' };

  await prisma.hvacTask.update({
    where: { id: result.data.id },
    data: { manualPositionX: input.manualPositionX, manualPositionY: input.manualPositionY },
  }).catch(() => {});

  revalidatePath('/works/flowchart');
  revalidatePath('/works');
  return {
    success: true,
    data: { ...result.data, manualPositionX: input.manualPositionX, manualPositionY: input.manualPositionY },
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
    existing = await prisma.hvacTask.findUnique({
      where: { id: taskId },
      select: { status: true, actualStartDate: true, actualEndDate: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }

  if (!existing) return { success: false, error: 'Task not found' };
  if (existing.status === 'completed') return { success: false, error: 'Completed tasks are locked' };

  if (parsed.data.status === 'in_progress') {
    if (existing.status !== 'ready') {
      return { success: false, error: 'Task must be in Ready state before starting' };
    }

    // Cross-trade gate — independent of the checklist system above. A task
    // can be checklist-`ready` and still be waiting on another trade's task.
    const prereqRows = await prisma.taskDependency.findMany({
      where: { taskId },
      select: {
        dependsOnTask: { select: { id: true, taskId: true, taskName: true, status: true } },
      },
    }).catch(() => []);

    const blockers = getBlockingPrerequisites(prereqRows.map((r) => r.dependsOnTask));
    if (blockers.length > 0) {
      const names = blockers.map((b) => `${b.taskId} (${b.taskName})`).join(', ');
      return { success: false, error: `Blocked by: ${names} — not yet completed` };
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
    await prisma.hvacTask.update({
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

  revalidatePath(`/hvac/${taskId}`);
  revalidatePath(`/hvac/${taskId}/overview`);
  revalidatePath('/hvac');
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
    existing = await prisma.hvacTask.findUnique({
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
    await prisma.hvacTask.update({ where: { id: taskId }, data: next });
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

  revalidatePath(`/hvac/${taskId}`);
  revalidatePath('/hvac');
  return { success: true };
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
  value: string | null // 'YYYY-MM-DD', or null to clear
): Promise<ActionResult> {
  if (field !== 'actualStartDate' && field !== 'actualEndDate') {
    return { success: false, error: 'Invalid field' };
  }

  let existing;
  try {
    existing = await prisma.hvacTask.findUnique({
      where: { id: taskId },
      select: { actualStartDate: true, actualEndDate: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }
  if (!existing) return { success: false, error: 'Task not found' };

  const newDate = value ? new Date(value) : null;
  const nextStart = field === 'actualStartDate' ? newDate : existing.actualStartDate;
  const nextEnd = field === 'actualEndDate' ? newDate : existing.actualEndDate;
  if (nextStart && nextEnd && nextEnd < nextStart) {
    return { success: false, error: 'Actual completion date cannot be before actual start date' };
  }

  try {
    await prisma.hvacTask.update({ where: { id: taskId }, data: { [field]: newDate } });
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

  revalidatePath(`/hvac/${taskId}`);
  revalidatePath(`/hvac/${taskId}/overview`);
  return { success: true };
}

// Flowchart inline rename — deliberately just the name, not a full edit
// surface; anything beyond quick fields still goes through the task detail
// page (see components/tasks/TaskDependencyGraph.tsx's quick-edit dialog).
export async function updateTaskName(taskId: string, taskName: string): Promise<ActionResult> {
  const trimmed = taskName.trim();
  if (trimmed.length < 3) return { success: false, error: 'Task name must be at least 3 characters' };
  if (trimmed.length > 200) return { success: false, error: 'Task name is too long' };

  try {
    await prisma.hvacTask.update({ where: { id: taskId }, data: { taskName: trimmed } });
  } catch {
    return { success: false, error: 'Failed to update task name' };
  }

  revalidatePath('/works/flowchart');
  revalidatePath(`/hvac/${taskId}`);
  return { success: true };
}

// Drag-to-reposition on the flowchart — persisted once per drag (on drag
// end), not per frame of movement. Null clears the override (used by
// resetManualPositions below).
export async function updateTaskManualPosition(
  taskId: string,
  positionX: number,
  positionY: number
): Promise<ActionResult> {
  try {
    await prisma.hvacTask.update({
      where: { id: taskId },
      data: { manualPositionX: positionX, manualPositionY: positionY },
    });
  } catch {
    return { success: false, error: 'Failed to save position' };
  }
  revalidatePath('/works/flowchart');
  return { success: true };
}

// "Reset Layout" — clears manual position overrides for whichever tasks are
// currently visible in the caller's graph (there's no hard server-side
// "current project" scope on this page today; the client-side Work/Project
// filters already narrow what's passed in here, so this reverts exactly
// what's on screen back to pure dagre auto-layout).
export async function resetManualPositions(taskIds: string[]): Promise<ActionResult> {
  if (taskIds.length === 0) return { success: true };
  try {
    await prisma.hvacTask.updateMany({
      where: { id: { in: taskIds } },
      data: { manualPositionX: null, manualPositionY: null },
    });
  } catch {
    return { success: false, error: 'Failed to reset layout' };
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
  const task = await prisma.hvacTask.findUnique({
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

export async function deleteHvacTask(taskId: string): Promise<ActionResult> {
  let task;
  try {
    task = await prisma.hvacTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }

  if (!task) return { success: false, error: 'Task not found' };
  if (task.status === 'completed') return { success: false, error: 'Completed tasks cannot be deleted' };

  try {
    await prisma.hvacTask.delete({ where: { id: taskId } });
  } catch {
    return { success: false, error: 'Failed to delete task' };
  }

  revalidatePath('/hvac');
  revalidatePath('/works');
  revalidatePath('/works/flowchart');
  return { success: true };
}
