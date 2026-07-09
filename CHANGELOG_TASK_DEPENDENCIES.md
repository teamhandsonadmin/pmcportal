# Changelog — Cross-Trade Task Dependencies + Flowchart Redesign

Implements the plan approved this session. Schema is live (`db push` applied), all new/changed
code is typechecked and linted clean, and the core logic (cycle detection + status gating) was
verified directly against the real dev database with test rows created and cleaned up
afterward. See **Verification** for exactly what that covered, and the usual browser-access
caveat at the end.

## What's real

### Schema
- New `task_dependencies` table (`TaskDependency` model): `taskId` (waiting task) →
  `dependsOnTaskId` (prerequisite), unique pair, indexed both directions, cascades on delete from
  either side. Fully independent of the checklist system — no changes to `DependencyItem`,
  `DependencyCompletion`, or the Postgres trigger in `supabase/schema.sql`.

### Cycle prevention — `lib/utils/dependency-graph.ts`
`wouldCreateCycle(existingEdges, proposedTaskId, proposedDependsOnTaskId)` — a DFS forward from
the proposed prerequisite through existing edges; if it reaches the proposed dependent, the new
edge would close a loop. **Verified against 5 cases** (self-loop, direct 2-cycle, a 4-hop cycle
through a diamond-shaped graph, a genuine non-cyclic diamond, and a fully unrelated edge) — all
five resolved correctly. Re-verified a second time against the real database via
`addTaskDependency`'s actual code path: created two real tasks, added A→B, confirmed proposing
B→A is rejected and no row is ever created for it.

### Status gating — `updateTaskStatus` (`app/actions/hvac-tasks.ts`)
Extended, not replaced. The existing `ready`-required check for `→ in_progress` is unchanged;
added a second check right after it: fetch this task's `TaskDependency` rows, run them through
the new pure `getBlockingPrerequisites` filter (`lib/utils/status-rules.ts`), and reject with
`"Blocked by: TASKID (Task Name) — not yet completed"` (comma-joined for multiple) if any
prerequisite isn't `completed`. **No UI changes were needed for this to display** —
`TaskStatusControl.tsx` already renders any `ActionResult.error` string returned from this
action.

**Confirmed, not guessed**: the "what if a prerequisite un-completes after a dependent already
started" edge case from the spec is impossible today. `completed` has zero outgoing transitions
in `VALID_TRANSITIONS`, and the Postgres trigger explicitly no-ops for
`in_progress`/`on_hold`/`completed`. There is no code path anywhere that moves a task out of
`completed`, so this case needs no handling — documenting the invariant rather than leaving it
as an assumption.

### Server actions — `app/actions/task-dependencies.ts`
- `addTaskDependency` / `removeTaskDependency` — cycle-checked create, plain delete, both log to
  `ActivityLog` (`task_dependency_added` / `task_dependency_removed`).
- `getTaskDependencyContext(taskId)` — not in the original spec, added to avoid duplicating the
  same two queries across both task-detail pages that needed this data (see below).
- `getTaskDependencyGraph(projectId?)` — matches the spec's shape; `projectId` is optional and
  unused by the current caller (see "All Projects" decision below).

### UI — `TaskDependencyCard` (one component, two call sites)
Rendered on `/hvac/[taskId]/overview` (new full-width row, same treatment as the existing SFT
card) and inside `TrelloTaskDetail`'s sidebar (right after the "Update Status" card) — both via
the shared `getTaskDependencyContext` helper. Shows current prerequisites with status badges and
a remove button, an amber warning banner when any aren't `completed`, and an add-dependency
control (search filter + native select, submitted via the actual `addTaskDependency` action).

**Scope trim, as planned**: the add-dependency select does not pre-filter cycle candidates
client-side — it excludes the current task and already-added prerequisites (cheap, no full graph
needed) but relies on the server's `wouldCreateCycle` check for the actual cycle rejection,
exactly as the original spec anticipated ("the server action must still re-validate").

