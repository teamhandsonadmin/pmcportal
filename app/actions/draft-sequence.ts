'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentClientProfile, type CurrentClientProfile } from '@/lib/auth/current-client';
import { wouldCreateCycle } from '@/lib/utils/dependency-graph';
import type { ActionResult } from '@/lib/types/tasks';

export interface DraftNodeData {
  id: string;
  label: string;
  notes: string | null;
  plannedDurationDays: number | null;
  positionX: number;
  positionY: number;
}

export interface DraftEdgeData {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface DraftSequenceData {
  id: string;
  projectId: string;
  nodes: DraftNodeData[];
  edges: DraftEdgeData[];
}

const NOT_AUTHORIZED: ActionResult<never> = { success: false, error: 'Not authorized' };

function toNodeData(n: { id: string; label: string; notes: string | null; plannedDurationDays: number | null; positionX: number; positionY: number }): DraftNodeData {
  return { id: n.id, label: n.label, notes: n.notes, plannedDurationDays: n.plannedDurationDays, positionX: n.positionX, positionY: n.positionY };
}

function toEdgeData(e: { id: string; sourceNodeId: string; targetNodeId: string }): DraftEdgeData {
  return { id: e.id, sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId };
}

// Every action below re-derives the current session's client profile and
// cross-checks it against whatever draft/node/edge is being touched — never
// trusts a caller-supplied id alone, since a client hitting another
// project's draft id directly (bypassing the UI entirely) must still be
// rejected server-side.
export async function getOrCreateDraftSequence(projectId: string): Promise<ActionResult<DraftSequenceData>> {
  const profile = await getCurrentClientProfile();
  if (!profile || profile.clientProjectId !== projectId) return NOT_AUTHORIZED;

  let draft = await prisma.draftSequence.findFirst({
    where: { projectId },
    include: { nodes: true, edges: true },
  });

  if (!draft) {
    draft = await prisma.draftSequence.create({
      data: { projectId, createdBy: profile.id },
      include: { nodes: true, edges: true },
    });
  }

  return {
    success: true,
    data: {
      id: draft.id,
      projectId: draft.projectId,
      nodes: draft.nodes.map(toNodeData),
      edges: draft.edges.map(toEdgeData),
    },
  };
}

async function assertOwnsDraftSequence(profile: CurrentClientProfile, draftSequenceId: string): Promise<boolean> {
  const draft = await prisma.draftSequence.findUnique({ where: { id: draftSequenceId }, select: { projectId: true } });
  return !!draft && draft.projectId === profile.clientProjectId;
}

async function assertOwnsNode(profile: CurrentClientProfile, nodeId: string): Promise<boolean> {
  const node = await prisma.draftTaskNode.findUnique({
    where: { id: nodeId },
    select: { draftSequence: { select: { projectId: true } } },
  });
  return !!node && node.draftSequence.projectId === profile.clientProjectId;
}

export async function createDraftNode(
  draftSequenceId: string,
  label: string,
  positionX: number,
  positionY: number,
  notes?: string | null,
  plannedDurationDays?: number | null
): Promise<ActionResult<DraftNodeData>> {
  const profile = await getCurrentClientProfile();
  if (!profile) return NOT_AUTHORIZED;
  if (!(await assertOwnsDraftSequence(profile, draftSequenceId))) return NOT_AUTHORIZED;

  const trimmed = label.trim();
  if (!trimmed) return { success: false, error: 'Task name is required' };

  const node = await prisma.draftTaskNode.create({
    data: {
      draftSequenceId,
      label: trimmed,
      notes: notes || null,
      plannedDurationDays: plannedDurationDays ?? null,
      positionX,
      positionY,
    },
  });

  revalidatePath('/client/sequence');
  return { success: true, data: toNodeData(node) };
}

export async function updateDraftNodePosition(
  nodeId: string,
  positionX: number,
  positionY: number
): Promise<ActionResult> {
  const profile = await getCurrentClientProfile();
  if (!profile) return NOT_AUTHORIZED;
  if (!(await assertOwnsNode(profile, nodeId))) return NOT_AUTHORIZED;

  await prisma.draftTaskNode.update({ where: { id: nodeId }, data: { positionX, positionY } });
  revalidatePath('/client/sequence');
  return { success: true };
}

export async function updateDraftNode(
  nodeId: string,
  label?: string,
  notes?: string | null,
  plannedDurationDays?: number | null
): Promise<ActionResult> {
  const profile = await getCurrentClientProfile();
  if (!profile) return NOT_AUTHORIZED;
  if (!(await assertOwnsNode(profile, nodeId))) return NOT_AUTHORIZED;

  if (label !== undefined && !label.trim()) {
    return { success: false, error: 'Task name is required' };
  }

  await prisma.draftTaskNode.update({
    where: { id: nodeId },
    data: {
      ...(label !== undefined ? { label: label.trim() } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(plannedDurationDays !== undefined ? { plannedDurationDays } : {}),
    },
  });

  revalidatePath('/client/sequence');
  return { success: true };
}

export async function deleteDraftNode(nodeId: string): Promise<ActionResult> {
  const profile = await getCurrentClientProfile();
  if (!profile) return NOT_AUTHORIZED;
  if (!(await assertOwnsNode(profile, nodeId))) return NOT_AUTHORIZED;

  // Connected edges are removed by the DB's ON DELETE CASCADE
  // (DraftTaskEdge.sourceNode/targetNode relations) — not re-implemented
  // here in application code.
  await prisma.draftTaskNode.delete({ where: { id: nodeId } });

  revalidatePath('/client/sequence');
  return { success: true };
}

export async function createDraftEdge(
  draftSequenceId: string,
  sourceNodeId: string,
  targetNodeId: string
): Promise<ActionResult<DraftEdgeData>> {
  const profile = await getCurrentClientProfile();
  if (!profile) return NOT_AUTHORIZED;
  if (!(await assertOwnsDraftSequence(profile, draftSequenceId))) return NOT_AUTHORIZED;

  if (sourceNodeId === targetNodeId) {
    return { success: false, error: 'A task cannot connect to itself' };
  }

  const [sourceNode, targetNode, existingEdges] = await Promise.all([
    prisma.draftTaskNode.findUnique({ where: { id: sourceNodeId }, select: { draftSequenceId: true } }),
    prisma.draftTaskNode.findUnique({ where: { id: targetNodeId }, select: { draftSequenceId: true } }),
    prisma.draftTaskEdge.findMany({ where: { draftSequenceId }, select: { sourceNodeId: true, targetNodeId: true } }),
  ]);

  // Both nodes must actually belong to this same draft — a caller could
  // otherwise pass a node id borrowed from a different draft as source/target.
  if (!sourceNode || sourceNode.draftSequenceId !== draftSequenceId) return NOT_AUTHORIZED;
  if (!targetNode || targetNode.draftSequenceId !== draftSequenceId) return NOT_AUTHORIZED;

  // Edge convention matches the real TaskDependencyGraph: source = prerequisite,
  // target = the node that depends on it.
  const edgesForCycleCheck = existingEdges.map((e) => ({ id: e.targetNodeId, dependsOnId: e.sourceNodeId }));
  if (wouldCreateCycle(edgesForCycleCheck, targetNodeId, sourceNodeId)) {
    return {
      success: false,
      error: 'This would create a circular connection — the earlier task already (directly or indirectly) comes after this one.',
    };
  }

  let edge;
  try {
    edge = await prisma.draftTaskEdge.create({ data: { draftSequenceId, sourceNodeId, targetNodeId } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.toLowerCase().includes('unique')) {
      return { success: false, error: 'These tasks are already connected' };
    }
    return { success: false, error: 'Failed to connect tasks' };
  }

  revalidatePath('/client/sequence');
  return { success: true, data: toEdgeData(edge) };
}

export async function deleteDraftEdge(edgeId: string): Promise<ActionResult> {
  const profile = await getCurrentClientProfile();
  if (!profile) return NOT_AUTHORIZED;

  const edge = await prisma.draftTaskEdge.findUnique({
    where: { id: edgeId },
    select: { draftSequence: { select: { projectId: true } } },
  });
  // React Flow fires onEdgesDelete for edges connected to a node that's
  // just been deleted, in addition to the DB's own ON DELETE CASCADE having
  // already removed them — so "already gone" is an expected, non-error case
  // here, not just a not-found. Only a real ownership mismatch is rejected.
  if (!edge) return { success: true };
  if (edge.draftSequence.projectId !== profile.clientProjectId) return NOT_AUTHORIZED;

  await prisma.draftTaskEdge.delete({ where: { id: edgeId } }).catch(() => {});
  revalidatePath('/client/sequence');
  return { success: true };
}
