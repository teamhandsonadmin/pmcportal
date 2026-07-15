// Generic shape so this one implementation is shared by both the real
// TaskDependency graph and the client draft-sequence canvas, rather than
// each maintaining its own copy of the same cycle-detection logic. `id` is
// the dependent node, `dependsOnId` is its prerequisite — callers whose own
// column names differ (e.g. TaskDependency.taskId/dependsOnTaskId) map into
// this shape at the call site.
export interface DependencyEdge {
  id: string;
  dependsOnId: string;
}

// Given every existing "id depends on dependsOnId" edge plus one proposed
// new edge, returns true if adding the new edge would create a cycle
// (directly or transitively). Self-loops are always a cycle.
//
// A new edge (A depends on B) closes a loop exactly when B already
// (transitively) depends on A — i.e. there is an existing forward path from
// B through "depends on" edges that reaches A. We DFS forward from B along
// existing edges; if that traversal reaches A, the new edge would complete
// the loop A -> B -> ... -> A.
export function wouldCreateCycle(
  existingEdges: DependencyEdge[],
  proposedId: string,
  proposedDependsOnId: string
): boolean {
  if (proposedId === proposedDependsOnId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of existingEdges) {
    const list = adjacency.get(edge.id);
    if (list) list.push(edge.dependsOnId);
    else adjacency.set(edge.id, [edge.dependsOnId]);
  }

  const visited = new Set<string>();
  const stack = [proposedDependsOnId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === proposedId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = adjacency.get(current);
    if (next) stack.push(...next);
  }

  return false;
}
