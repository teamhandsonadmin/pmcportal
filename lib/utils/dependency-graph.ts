export interface TaskDependencyEdge {
  taskId: string;
  dependsOnTaskId: string;
}

// Given every existing "taskId depends on dependsOnTaskId" edge plus one
// proposed new edge, returns true if adding the new edge would create a
// cycle (directly or transitively). Self-loops are always a cycle.
//
// A new edge (A depends on B) closes a loop exactly when B already
// (transitively) depends on A — i.e. there is an existing forward path from
// B through "depends on" edges that reaches A. We DFS forward from B along
// existing edges; if that traversal reaches A, the new edge would complete
// the loop A -> B -> ... -> A.
export function wouldCreateCycle(
  existingEdges: TaskDependencyEdge[],
  proposedTaskId: string,
  proposedDependsOnTaskId: string
): boolean {
  if (proposedTaskId === proposedDependsOnTaskId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of existingEdges) {
    const list = adjacency.get(edge.taskId);
    if (list) list.push(edge.dependsOnTaskId);
    else adjacency.set(edge.taskId, [edge.dependsOnTaskId]);
  }

  const visited = new Set<string>();
  const stack = [proposedDependsOnTaskId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === proposedTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = adjacency.get(current);
    if (next) stack.push(...next);
  }

  return false;
}
