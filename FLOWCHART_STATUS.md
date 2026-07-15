# Flowchart Subsystem — Status Audit

Generated 2026-07-14. Pure audit — nothing was built or fixed in this pass. Every item below is
backed by a file reference, a grep result, or a test actually run (scripts written, executed
against the real database via the real server actions, then deleted — no leftover artifacts).
Where a test used disposable data, that's stated explicitly.

**Read this first:** real `hvac_tasks` data is currently at **zero rows** — see Item 1. This
happened again, today, during this audit's own investigation. See the "Most urgent finding"
section below before anything else.

---

## 1. Real data counts, right now

**Status: Data loss — 0 / 0 / 16.**

Queried directly via psql against the live database:

| Table | Count |
|---|---|
| `hvac_tasks` (total) | **0** |
| `hvac_tasks` with `deleted_at IS NULL` (active) | 0 |
| `hvac_tasks` with `deleted_at IS NOT NULL` (soft-deleted) | 0 |
| `task_dependencies` | **0** |
| `works` | 16 |

Zero soft-deleted rows too — this wasn't caught by the soft-delete mechanism (see Item 11 and the
urgent finding below). `works` (16) survived, consistent with earlier findings that bulk-delete
only ever touches `hvac_tasks`.

## Most urgent finding: a 4th real data wipe happened during this audit

`activity_log` has a `bulk_task_deletion` entry at **2026-07-14 12:26:17**, empty scope,
`deletedCount: 97` — this is on top of the three prior same-day wipes already investigated and
restored earlier (05:46, 08:26, 11:09). The 97 tasks restored earlier today are gone again.

Two concrete, checked facts about this specific entry:
- Its JSON payload is `{"scope": {...all empty...}, "deletedCount": 97}` — **no `taskIds` field**.
  The soft-delete rewrite of `bulkDeleteTasks` (this session, in progress, see Item 11) always
  writes `taskIds` into this payload. Its absence means this deletion did **not** run through the
  new soft-delete code.
- `hvac_tasks` has 0 rows with `deleted_at IS NOT NULL` — confirming this was a genuine hard
  delete, not a soft-delete that simply hasn't been surfaced in the UI yet.

A real `next dev` server for this app has been running the whole time (`ps aux` shows `next dev`
started earlier today, still listening on `:3000`). The most likely explanation is that this ran
through the browser against a compiled/cached version of the old `bulkDeleteTasks` (hard-delete)
action, independent of the in-progress source edits — but this isn't confirmed with certainty, and
it doesn't need to be: **the fact that matters is the safety net does not yet protect this app**,
whichever exact mechanism let this specific deletion through. See Item 11 for exactly what's built
vs. not yet wired in.

## 14. Leftover test artifacts

**Status: None found — trivially true right now, since the table is empty (Item 1).**

No `hvac_tasks` rows exist at all currently, so there is nothing named "Test Task," "Dummy Task,"
or `ZZZ_*`-prefixed to find. This will need re-checking once real data is restored.

---

## 2. Task creation on the canvas

**Status: Implemented — both the inline quick-add and the older full form page.**

- Canvas quick-add: toolbar "Add task" button → `handleAddTaskClick` → `openCreateForm(...)` →
  Dialog (`components/tasks/TaskDependencyGraph.tsx:1191-1258`) → `submitCreateForm()`
  (`TaskDependencyGraph.tsx:885-944`), which calls the real server action `createTaskFromCanvas`
  (`app/actions/hvac-tasks.ts:131-164`). That action validates via `CreateTaskSchema`, runs
  `validateTaskDates`, calls the shared `createHvacTaskCore` (real `prisma.hvacTask.create`, plus
  checklist seed + activity log), and persists the initial `manualPositionX/Y`.
