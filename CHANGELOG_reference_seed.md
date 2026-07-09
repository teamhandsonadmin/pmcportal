# Changelog — Reference Sequence Seed + 3-Color Status System

## Part 4 — Screenshot-verified correction pass (90 → 95 tasks, exact match)

You sent 6 screenshots of the actual PDF (full overview + 5 overlapping zoomed
sections). Re-transcribed the whole diagram directly from these images instead
of the earlier flattened-text extraction, and diffed it against the 90 tasks
already seeded. Found real gaps — not just the count mismatch, but genuinely
wrong structure:

**5 entirely missing tasks** — a continuation of the MS-staircase/external-
works column that the text extraction had dropped completely: `MS Staircase
Works and Terrace Flooring Works` (FLOOR), `External Paint Works` (PAINT),
`External Flooring` (FLOOR), `Main Gate & Wicket Gate Fabrication Work`
(FABRI), `Main Gate & Wicket Gate Painting Work` (PAINT) — sequential, ending
the chain with no further downstream connection.

**8 wrong prerequisite edges**, all verified directly against the screenshots
and corrected (old → new):
- `Aluminium Windows & Sliding Doors Measurements`: was anchored to Wall
  Punning Works → now Window Stone Jambing Works (it's the same continuous
  dashed column as the door/window CIVIL chain, not the POP chain).
- `Main Door & Internal Doors Measurements`: paperSandGypsum → Aluminium
  Windows & Sliding Doors Measurements (same column, one step later).
- `Internal Marble Flooring`: was 2 prerequisites (Base Primer Paintings,
  Mirror & Shower Partitions Measurements) → now 4. The finishing-section
  box's bottom border is a genuine 4-way merge; Wall Punning Works and
  Non-Electrical Floor Conduiting & Wiring Works also feed it.
- `Main Door & Internal Doors Erection` and `Aluminium Windows & Sliding
  Doors Erection`: both were anchored to Base Primer for All Walls → now
  Marble Floor Protection Sheets Laying (one step earlier — verified via the
  visible horizontal connector in the screenshot).
- `Wooden Wall Panelling`: was Main Door & Internal Doors Erection → now
  Base Primer for All Walls (it's part of the same 3-way split as Texture
  Paints / 1st Coat Paint, not downstream of the door erection).
- `Mirror & Shower Partitions Measurements (Pre-Erection)`: was Main Door
  Erection → now Aluminium Windows Erection (it sits in that column, mirroring
  how Modular Erection sits under Main Door Erection).
- `2nd Coat Paint for Walls & Gypsum Ceilings`: was 1st Coat Paint → now
  Electrical Switch Boards Fixing (positioned specifically below that box in
  the diagram, not spanning the whole row like its siblings).

Ran via the same idempotent script, now with an explicit `STALE_EDGES` removal
step added (the script previously could only add — it had no way to retract
a wrong edge from a prior run): **7 stale edges removed, 14 new/corrected
edges inserted, 5 new tasks created**.

**Final state: 95 tasks, 108 `TaskDependency` edges, 16 Works** — 95 exactly
matches the other Claude session's count from direct pixel-level PDF
rendering, which is a strong signal this is now complete and structurally
correct, not just numerically coincidental.

Also, per your request: the reference-sequence flowchart (`TaskDependencyGraph.tsx`)
now renders every node in the neutral gray palette regardless of its actual
stored status — a cosmetic override for this view only; the status label
text and the underlying data are untouched, only the color is suppressed.
And the "Unassigned" placeholder text on nodes with no assignee is now
omitted entirely rather than shown as a literal word.

## Part 3 — Correction pass (88 → 90 tasks)

A different Claude session, working from the same PDF, counted **95 distinct task boxes**
against my original **88**. I re-scanned the PDF content myself (not just re-checking the trade
list) rather than guessing at the gap, and confirmed two specific boxes I'd originally collapsed
as duplicates are actually two separate steps each:

- **"Wall Bull Marks (POP)"** is drawn twice — once in the electrical chain (`wallElecChip` →
  `wallBullMarksElec` → `wallElecConduit`), and again lower down in the ceiling-finishing column,
  between Wall Hacking and Wall Punning. Added as a second task, **`POP-004` "Wall Bull Marks
  (Ceiling Finishing)"** (suffixed for DB uniqueness only — the PDF's label text is identical both
  times), rewired: `Wall Hacking → POP-004 → Wall Punning` (previously Wall Hacking fed Wall
  Punning directly).