### Flowchart redesign
- **`components/tasks/TaskDependencyGraph.tsx`** (new) — `@xyflow/react` + `@dagrejs/dagre`
  (newly installed; the maintained successor to the abandoned `dagre` package, same API, ships
  its own types). Dagre computes a top-to-bottom layout; custom node type renders a task card
  (work-color dot, status color/label, assignee); edges are solid+muted when the prerequisite is
  `completed`, dashed+amber otherwise. Clicking a node navigates to `/hvac/[id]`.
- **`TasksExplorer.tsx`**'s Flowchart tab now renders one unified `TaskDependencyGraph` over the
  already-filtered task list, instead of the old per-Work grouped loop of hand-drawn
  `TaskFlowMap` cards. `TaskRow` gained a `workColor` field.
- **`/works/[workId]`** (per-Work page) was deliberately **not** rewritten — `TaskFlowMap.tsx`
  stays the simple linear/sequential view for a single trade, per the spec's own suggested
  default. It gained one thing: a small badge on any task with a prerequisite outside this Work,
  with a tooltip listing what it's waiting on, linking to `/works` (where the full graph lives)
  rather than building deep-link/highlight plumbing into the main graph.

## Judgment calls, stated plainly

1. **"All Projects" graph scope (spec's Part 6.4)**: investigating this surfaced that
   `app/(app)/works/page.tsx` has **no server-side project scoping at all** today — it fetches
   every `HvacTask` globally, and "All Projects" is a pure client-side dropdown filter in
   `TasksExplorer` matching the denormalized `projectName` string (there's no `projectId` FK on
   `HvacTask`, only `Work.projectId`). Rather than inventing a new project-scoped fetch just for
   the graph, it reuses the exact same global fetch and the exact same existing client-side
   filters — picking a project in the dropdown narrows the graph exactly like it already narrows
   the List View, no new prompt or seam needed. `getTaskDependencyGraph(projectId?)` still
   accepts an optional project filter for a possible future project-scoped page, but nothing
   calls it with one today.
2. **Sidebar card placement**: `TaskStatusControl` renders in two places
   (`TrelloTaskDetail` and `/overview`), so `TaskDependencyCard` does too — a rejected "Start
   Task" click should be explainable wherever that click happens, not just one of the two pages.
3. **Deleting a task that's a prerequisite for others** silently cascade-deletes the dependency
   row with no warning — flagging this as worth knowing (per the plan), not building a
   confirmation dialog for it (`deleteHvacTask` itself wasn't touched, out of scope).
4. **Minor, low-impact gap**: `addTaskDependency`'s Zod validation errors (bad UUID, self-
   dependency) come back as an object (`fieldErrors`), which `TaskDependencyCard` doesn't render
   per-field — only the cycle-rejection string path (the actual expected failure mode) is
   surfaced in the UI today. In practice this is close to unreachable: the candidate list
   already excludes the current task, so a self-dependency attempt can't originate from a normal
   click. Noting it rather than silently leaving it undocumented.

## Verification

- **Cycle detection**: 5 hand-traced cases (self-loop, direct cycle, multi-hop cycle through a
  diamond, genuine diamond, unrelated edge) — all correct. Re-run against the real DB through the
  actual create/reject path.
- **Status gating**: created two real tasks (A, B) in the dev DB, A depends on B; confirmed A
  (in `ready`) is blocked while B isn't `completed`, and unblocked immediately after marking B
  `completed` — using the exact same `getBlockingPrerequisites` call `updateTaskStatus` makes.
  All test rows deleted afterward.
- **Typecheck/lint**: `npx tsc --noEmit` clean; `npx eslint` clean on every new/changed file (one
  pre-existing, unrelated lint error on an unescaped quote in `TrelloTaskDetail.tsx` was found
  and confirmed via `git diff`/`git log` to predate this session — not fixed, not caused by this
  work).
- **Not verified**: actual browser rendering of the new graph, the sidebar card, or the
  add/remove flow — still blocked on the same missing login credentials from earlier in this
  session. Happy to do a full pass once that's resolved; in the meantime everything scriptable
  against the real database was exercised and passed.

### New dependency
`@dagrejs/dagre` (layout only; `@xyflow/react` was already installed, this is its first use).
