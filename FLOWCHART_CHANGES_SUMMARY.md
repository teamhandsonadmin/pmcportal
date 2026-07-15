# Flowchart Changes Summary — Permanent Delete, Floating Edges, Layout Tuning, Parallel Connector

Covers the four parts of the "Permanent Delete, Straight Arrows, Layout Tuning, Parallel Connector"
prompt. Every claim below is backed by a test actually run against the real database via the real
server actions (disposable data, always cleaned up afterward — verified 0 leftover each time), not
an assumption.

---

## Part 1 — Reverted to genuine, permanent, no-restore deletion

**What changed:**
- `app/actions/bulk-delete.ts`: `bulkDeleteTasks` rewritten back to a real `prisma.hvacTask.deleteMany` (was `updateMany` setting `deletedAt`). Removed `getRecentlyDeletedBatch`, `restoreBulkDeletion`, `purgeExpiredSoftDeletes`, and the `RECOVERY_WINDOW_HOURS` constant entirely. `buildScopeWhere` no longer filters `deletedAt: null` (that condition doesn't exist anymore). The `ActivityLog` payload is back to its original `{ scope, deletedCount }` shape (no `taskIds`).
- `app/(app)/layout.tsx`: reverted to the original plain, synchronous component — removed the `purgeExpiredSoftDeletes()` call and the import.
- Removed the `deletedAt: null` filter/relation-filter that had been added to 11 query sites: every `[taskId]` detail route (`layout.tsx`, `page.tsx`, `activity/page.tsx`, `overview/page.tsx`, `dependencies/page.tsx`), `works/[workId]/page.tsx`, `projects/page.tsx`, `task-dependencies.ts` (`getTaskDependencyContext`, `getTaskDependencyGraph`), `dependency-templates.ts` (`applyTemplateToProject`), `lib/data/delay-engine.ts`, `lib/data/gantt-delay.ts`. Verified via `grep -rln "deletedAt"` across the repo afterward — zero matches outside `prisma/schema.prisma` and the generated Prisma client.
- The `HvacTask.deletedAt` column itself was **left in the schema** (per the instruction: removing a column is a bigger, riskier migration than leaving an unused nullable field). It's simply never written to or read from anywhere in the app now.
- `components/tasks/BulkDeleteDialog.tsx`: **no change needed** — checked its copy first; it still said "This is a permanent action — there is no undo," "This will permanently delete...," "Permanently Delete," and "N tasks permanently deleted" throughout. That copy was never actually changed during the earlier soft-delete work, so it was already accurate the moment the revert landed.
- `deleteHvacTask` (individual task delete, `app/actions/hvac-tasks.ts`): confirmed unchanged — it was always a real `prisma.hvacTask.delete`, never touched by the soft-delete work in the first place (correctly scoped to bulk-delete-all only, per the original instruction).

**Tested:** Created one disposable task (`HARD-DELETE-TEST-TASK`), called the real `bulkDeleteTasks` scoped to that exact task name (not an empty/unscoped call — flagged and corrected after the environment's own safety classifier caught my first draft trying to call it unscoped, even against an already-empty table). Result:
```
bulkDeleteTasks result: {"success":true,"data":{"deletedCount":1}}
Task still exists in DB (should be null/gone): null
Total hvac_tasks rows remaining (should be 0): 0
Latest bulk_task_deletion activity log payload (should have NO taskIds field): {"scope":{...},"deletedCount":1}
```
Confirmed genuinely gone with no trace, and the activity log payload shape matches the original (pre-soft-delete) format exactly.

**Known gaps:** None. This part is fully reverted and verified.

---

## Part 2 — Genuine floating edges

**What changed:** `components/tasks/TaskDependencyGraph.tsx`:
- Removed `DagreEdgeData`, `buildOrthogonalPath`, `DagreEdge`, and the `isDirectHop`/`points`/`rankSpan`/`oneHopSpan` computation entirely.
- Added `getNodeIntersection()` — the standard ellipse-scaled-to-rectangle intersection algorithm, computing where the line between two nodes' live centers crosses each node's own boundary. Added `FloatingEdge`, which calls `useInternalNode(source)`/`useInternalNode(target)` (React Flow's public API for live node position/dimensions) and renders `getStraightPath()` between the two computed intersection points via `<BaseEdge>`.
- **Every edge now uses this one renderer** (`edgeTypes = { floating: FloatingEdge }`) — both the old dagre-auto-layout edges and the old fixed-handle `smoothstep` manual-position edges. Updated all four places that used to assign `'dagre'` or `'smoothstep'` as an edge type (initial edge construction, `layoutWithDagre`'s manual/auto branches, and the optimistic temp-edge insert in `completeConnection`) to assign `'floating'` instead.
- `layoutWithDagre` no longer computes per-edge `points`/`rankSpan` at all — dagre is used purely for node position layout now; edge geometry is 100% independent of it, recomputed live on every render from wherever the nodes actually are.

**Tested — the four required cases, run against the actual algorithm** (verbatim-copied from the source and diffed to confirm byte-for-byte match before running, since `getNodeIntersection` isn't currently exported):
- **Side-by-side** (same Y): source/target intersections both landed at `y=346` — a perfectly horizontal line, attaching exactly at each node's right/left edge.
- **Stacked** (same X): both intersections at `x=204` — perfectly vertical, attaching at the bottom edge of the top node.
- **Diagonal**: both intersection points verified exactly collinear with the true center-to-center line (cross-product `0.0000`), and confirmed to be real boundary points, not just the raw centers.
- **Core Cuttings convergence structure** (3-in/3-out, reconstructed from `prisma/seed-reference-sequence.ts`'s real tier definitions): all 6 edges produced correct, non-degenerate straight segments with the right boundary attachment (e.g. the vertically-aligned edge attached at exactly `x=368` top/bottom; the diagonal ones at the correspondingly offset points).

**Known gaps:** None found in this geometry. One thing worth naming: this is a straight-line floating edge (`getStraightPath`), not a curved one — if a future request wants curved/bezier floating edges, that's a different (larger) change, not something this pass did.

---

## Part 3 — Auto-layout re-verified against real-world messiness

**What changed:** nothing — `nodesep: 56, ranksep: 90` were tested and found to already hold up well; no retuning was needed.

**Tested:** Built a genuinely messy synthetic graph (verbatim-copied `layoutWithDagre` positioning logic, diffed against the source): a 6-wide fan-out, an 8-node deep chain, a 5-way convergence (more than Core Cuttings' 3), two fully disconnected components, and 3 completely unconnected nodes — 27 nodes, 20 edges total. Ran three scenarios:
- **Pure auto-layout**: 0 overlapping pairs.
- **Mixed manual+auto** (3 nodes dragged to arbitrary/adversarial positions, including one placed where it could plausibly collide): 0 overlapping pairs.
- **Reset Layout simulation** (clear all manual positions, recompute): 0 overlapping pairs, and the result was byte-for-byte identical to the pure-auto-layout run — confirming Reset Layout is fully deterministic and genuinely discards any prior manual mess.

Also reviewed `confirmResetLayout` (unchanged this session) directly: it re-runs `layoutWithDagre` with a literal empty `Map()` for manual positions across every currently-visible node, so it can never carry over stale positions from before the reset.

**Known gaps:** None found. If the real dataset (currently empty — see the note at the end) turns out to have layout problems once real tasks and connections exist again, that would be new information not available in this pass.

---

## Part 4 — Parallel connector built in full

**What changed:**
- `prisma/schema.prisma`: added `model TaskParallelLink` exactly as specified (symmetric `taskAId`/`taskBId`, cascade delete, `@@unique([taskAId, taskBId])`), plus the two reverse relations on `HvacTask`. Pushed to the live database and regenerated the Prisma client.
- `app/actions/task-parallel-links.ts` (new): `createParallelLink(taskAId, taskBId)` and `removeParallelLink(linkId)`. Checks both `(A,B)` and `(B,A)` orderings before inserting, rejects self-links, logs to `ActivityLog` (`task_parallel_link_added`/`_removed`), revalidates the same paths as the series-dependency actions.
- `lib/data/works.ts`: added a `taskParallelLink.findMany` query and a `parallelEdges` field on `getWorksData()`'s return value — explicitly commented that it's never read anywhere near the prerequisite-count/stats computation.
- `app/(app)/works/flowchart/page.tsx` → `components/tasks/TasksExplorer.tsx` → `components/tasks/TaskDependencyGraph.tsx`: threaded `parallelEdges` all the way through, filtered to currently-visible tasks the same way series edges already are.
- `TaskDependencyGraph.tsx`: added a second toolbar tool ("Parallel", two-horizontal-lines icon, distinct from Connect's diagonal-arrow icon), same click-tool-then-click-two-nodes pattern (`pendingParallelSource` state mirrors `pendingConnectSource`). Parallel edges render via the same `FloatingEdge` component as series edges, styled distinctly: solid green family (`#16A34A`/`#15803D`) vs. series' orange/indigo, **dashed**, and **no `markerEnd`** (confirmed by reading the edge-construction code — parallel edges are the only ones built without a `markerEnd` property at all). `layoutWithDagre` excludes `linkType: 'parallel'` edges from dagre's `g.setEdge()` ranking calls entirely (a parallel link has no real before/after, so it shouldn't influence rank), while still rendering as a floating line between wherever the two nodes land. `handleEdgesDelete` branches on `edge.data.linkType` to call `removeParallelLink` vs. `removeTaskDependency`. Added a small always-visible legend (bottom-left) showing both line styles with a one-line label each.
- Fixed a bug caught during implementation, before it shipped: the manual-position edge-recolor branch in `layoutWithDagre` would have overwritten a parallel edge's dashed/no-arrow styling with the series manual-edge style whenever either endpoint was dragged. Added an explicit `linkType === 'parallel'` early-return so parallel edges keep their own styling regardless of manual positioning.

**Tested — all three required checks, against real disposable tasks:**
- **Symmetric duplicate prevention**: created `(A,B)`, then attempted `(B,A)` — rejected with `"These tasks are already linked in parallel."`; confirmed only 1 row exists for the pair in `task_parallel_links`, not 2.
- **`getWorksData()` surfacing**: confirmed the created link appears in `parallelEdges` from a fresh call.
- **Removal**: confirmed the row is genuinely gone from the database after `removeParallelLink`.
- **Gating independence (the critical one)**: linked task A (left `blocked`, not completed) and task B in parallel. Moved B to `ready`, then called the real `updateTaskStatus(B, 'in_progress')`. Result: `in_progress` — succeeded freely. For contrast, this exact same setup with a real `TaskDependency` instead of a parallel link was verified earlier this session to correctly *block* with `"Blocked by: ... — not yet completed"` — proving the two features behave differently exactly as intended, not that gating is broken in general.
- Also confirmed via `grep -rln "taskParallelLink"` that the model is referenced in exactly two files (`task-parallel-links.ts` and `lib/data/works.ts`, the latter only for canvas display) — it does not appear anywhere in `hvac-tasks.ts` (`updateTaskStatus`), `delay-engine.ts`, or `gantt-delay.ts` at all, so there's no code path by which it *could* affect gating, independent of the runtime test above.

**Known gaps / scope decisions made and not asked about:**
- The per-node hover `NodeToolbar`'s quick "Connect" button was **not** mirrored for parallel links — only the main left-toolbar tool was built. The prompt asked for "a second toolbar tool," which this satisfies; the per-node shortcut is an additional convenience that wasn't explicitly requested, and I didn't want to add unrequested surface area.
- Duplicate-node placement (a separate, pre-existing feature) still doesn't collision-check — unrelated to this prompt, noted here only because Part 3's testing touched the same area.

---

## Overall verification

- `tsc --noEmit`: clean, zero errors, after every part.
- `npm run lint`: zero issues in any file touched this session. (The full project lint reports 1189 pre-existing problems, all confined to `lib/generated/prisma/*` — Prisma's own generated client code — plus two unrelated files never touched this session; confirmed by grepping the lint output for every file this work modified.)
- `next build`: succeeds cleanly, all 37 routes compile.
- Real dataset counts after all testing: `hvac_tasks: 0`, `task_dependencies: 0`, `task_parallel_links: 0`, `works: 16` — every test in this pass used disposable data that was fully cleaned up afterward, confirmed via count checks each time.

## One thing worth your attention before considering this finished

**The real dataset is still empty** (`hvac_tasks`/`task_dependencies` at 0/0) from the data-loss incident investigated in a separate, earlier pass — this prompt didn't ask me to restore it, so I didn't, but it means none of today's changes (floating edges, layout tuning, the parallel connector) have been seen against real production-scale data yet, only against disposable test tasks and synthetic/reconstructed graphs. Once real data exists again, it would be worth a quick visual pass in an actual browser — everything here was verified by running the real algorithms and real server actions directly (no browser access in this environment), which is rigorous for correctness but isn't the same as seeing it rendered.
