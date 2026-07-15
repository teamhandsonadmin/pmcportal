'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AddTaskDependencySchema, UpdateDependencyTypeSchema } from '@/lib/validations/task-dependencies';
import { wouldCreateCycle } from '@/lib/utils/dependency-graph';
import type { ActionResult, TaskStatus } from '@/lib/types/hvac';

async function revalidateTaskFamily(taskId: string, dependsOnTaskId: string) {
  revalidatePath(`/hvac/${taskId}`);
  revalidatePath(`/hvac/${taskId}/overview`);
  revalidatePath(`/hvac/${dependsOnTaskId}`);
  revalidatePath(`/hvac/${dependsOnTaskId}/overview`);
  revalidatePath('/works');
  // The flowchart canvas is a newer consumer of this action (connecting two
  // tasks by clicking) and wasn't in this list before — without it, the
  // page's own server-rendered edge list wouldn't refresh (the canvas keeps
  // working via its own local optimistic edge, but a hard reload or a second
  // browser tab would show stale data until this was added).
  revalidatePath('/works/flowchart');
}

export async function addTaskDependency(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = AddTaskDependencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      success: false,
      error:
        (flat.formErrors[0] as string | undefined) ??
        (flat.fieldErrors as Record<string, string[]>),
    };
  }

  const { taskId, dependsOnTaskId, type } = parsed.data;

  const existingEdges = await prisma.taskDependency.findMany({
    select: { taskId: true, dependsOnTaskId: true },
  });

  if (wouldCreateCycle(existingEdges.map((e) => ({ id: e.taskId, dependsOnId: e.dependsOnTaskId })), taskId, dependsOnTaskId)) {
    return {
      success: false,
      error: 'This would create a circular dependency — the prerequisite task already (directly or indirectly) depends on this task.',
    };
  }

  try {
    await prisma.taskDependency.create({ data: { taskId, dependsOnTaskId, type } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return { success: false, error: 'This dependency already exists.' };
    }
    return { success: false, error: 'Failed to add dependency.' };
  }

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'task_dependency_added',
      payload: { taskId, dependsOnTaskId, type },
    },
  }).catch(() => {});

  await revalidateTaskFamily(taskId, dependsOnTaskId);
  return { success: true };
}

// Changes an existing edge's type in place — no cycle-check needed (type
// doesn't affect graph topology, only status-gating semantics), just needs
// the row to exist. Deliberately separate from reconnectTaskDependency:
// changing type and changing which two tasks are linked are independent
// edits on the canvas (a type dropdown appears alongside the existing
// delete/reconnect controls when an edge is selected).
export async function updateDependencyType(dependencyId: string, type: string): Promise<ActionResult> {
  const parsed = UpdateDependencyTypeSchema.safeParse({ dependencyId, type });
  if (!parsed.success) {
    return { success: false, error: 'Invalid dependency type' };
  }

  const existing = await prisma.taskDependency.findUnique({
    where: { id: parsed.data.dependencyId },
    select: { taskId: true, dependsOnTaskId: true, type: true },
  }).catch(() => null);
  if (!existing) return { success: false, error: 'Dependency not found' };

  try {
    await prisma.taskDependency.update({
      where: { id: parsed.data.dependencyId },
      data: { type: parsed.data.type },
    });
  } catch {
    return { success: false, error: 'Failed to update dependency type' };
  }

  await prisma.activityLog.create({
    data: {
      taskId: existing.taskId,
      actionType: 'task_dependency_type_changed',
      payload: { dependencyId: parsed.data.dependencyId, oldType: existing.type, newType: parsed.data.type },
    },
  }).catch(() => {});

  await revalidateTaskFamily(existing.taskId, existing.dependsOnTaskId);
  return { success: true };
}