- Older full form page: still present and functional — `app/(app)/works/[workId]/new/page.tsx`
  renders `<TaskForm>` (`components/hvac/TaskForm.tsx`), wired to `createHvacTask`
  (`app/actions/hvac-tasks.ts:84-109`), which redirects to the new task's detail page on success.
  Both paths share the same `createHvacTaskCore` (lines 24-82), so they can't drift apart in
  validation/seeding behavior.

## 3. Drag-to-reposition — tested concretely, not assumed

**Status: Implemented and confirmed working.**

Since real data is currently empty, this was tested with a disposable task (created via the real
`createTaskFromCanvas` action, deleted afterward — 0 leftover confirmed):
1. Created one throwaway task.
2. Called the real `updateTaskManualPosition(id, 333.25, 777.75)` action.
3. Re-ran `getWorksData()` — the exact function the `/works/flowchart` Server Component calls on
   every fresh request (`export const dynamic = 'force-dynamic'`, no cache) — simulating a hard
   refresh with no in-between state.
4. Result: `manualPositionX/Y` read back as `333.25, 777.75` — exact match.

This is genuine database persistence, not client-side state — confirmed by re-deriving from a
fresh, independent query rather than trusting anything held in memory during the test.

## 4. Series connections (`TaskDependency`, blocking)

**Status: Implemented — model, connect interaction, cycle prevention, and status gating all
confirmed working, tested concretely with disposable data (created and fully cleaned up after).**

Tests run against two throwaway tasks (A, B) created via the real `createTaskFromCanvas` action:

- **Model exists**: `model TaskDependency` in `prisma/schema.prisma` (`taskId`, `dependsOnTaskId`,
  both cascade-delete from `HvacTask`).
- **Connect interaction**: calling the real `addTaskDependency(B depends on A)` action created a
  real `task_dependencies` row — confirmed via direct query immediately after.
- **Cycle prevention**: calling `addTaskDependency(A depends on B)` immediately after (which would
  create a 2-cycle) was rejected: `{"success":false,"error":"This would create a circular
  dependency — the prerequisite task already (directly or indirectly) depends on this task."}` —
  and confirmed the reverse row was never actually written to the database.
