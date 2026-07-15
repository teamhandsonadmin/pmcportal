'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UpdateProjectLocationSchema, UpdateProjectTotalSftSchema, UpdateProjectInfoSchema } from '@/lib/validations/projects';
import type { ActionResult } from '@/lib/types/hvac';

const CreateProjectSchema = z.object({
  name:     z.string().min(2).max(200),
  address:  z.string().max(500).optional().nullable(),
  area:     z.string().max(50).optional().nullable(),
  budget:   z.string().max(100).optional().nullable(),
  photoUrl: z.string().url().optional().nullable().or(z.literal('')),
});

export async function createProject(_prev: unknown, formData: FormData) {
  const raw = {
    name:     formData.get('name'),
    address:  formData.get('address') || null,
    area:     formData.get('area') || null,
    budget:   formData.get('budget') || null,
    photoUrl: formData.get('photoUrl') || null,
  };

  const parsed = CreateProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Validation failed' };
  }

  const d = parsed.data;
  const project = await prisma.project.create({
    data: {
      name:     d.name,
      address:  d.address ?? null,
      area:     d.area ?? null,
      budget:   d.budget ?? null,
      photoUrl: d.photoUrl || null,
    },
  });

  redirect(`/projects/${project.id}`);
}

export async function updateProjectLocation(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    projectId: formData.get('projectId'),
    siteLatitude: formData.get('siteLatitude'),
    siteLongitude: formData.get('siteLongitude'),
    siteRadiusMeters: formData.get('siteRadiusMeters') || null,
  };

  const parsed = UpdateProjectLocationSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { projectId, siteLatitude, siteLongitude, siteRadiusMeters } = parsed.data;

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { siteLatitude, siteLongitude, siteRadiusMeters: siteRadiusMeters ?? null },
    });
  } catch {
    return { success: false, error: 'Failed to save site location.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'site_location_updated',
      payload: { projectId, siteLatitude, siteLongitude, siteRadiusMeters },
    },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  return { success: true };
}

// Project-wide SFT target, separate from any individual HvacTask.totalSft.
// Direct positional args (not a FormData/useActionState form action) —
// matches updateTaskTotalSft's own pattern for the equivalent per-task field.
export async function updateProjectTotalSft(projectId: string, totalSft: number): Promise<ActionResult> {
  const parsed = UpdateProjectTotalSftSchema.safeParse({ projectId, totalSft });
  if (!parsed.success) {
    return { success: false, error: 'Invalid total SFT value' };
  }

  try {
    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { totalSft: parsed.data.totalSft },
    });
  } catch {
    return { success: false, error: 'Failed to update total SFT' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'project_sft_target_updated',
      payload: { projectId: parsed.data.projectId, totalSft: parsed.data.totalSft },
    },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  return { success: true };
}

export async function updateProjectInfo(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    projectId: formData.get('projectId'),
    name:      formData.get('name'),
    address:   formData.get('address') || null,
    area:      formData.get('area') || null,
    budget:    formData.get('budget') || null,
    photoUrl:  formData.get('photoUrl') || null,
  };

  const parsed = UpdateProjectInfoSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { projectId, name, address, area, budget, photoUrl } = parsed.data;

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { name, address: address ?? null, area: area ?? null, budget: budget ?? null, photoUrl: photoUrl || null },
    });
  } catch {
    return { success: false, error: 'Failed to save project info.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'project_info_updated',
      payload: { projectId, name, address, area, budget, photoUrl },
    },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  return { success: true };
}

export interface DuplicateProjectResult {
  newProjectId: string;
  taskCount: number;
  seriesEdgeCount: number;
  parallelEdgeCount: number;
  dependencyItemCount: number;
  sftEntryCount: number;
}

// Work.code (varchar 10) and HvacTask.taskId (varchar 20) are both globally
// unique, so a clone can't reuse the original's — this finds the first
// "-C{n}" suffixed variant not already taken, truncating the base so the
// result still fits the column, and reserves it in `taken` immediately so
// two clones created in the same run never collide with each other either.
function withUniqueSuffix(base: string, maxLen: number, taken: Set<string>): string {
  let n = 2;
  for (;;) {
    const suffix = `-C${n}`;
    const candidate = (base.length + suffix.length <= maxLen ? base : base.slice(0, maxLen - suffix.length)) + suffix;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
    n++;
  }
}