- **"Mirror & Shower Partitions Measurements (GLASS)"** is likewise drawn twice — once feeding
  into Internal Marble Flooring (kept as-is), and again right before Wooden Wall Panelling in the
  final erection fan-out tier. Added as a second task, **`GLASS-003` "Mirror & Shower Partitions
  Measurements (Pre-Erection)"**, rewired: `Main Door Erection → GLASS-003 → Mirrors & Shower
  Partitions Fixing` (previously Mirror Fixing depended on Wooden Wall Panelling directly — this
  new anchor is more specific and same-trade).

Ran via the same idempotent script (additive-only — every prior task/edge untouched): **90 tasks
total (+2), 101 `TaskDependency` edges total (+4), 16 Works (unchanged)**, 0 skipped as cycles.
Verified directly against the DB after running: both new tasks exist with the expected IDs
(`POP-004`, `GLASS-003`) and exactly the 4 new edges attached, no others.

**This does not close the full 88-vs-95 gap.** 90 vs. 95 still leaves 5 boxes unaccounted for. I
don't have the other session's exact box-by-box list (only its trade-count summary), and I re-read
the PDF content already in this conversation end-to-end looking for anything else I'd missed —
found nothing beyond these two. The remaining 5 are most likely either: boxes the flattened text
extraction merged/dropped that a pixel-level render would catch, or a genuine second look at
small/overlapping boxes near the diagram's edges. Next step to close it precisely: get that
session's itemized list (name + trade per box) and diff it directly against these 90, rather than
guessing at unnamed boxes a third time.

## Part 1 seed — RUN, with your explicit go-ahead on the flagged edges

`prisma/seed-reference-sequence.ts` executed successfully:

- **88 tasks total** (15 reused from the original demo data, 73 newly created)
- **97 `TaskDependency` edges** created, 0 skipped as duplicates, **0 skipped as cycles**
- **16 Works total** (5 original + 11 from this reference sequence)

Verified after running (not just trusting the script's own log):
- Zero duplicate task names, zero edges pointing at a non-existent task.
- Ran the actual dagre layout the app uses against the real seeded data: **29 distinct
  vertical tiers** (proof this is a real branching tree now, not a single row).
- Exactly **one root task** (no prerequisites at all): `FLOOR-013`, Tile Bull Marking — this is
  the true top of the spine in the PDF, which is a strong sign the edge structure is
  topologically correct, not just populated with plausible-looking rows. 18 leaf tasks
  (end-of-chain), consistent with the several parallel chains that terminate independently.

The 8 items flagged in the review page were included as-is, per your explicit confirmation to
run rather than wait for corrections — they're not wrong by construction, just less certain than
everything else. If any of them turn out to be wrong once you look at the rendered graph, they're
easy to fix individually: remove the specific `TaskDependency` row (via the app's own "Prerequisite
Tasks" card, or I can do it directly) and add the corrected one — no need to re-run the whole seed.

## Part 2 (3-color status system) — done

New shared utility in `lib/utils/status-rules.ts`: `STATUS_COLOR_GROUP` (maps all 6 `TaskStatus`
values to `'gray' | 'amber' | 'red' | 'green'`), `STATUS_COLOR_PALETTE` (the actual hex values per
group), and `getStatusColor(status)` — implemented exactly as your table specified (draft=gray,
ready/in_progress/on_hold=amber, blocked=red, completed=green). `TaskStatus` itself and all the
real status-machine logic (`VALID_TRANSITIONS`, the Postgres trigger, etc.) are completely
untouched — this is purely a color-lookup change.

Applied to `components/tasks/TaskDependencyGraph.tsx`: the node's border/background and the
status badge pill both now come from `getStatusColor()` instead of the old 6-distinct-color map;
the badge text still shows the specific label (`STATUS_LABELS[status]` — "In Progress", "On
Hold", etc. stay distinct as text, only the *color* consolidates), and the MiniMap's per-node dot
color uses the same function.

**Scope, deliberately narrow**: I did not touch `TaskFlowMap.tsx` (the per-Work simple view),
`TaskStatusBadge.tsx`, or `TrelloTaskDetail.tsx`'s own status pill — those still render the full
6-color scheme. Your prompt only named "the flowchart node status badges" and its
"border/left-accent" as in-scope, and explicitly said to leave the stat cards alone; I read that
as scoping to the new `TaskDependencyGraph` component specifically, not a blanket app-wide
change. If you want the other 3 status-color maps consolidated too, say so and I'll extend them
to use the same `getStatusColor()` helper (it's already written to be reused anywhere).

**On the `on_hold` grouping**: implemented exactly as your default table (amber), no
change proposed. I haven't seen this rendered against a real branching graph with many nodes yet
(still blocked on the PDF — see below), so I can't yet give you an informed opinion on whether
`on_hold` reads better as its own 4th color once the board is dense. Worth revisiting once real
data is in.

Typecheck and lint both clean on the changed files.

## Part 1 (reference sequence seed) — blocked, and here's exactly where it stands

**Step 0 sanity check — already done, before you sent this second prompt**: confirmed with a real
throwaway `TaskDependency` edge between two actual demo tasks that the dagre/React Flow layout
branches correctly the moment an edge exists (two different tiers, not a straight line), then
removed that test edge. **Your screenshot showing "15 tasks" still in a single row is not a new
bug — it's the same zero-edges state, now visible in your own browser.** This matches the sanity
check's prediction exactly. The layout code is confirmed correct; there is nothing to fix there.

**Step 2 (create missing Works) — done, right now, since it didn't need the PDF.** The trade
names were already spelled out in your prompt text itself, so I didn't need to wait. Created 6
new `Work` records under the existing "ABC Villa Construction" project via a new idempotent
script, `prisma/seed-reference-sequence.ts` (ran it twice to confirm no duplicates get created on
a second run):

| Code | Name | Color |
|---|---|---|
| FCEIL | False Ceiling | `#EC4899` |
| CARP | Carpentry | `#7C3AED` |
| POP | POP | `#0EA5E9` |
| WPROOF | Waterproofing | `#14B8A6` |
| FABRI | Fabrication | `#78716C` |
| LSCAPE | Landscaping | `#65A30D` |