// Updates an existing TaskDependency row's endpoints in place (not a
// delete+recreate) — the row's id, and any future audit trail keyed to it,
// stays continuous across a drag-to-reconnect on the canvas. Mirrors
// addTaskDependency's cycle-check, but re-fetches edges EXCLUDING this row's
// own current values first, since a row being moved should never be
// compared against its own pre-move state.
export async function reconnectTaskDependency(
  dependencyId: string,
  newTaskId: string,
  newDependsOnTaskId: string
): Promise<ActionResult> {
  if (newTaskId === newDependsOnTaskId) {
    return { success: false, error: 'A task cannot depend on itself' };
  }

  const existing = await prisma.taskDependency.findUnique({
    where: { id: dependencyId },
    select: { taskId: true, dependsOnTaskId: true },
  }).catch(() => null);
  if (!existing) return { success: false, error: 'Dependency not found' };

  const otherEdges = await prisma.taskDependency.findMany({
    where: { id: { not: dependencyId } },
    select: { taskId: true, dependsOnTaskId: true },
  });

  if (wouldCreateCycle(otherEdges.map((e) => ({ id: e.taskId, dependsOnId: e.dependsOnTaskId })), newTaskId, newDependsOnTaskId)) {
    return {
      success: false,
      error: 'This would create a circular dependency — the prerequisite task already (directly or indirectly) depends on this task.',
    };
  }

  try {
    await prisma.taskDependency.update({
      where: { id: dependencyId },
      data: { taskId: newTaskId, dependsOnTaskId: newDependsOnTaskId },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return { success: false, error: 'This dependency already exists.' };
    }
    return { success: false, error: 'Failed to reconnect dependency.' };
  }

  await prisma.activityLog.create({
    data: {
      taskId: newTaskId,
      actionType: 'task_dependency_reconnected',
      payload: {
        dependencyId,
        oldTaskId: existing.taskId,
        oldDependsOnTaskId: existing.dependsOnTaskId,
        newTaskId,
        newDependsOnTaskId,
      },
    },
  }).catch(() => {});

  await revalidateTaskFamily(existing.taskId, existing.dependsOnTaskId);
  await revalidateTaskFamily(newTaskId, newDependsOnTaskId);
  return { success: true };
}

export async function removeTaskDependency(dependencyId: string): Promise<ActionResult> {
  let dep;
  try {
    dep = await prisma.taskDependency.findUnique({
      where: { id: dependencyId },
      select: { taskId: true, dependsOnTaskId: true },
    });
  } catch {
    return { success: false, error: 'Dependency not found' };
  }

  if (!dep) return { success: false, error: 'Dependency not found' };

  try {
    await prisma.taskDependency.delete({ where: { id: dependencyId } });
  } catch {
    return { success: false, error: 'Failed to remove dependency' };
  }

  await prisma.activityLog.create({
    data: {
      taskId: dep.taskId,
      actionType: 'task_dependency_removed',
      payload: { taskId: dep.taskId, dependsOnTaskId: dep.dependsOnTaskId },
    },
  }).catch(() => {});

  await revalidateTaskFamily(dep.taskId, dep.dependsOnTaskId);
  return { success: true };
}

export interface TaskDependencyContextItem {
  id: string;
  taskId: string;
  taskName: string;
  status: TaskStatus;
  workCode: string;
}

export interface TaskDependencyContext {
  prerequisites: (TaskDependencyContextItem & { dependencyId: string })[];
  candidateTasks: TaskDependencyContextItem[];
}

// Read helper shared by both task-detail pages that render TaskDependencyCard
// (the main /hvac/[taskId] page and its /overview sub-route) so they don't
// each duplicate the same two queries.
export async function getTaskDependencyContext(taskId: string): Promise<TaskDependencyContext> {
  const task = await prisma.hvacTask.findUnique({
    where: { id: taskId },
    select: { work: { select: { projectId: true } } },
  });
  const projectId = task?.work?.projectId ?? null;

  const [prereqRows, otherTasks] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { taskId },
      select: {
        id: true,
        dependsOnTask: {
          select: { id: true, taskId: true, taskName: true, status: true, work: { select: { code: true } } },
        },
      },
    }),
    prisma.hvacTask.findMany({
      where: {
        id: { not: taskId },
        // If this task has no resolvable project (no work, or work has no
        // project), fall back to every other task in the app rather than
        // silently returning an empty candidate list.
        ...(projectId ? { work: { projectId } } : {}),
      },
      select: { id: true, taskId: true, taskName: true, status: true, work: { select: { code: true } } },
      orderBy: { taskName: 'asc' },
    }),
  ]);

  const prerequisites = prereqRows.map((r) => ({
    dependencyId: r.id,
    id: r.dependsOnTask.id,
    taskId: r.dependsOnTask.taskId,
    taskName: r.dependsOnTask.taskName,
    status: r.dependsOnTask.status,
    workCode: r.dependsOnTask.work?.code ?? '—',
  }));
  const prerequisiteIds = new Set(prerequisites.map((p) => p.id));

  const candidateTasks = otherTasks
    .filter((t) => !prerequisiteIds.has(t.id))
    .map((t) => ({
      id: t.id,
      taskId: t.taskId,
      taskName: t.taskName,
      status: t.status,
      workCode: t.work?.code ?? '—',
    }));

  return { prerequisites, candidateTasks };
}

export interface DependencyGraphData {
  nodes: {
    id: string;
    taskId: string;
    taskName: string;
    workCode: string;
    workColor: string;
    status: TaskStatus;
    assigneeName: string | null;
  }[];
  edges: { id: string; source: string; target: string }[];
}

// projectId is accepted for forward-compatibility with a future project-
// scoped page, but is unused by the current caller (app/(app)/works/page.tsx
// already fetches globally with no project scoping — see CHANGELOG for why).
export async function getTaskDependencyGraph(projectId?: string): Promise<DependencyGraphData> {
  const [tasks, deps, users] = await Promise.all([
    prisma.hvacTask.findMany({
      where: projectId ? { work: { projectId } } : {},
      select: {
        id: true,
        taskId: true,
        taskName: true,
        status: true,
        assignedTo: true,
        work: { select: { code: true, color: true } },
      },
    }),
    prisma.taskDependency.findMany({ select: { id: true, taskId: true, dependsOnTaskId: true } }),
    prisma.userProfile.findMany({ select: { id: true, fullName: true } }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.fullName]));
  const taskIds = new Set(tasks.map((t) => t.id));

  return {
    nodes: tasks.map((t) => ({
      id: t.id,
      taskId: t.taskId,
      taskName: t.taskName,
      workCode: t.work?.code ?? '—',
      workColor: t.work?.color ?? '#9CA3AF',
      status: t.status,
      assigneeName: t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
    })),
    edges: deps
      .filter((d) => taskIds.has(d.taskId) && taskIds.has(d.dependsOnTaskId))
      .map((d) => ({ id: d.id, source: d.dependsOnTaskId, target: d.taskId })),
  };
}