// Deep-clones a project's full task graph (Works, HvacTasks, checklist
// items + their completion state, series/parallel edges, SFT progress
// history) under a brand-new Project row — an archival snapshot, not a
// blank template. Does NOT clone ActivityLog (tied to the original's real
// audit history) or TaskType (a shared global lookup table, not per-project
// — clones just reference the same taskTypeId). Tasks with no `workId` at
// all (structurally impossible to attribute to a project via the
// work.projectId join) are not part of this project's query and won't be
// cloned — not a case that exists in the current real dataset, but worth
// knowing if it ever does.
//
// PERFORMANCE NOTE: a real project's checklist alone can be 400+
// DependencyItem rows (the standard template × every task). An earlier
// version of this function created every row with its own sequential
// `.create()` call inside one interactive transaction and blew the 30s
// transaction timeout on a 13-task project (481 items, one network
// round-trip each). Every table here is now assembled as a plain array with
// a client-generated `id` (so FK maps are known up front) and inserted with
// one `createMany()` per table — a handful of round-trips total, regardless
// of row count.
export async function duplicateProject(projectId: string, newName: string): Promise<ActionResult<DuplicateProjectResult>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const original = await tx.project.findUniqueOrThrow({ where: { id: projectId } });

      const newProject = await tx.project.create({
        data: {
          name: newName,
          address: original.address,
          area: original.area,
          budget: original.budget,
          photoUrl: original.photoUrl,
          siteLatitude: original.siteLatitude,
          siteLongitude: original.siteLongitude,
          siteRadiusMeters: original.siteRadiusMeters,
          totalSft: original.totalSft,
        },
      });

      // ── Works ──
      const works = await tx.work.findMany({ where: { projectId } });
      const takenWorkCodes = new Set((await tx.work.findMany({ select: { code: true } })).map((w) => w.code));
      const workIdMap = new Map<string, string>();
      const workRows = works.map((w) => {
        const newId = randomUUID();
        workIdMap.set(w.id, newId);
        return {
          id: newId,
          name: w.name,
          code: withUniqueSuffix(w.code, 10, takenWorkCodes),
          description: w.description,
          color: w.color,
          projectId: newProject.id,
        };
      });
      if (workRows.length > 0) await tx.work.createMany({ data: workRows });

      // ── HvacTasks ──
      const tasks = await tx.hvacTask.findMany({ where: { work: { projectId } } });
      const takenTaskIds = new Set((await tx.hvacTask.findMany({ select: { taskId: true } })).map((t) => t.taskId));
      const taskIdMap = new Map<string, string>();
      const taskRows = tasks.map((t) => {
        const newId = randomUUID();
        taskIdMap.set(t.id, newId);
        return {
          id: newId,
          taskId: withUniqueSuffix(t.taskId, 20, takenTaskIds),
          taskName: t.taskName,
          projectName: newName,
          description: t.description,
          status: t.status,
          assignedTo: t.assignedTo,
          createdBy: t.createdBy,
          plannedStartDate: t.plannedStartDate,
          dueDate: t.dueDate,
          actualStartDate: t.actualStartDate,
          actualEndDate: t.actualEndDate,
          workId: t.workId ? workIdMap.get(t.workId) ?? null : null,
          taskTypeId: t.taskTypeId,
          totalSft: t.totalSft,
          manualPositionX: t.manualPositionX,
          manualPositionY: t.manualPositionY,
        };
      });
      if (taskRows.length > 0) await tx.hvacTask.createMany({ data: taskRows });

      const originalTaskIds = [...taskIdMap.keys()];

      // ── DependencyItems + DependencyCompletions ──
      const depItems = await tx.dependencyItem.findMany({
        where: { taskId: { in: originalTaskIds } },
        include: { completion: true },
      });
      const depItemIdMap = new Map<string, string>();
      const depItemRows = depItems.map((di) => {
        const newId = randomUUID();
        depItemIdMap.set(di.id, newId);
        return {
          id: newId,
          taskId: taskIdMap.get(di.taskId)!,
          category: di.category,
          itemLabel: di.itemLabel,
          isMandatory: di.isMandatory,
          sortOrder: di.sortOrder,
        };
      });
      if (depItemRows.length > 0) await tx.dependencyItem.createMany({ data: depItemRows });

      const completionRows = depItems
        .filter((di) => di.completion)
        .map((di) => ({
          itemId: depItemIdMap.get(di.id)!,
          status: di.completion!.status,
          comment: di.completion!.comment,
          completedBy: di.completion!.completedBy,
          completedAt: di.completion!.completedAt,
        }));
      if (completionRows.length > 0) await tx.dependencyCompletion.createMany({ data: completionRows });

      // ── TaskDependency (series) ──
      const deps = await tx.taskDependency.findMany({ where: { taskId: { in: originalTaskIds } } });
      const seriesRows = deps
        .map((d) => ({ taskId: taskIdMap.get(d.taskId), dependsOnTaskId: taskIdMap.get(d.dependsOnTaskId) }))
        .filter((d): d is { taskId: string; dependsOnTaskId: string } => !!d.taskId && !!d.dependsOnTaskId);
      if (seriesRows.length > 0) await tx.taskDependency.createMany({ data: seriesRows });

      // ── TaskParallelLink ──
      const parallels = await tx.taskParallelLink.findMany({ where: { taskAId: { in: originalTaskIds } } });
      const parallelRows = parallels
        .map((p) => ({ taskAId: taskIdMap.get(p.taskAId), taskBId: taskIdMap.get(p.taskBId) }))
        .filter((p): p is { taskAId: string; taskBId: string } => !!p.taskAId && !!p.taskBId);
      if (parallelRows.length > 0) await tx.taskParallelLink.createMany({ data: parallelRows });

      // ── SftProgressEntry ──
      const sftEntries = await tx.sftProgressEntry.findMany({ where: { taskId: { in: originalTaskIds } } });
      const sftRows = sftEntries.map((e) => ({
        taskId: taskIdMap.get(e.taskId)!,
        entryDate: e.entryDate,
        sftCompleted: e.sftCompleted,
        headcount: e.headcount,
        notes: e.notes,
        recordedBy: e.recordedBy,
      }));
      if (sftRows.length > 0) await tx.sftProgressEntry.createMany({ data: sftRows });

      await tx.activityLog.create({
        data: {
          taskId: null,
          actionType: 'project_archived_as_copy',
          payload: { originalProjectId: projectId, newProjectId: newProject.id, newProjectName: newName },
        },
      });

      return {
        newProjectId: newProject.id,
        taskCount: taskRows.length,
        seriesEdgeCount: seriesRows.length,
        parallelEdgeCount: parallelRows.length,
        dependencyItemCount: depItemRows.length,
        sftEntryCount: sftRows.length,
      };
    }, { timeout: 30000 });

    revalidatePath('/projects');
    revalidatePath('/works');
    revalidatePath('/works/flowchart');
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to duplicate project' };
  }
}