Total Works now: **11** (the original HVAC/ELEC/PLUM/CIVIL/FLOOR + these 6). Colors were chosen
to deliberately avoid the new 3-color status palette's hues (no pure red/amber/green) so a
task's trade-color dot never gets visually confused with its status pill on the same card.

One naming note: the PDF's own trade labels use punctuation your `Work.code` column's validation
doesn't allow (`F.CEILING`, `W.PROOF`, `L.SCAPE` — periods aren't permitted, and the existing
`createWork` action's schema requires `/^[A-Za-z0-9]+$/`). The codes above are short derived
codes, not verbatim copies — flagging this now so it's not a surprise later.

**Steps 1, 3, and 4 (read the PDF, create/match tasks, create `TaskDependency` edges) — still
completely blocked.** `docs/reference/20260524_Seq_of_Work.pdf` does not exist anywhere in this
repo — I checked again after this second prompt, since you said you'd attached it again.
**Important: "attaching" a file to a chat message on your end does not put it on disk in this
repo, and I have no way to retrieve it from wherever it's attached.** I can only read files that
actually exist in this project's filesystem, or images/screenshots pasted directly into our
conversation (like the flowchart screenshot you just shared — I can see and read those directly).

To unblock this, please do one of:
1. **Copy the actual PDF file** to `docs/reference/20260524_Seq_of_Work.pdf` in this repo (drag
   it into your file explorer / VS Code, or `cp` it via terminal) and tell me once it's there.
2. **Screenshot or export each page as an image** and paste them directly into our chat, the same
   way you've been sharing screenshots — I can read those the moment they're in the conversation.

Either works. Once I can actually see the document, I'll finish Steps 1/3/4: extract every step,
name, trade code, and connection; match against the 15 existing demo tasks where they represent
the same step (reusing rather than duplicating); create new tasks for everything else under the
now-existing 11 Works; and create a `TaskDependency` row for every arrow in the diagram, using the
same cycle-detection logic (`wouldCreateCycle`) the interactive "Add Dependency" UI already uses
— not skipping that safety check just because it's a seed script.

## Verification

- `npx tsc --noEmit` / `npx eslint` clean on all changed files.
- `prisma/seed-reference-sequence.ts` run twice; second run produced identical output (idempotent
  upsert-by-`code`, no duplicate Works created). Verified via a direct query: 11 total Works, no
  duplicates.
- Did not attempt any browser verification of the color change this pass — same access
  limitation as the previous changelog. The color change is low-risk/easy to eyeball once you're
  in the app; let me know if it looks off once you see it rendered.