- **Status gating** (`updateTaskStatus` in `app/actions/hvac-tasks.ts`): set B to `ready`
  (bypassing the checklist system directly, since that's a separate feature not under test here)
  while A was still `draft`. Calling `updateTaskStatus(B, 'in_progress')` was rejected:
  `{"success":false,"error":"Blocked by: FCEIL-902292 (AUDIT-TEST-TASK-A) — not yet completed"}`,
  and B's status was confirmed unchanged (`ready`) after the rejected attempt. Then set A to
  `completed` and repeated the same call — B's status was confirmed to actually become
  `in_progress` in the database. Both the block and the unblock are real, not assumed.

All disposable rows (2 tasks, 1 dependency, activity log entries) were deleted afterward; a
follow-up count confirmed 0 leftover.

## 5. Parallel connections (`TaskParallelLink`, non-blocking)

**Status: Not implemented — confirmed fresh, not relying on any prior conversation claim.**

```
grep -n "^model " prisma/schema.prisma   → no TaskParallelLink
grep -rni "parallellink|parallel_link|TaskParallelLink" . (excluding node_modules) → zero matches
```

No model, no migration, no server action, no UI reference anywhere in the repository. The only
edge type between tasks today is `TaskDependency` (directed, blocking).

## 6. Edge line rendering — tested concretely against the real library code

**Status: Mixed — depends on whether either endpoint has been manually dragged.**

This is **not** a classic dynamic "floating edge" (an edge type that recomputes its attachment
point based on the live relative angle between two nodes, regardless of which sides face each
other). There are two distinct edge code paths in `TaskDependencyGraph.tsx`'s `layoutWithDagre()`:

- **Pure auto-layout edges** (`type: 'dagre'`, custom `DagreEdge` component, lines 312-320): use
  dagre's own computed route points directly. Ran the real `@dagrejs/dagre` library with the same
  settings this file uses (`rankdir: 'TB', nodesep: 56, ranksep: 90`, `NODE_WIDTH=208,
  NODE_HEIGHT=92`) against a simple 2-node directly-connected pair: **dagre never places two
  directly-connected nodes in the same rank** (source rank 0, target rank 2 — confirmed, never
  equal). So true "side-by-side, same row, connected" cannot occur under pure auto-layout; when
  ranks differ (the normal case), the `isDirectHop` shortcut draws a straight line directly between
  dagre's first/last route points — confirmed clean and diagonal-when-offset, not bent, using the
  real Core Cuttings convergence structure (see Item 7).
- **Any edge touching a manually-dragged node** (`type: 'smoothstep'`, React Flow's built-in edge,
  lines 381-388): uses **fixed** `Position.Bottom`/`Position.Top` handles — not floating. Ran
  `@xyflow/react`'s real `getSmoothStepPath()` directly with two same-Y ("side-by-side") node
  coordinates 400px apart: the result is a multi-segment stepped/staircase path
  (`M204 392L 204,407Q 204,412 209,412L 353,412Q...` — down, across, up, across, down), **not a
  straight line**. The same function with a vertically-stacked pair produces a clean straight
  vertical line. So: if an admin drags a node so it ends up beside (rather than above/below) a
  connected neighbor, the edge **will** render as a bent/zigzag line, not straight.

**What's missing for a true floating-edge implementation**: a custom edge component that computes
its own attachment point on each node's boundary based on the live angle between the two node
centers (common pattern: intersect the line between centers with each node's rectangle), replacing
the fixed-handle `smoothstep` type for manually-positioned nodes.

## 7. Dagre auto-layout quality — tested with the real reference-sequence structure

**Status: Clean — no overlap, correctly spaced, confirmed by running the real layout.**

Reconstructed the actual Tier 3→4→5 structure around "Core Cuttings for HVAC, Electrical &
Plumbing" from `prisma/seed-reference-sequence.ts` (3 tasks feeding in, 3 feeding out) and ran it
through the real `@dagrejs/dagre` library with this app's exact settings:

- All three Tier-3 (fan-in) siblings and all three Tier-5 (fan-out) siblings land in clean rows,
  264px apart center-to-center — with `NODE_WIDTH=208`, that's a **56px gap** between card edges
  (exactly matching the configured `nodesep: 56`, i.e. dagre is applying it correctly with zero
  overlap).
- Every edge into/out of the convergence node is a direct hop (`rankSpan` equals the graph's own
  one-hop unit), so each renders as a single clean straight line (vertical when X-aligned, diagonal
  otherwise) — none of the bent/orthogonal multi-point routing is needed here.

This confirms the convergence point renders cleanly under auto-layout, by simulation of the real
code+library+real edge structure (not a live screenshot, since real data is currently empty — see
Item 1).

## 8. "X of Y prerequisites done" badge

**Status: Implemented, reads real per-node data.**

`TaskNode` (`TaskDependencyGraph.tsx`): `GraphTask.prerequisiteCount` /
`prerequisiteCompletedCount` (lines 79-80) are real fields threaded from the server-loaded task
list, not literals. `hasConvergence = data.prerequisiteCount >= 2` (line 158),
`allPrereqsDone = data.prerequisiteCompletedCount === data.prerequisiteCount` (line 159). Badge JSX
(lines 248-259) renders `{data.prerequisiteCompletedCount} of {data.prerequisiteCount} done`,
colored green/amber by `allPrereqsDone`.

## 9. Planned dates on task cards

**Status: Still working — re-verified, no regression.**

`TaskNode` renders a zoom-gated date-range line directly beneath the task ID
(`TaskDependencyGraph.tsx:239-246`), gated by `DATE_VISIBLE_ZOOM_THRESHOLD = 0.5` (line 104) read
via `useStore((s) => s.transform[2] >= DATE_VISIBLE_ZOOM_THRESHOLD)` (line 163) — confirmed
unchanged from when this was built.

## 10. "Ready to start" / "Waiting on N of M" badges

**Status: Implemented — a separate, real feature, but not on the flowchart canvas itself.**

Grep for "Ready to start"/"Waiting on" inside `TaskDependencyGraph.tsx` returns zero matches — this
isn't on the canvas. The real feature lives on the **per-Work task list page**
(`app/(app)/works/[workId]/page.tsx`), rendered via `components/tasks/TaskFlowMap.tsx`:
- A "⬥ waiting" badge for tasks blocked by their own checklist (`status === 'blocked'`).
- A "⇢ N" badge for tasks waiting on prerequisites in a *different* Work, driven by a real
  `prisma.taskDependency` query joined across Works (`works/[workId]/page.tsx:36-44`).

The one literal "ready to start" string elsewhere in the app
(`components/layout/Header.tsx`, `DUMMY_NOTIFICATIONS`) is hardcoded mock notification content —
not a computed status.

## 11. Delete All Tasks feature — the soft-delete safety net is PARTIALLY implemented, and it did
    not prevent today's 4th data wipe

**Status: Partially implemented.** This is genuinely in-progress, interrupted mid-build by this
audit request. Precise breakdown of what exists vs. what's missing:

**Done:**
- `prisma/schema.prisma`: `HvacTask.deletedAt DateTime?` added, pushed to the live database
  (confirmed via `\d hvac_tasks` — `deleted_at` column and a `deleted_at` index both present).
- `app/actions/bulk-delete.ts`: rewritten —
  - `buildScopeWhere` now includes `deletedAt: null` (can't re-delete an already-deleted batch).
  - `bulkDeleteTasks` now does `hvacTask.updateMany({ data: { deletedAt: now } })` instead of a
    real `deleteMany`, and records the exact `taskIds` array in the `ActivityLog` payload.
  - New `getRecentlyDeletedBatch()`, `restoreBulkDeletion(activityLogId)`, and
    `purgeExpiredSoftDeletes()` functions exist, with a 24-hour recovery window constant.
- `app/(app)/layout.tsx`: now `async`, calls `purgeExpiredSoftDeletes()` on every request (the
  "check on page load" purge mechanism, since this project has no scheduler).
- Query audit, done so far (added `deletedAt: null`, directly or via relation filter): every
  `[taskId]` detail route (`layout.tsx`, `page.tsx`, `activity/page.tsx`, `overview/page.tsx`,
  `dependencies/page.tsx`), `works/[workId]/page.tsx`, `projects/page.tsx` (dashboard),
  `task-dependencies.ts`'s `getTaskDependencyContext` and `getTaskDependencyGraph`,
  `dependency-templates.ts`'s `applyTemplateToProject`, `lib/data/delay-engine.ts`,
  `lib/data/gantt-delay.ts`.

**NOT done — and this is the critical gap:**
- **`lib/data/works.ts`'s `getWorksData()` has zero `deletedAt` filtering.** This is the single
  most-used data loader in the app — it backs `/works`, `/works/flowchart`, and `/gantt` (via
  `getWorksData()` directly). Confirmed by grep: neither `hvacTask.findMany` (line 23) nor
  `taskDependency.findMany` (line 36) in this file has any `deletedAt` condition. Until this is
  fixed, a soft-deleted task would still show up on the three most important pages in the app.
- **No UI reflects any of this.** `components/tasks/BulkDeleteDialog.tsx` still says "This is a
  permanent action — there is no undo" (line 129), "This will permanently delete..." (line 137),
  button label "Permanently Delete" (line 191), and "N tasks permanently deleted" (line 202) — all
  now factually stale copy, since the backend (partially) does a recoverable soft-delete.
- **No "Recently deleted / Restore" banner exists anywhere.** Grep for
  `RecentlyDeleted|getRecentlyDeletedBatch|restoreBulkDeletion` across every `.tsx` file returns
  zero matches — the restore/preview functions are written but never imported or called from any
  component. An admin has no way to actually use the recovery window right now.
- **Never tested end-to-end.** No soft-delete-then-restore test has been run yet, and no
  purge-expiry test has been run yet.
- **Today's newest deletion (12:26:17, `deletedCount: 97`) did not go through this new code at
  all** — see the urgent finding above. Whatever the exact mechanism, the safety net currently does
  not protect this app in practice.

## 12. Toolbar contents

**Status: Implemented, and clean — no leftover sticky-note/comment tool.**

Left floating toolbar (`TaskDependencyGraph.tsx:1062-1110`), in order: **Select** → **Add task** →
**Connect** → **Group by trade** → divider → **Lock/Unlock canvas**. A separate top-right utility
bar (explicitly commented as "not part of the tool set") has **Reset Layout** and a light/dark
board theme toggle.

`grep -rn "sticky" -i components/tasks components/hvac` → zero matches. The only "comment" hit in
`TaskDependencyGraph.tsx` is a dialog string pointing to the task detail page's real comment
feature ("for checklist, status, or comments, open the full task page") — not a canvas tool.
Confirmed: no sticky-note/comment tool was left in.

## 13. New-node placement/overlap

**Status: Implemented for the create-task path; not applied to duplicate.**

`findClearPosition()` (`TaskDependencyGraph.tsx:724-737`) checks the desired position against
every existing task node's bounding box (75% width/height tolerance) and nudges diagonally in 40px
steps, up to 30 attempts, before giving up. Used by both double-click-to-create and the toolbar's
"Add task" button. Node **duplication** (a separate feature, line 574-577) uses a fixed `+40/+40`
offset from the original with no collision check — a new duplicate could still overlap a third,
unrelated node in rare layouts. Minor, not the same gap the earlier "new-node placement" fix
targeted.

## 15. Fullscreen mode, pan/zoom, minimap

**Status: Implemented, no regression.**

`<ReactFlow panOnDrag zoomOnScroll zoomOnPinch fitView>` with `<Background>`, `<Controls
showInteractive={false}>`, and `<MiniMap pannable zoomable ... />` all present
(`TaskDependencyGraph.tsx:1150-1185`). Fullscreen toggle lives in the parent
`components/tasks/TasksExplorer.tsx` (real Fullscreen API with a CSS fallback for browsers that
lack it, e.g. iOS Safari), threaded into the canvas via `isFullscreen`/`fullscreenContainer` props
so dialogs still portal correctly while fullscreen.

---

## Priority order to address gaps

1. **Restore the real dataset, and figure out why the soft-delete safety net didn't catch today's
   4th wipe.** Nothing else matters if the data keeps disappearing. Specifically: confirm whether
   the running `next dev` process needs a restart to pick up the rewritten `bulkDeleteTasks`, and
   only then re-verify a real delete-all attempt actually soft-deletes.
2. **Finish wiring `deletedAt` into `lib/data/works.ts`'s `getWorksData()`.** This single file backs
   `/works`, `/works/flowchart`, and `/gantt` — it's the biggest remaining hole in the soft-delete
   work and the most consequential to fix next.
3. **Build the "Recently deleted / Restore" banner UI** and update `BulkDeleteDialog`'s copy — the
   backend functions already exist and are just unused.
4. **Test the soft-delete → restore round trip and the purge-after-24h path end-to-end** before
   considering Item 11 done.
5. **Edge rendering (Item 6)** — lower urgency than the data-loss issue, but worth fixing before
   anyone relies on manually-dragged layouts looking clean: replace the fixed-handle `smoothstep`
   edge for manually-positioned nodes with a real floating-edge calculation.
6. **`TaskParallelLink` (Item 5)** — not started; sequence this only after the above, since it's
   new scope, not a regression or bug.
