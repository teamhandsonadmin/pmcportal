'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AddTaskDependencySchema } from '@/lib/validations/task-dependencies';
import { wouldCreateCycle } from '@/lib/utils/dependency-graph';
import type { ActionResult, TaskStatus } from '@/lib/types/hvac';

async function revalidateTaskFamily(taskId: string, dependsOnTaskId: string) {
  revalidatePath(`/hvac/${taskId}`);
  revalidatePath(`/hvac/${taskId}/overview`);
  revalidatePath(`/hvac/${dependsOnTaskId}`);
  revalidatePath(`/hvac/${dependsOnTaskId}/overview`);
  revalidatePath('/works');
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

  const { taskId, dependsOnTaskId } = parsed.data;

  const existingEdges = await prisma.taskDependency.findMany({
    select: { taskId: true, dependsOnTaskId: true },
  });

  if (wouldCreateCycle(existingEdges, taskId, dependsOnTaskId)) {
    return {
      success: false,
      error: 'This would create a circular dependency — the prerequisite task already (directly or indirectly) depends on this task.',
    };
  }

  try {
    await prisma.taskDependency.create({ data: { taskId, dependsOnTaskId } });
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
      payload: { taskId, dependsOnTaskId },
    },
  }).catch(() => {});

  await revalidateTaskFamily(taskId, dependsOnTaskId);
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
