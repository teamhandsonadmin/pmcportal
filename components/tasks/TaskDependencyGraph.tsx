'use client';

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  NodeToolbar,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useStore,
  useInternalNode,
  getStraightPath,
  getSmoothStepPath,
  reconnectEdge,
  type Node,
  type Edge,
  type Connection,
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { TaskStatus, DependencyType } from '@/lib/types/hvac';
import type { ActionResult } from '@/lib/types/hvac';
import { STATUS_COLOR_PALETTE, STATUS_COLOR_GROUP, allowedTransitions, TRANSITION_LABELS, DEPENDENCY_TYPE_LABELS, isDependencySatisfied } from '@/lib/utils/status-rules';
import type { WorkOption } from '@/components/tasks/TasksExplorer';
import type { TaskTypeOption } from '@/components/hvac/TaskTypeManager';
import {
  createTaskFromCanvas,
  updateTaskManualPosition,
  updateTaskName,
  updateTaskDescription,
  updateTaskType,
  updateTaskPlannedDates,
  updateTaskStatus,
  deleteHvacTask,
  getTaskDeleteImpact,
  resetManualPositions,
  type TaskDeleteImpact,
} from '@/app/actions/hvac-tasks';
import { computeDueDate } from '@/app/actions/working-days';
import { addTaskDependency, removeTaskDependency, reconnectTaskDependency, updateDependencyType } from '@/app/actions/task-dependencies';
import { createParallelLink, removeParallelLink, reconnectParallelLink } from '@/app/actions/task-parallel-links';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WorkingDayPicker } from '@/components/ui/working-day-picker';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { formatDateKey } from '@/lib/utils/format';

// This reference-sequence graph deliberately renders every node in the
// neutral gray palette regardless of its real stored status — the status
// label text still shows the real value, this only suppresses the color.
// A cosmetic override for this view specifically, not a data change.
const FORCED_GRAY = STATUS_COLOR_PALETTE.gray;
const EDGE_COLOR = '#F0A227';
const MANUAL_EDGE_COLOR = '#6366F1';
const CONNECT_SOURCE_COLOR = '#2563EB';
// Series (FS/SS/FF/SF) edges render solid — they're a real, enforced
// blocking relationship. Parallel is the opposite (symmetric, non-blocking,
// visual-only), so it stays dashed and arrowless (an arrow would wrongly
// imply an order). Blue is the default for a same-track pairing (the
// common case — two matched chains running side by side); a link that
// bridges to a spatially unrelated part of the canvas (see
// PARALLEL_BRIDGE_EDGE_COLOR / bigVerticalJump below) renders red instead,
// so a rare cross-section note stands out from the routine same-track
// pairing lines around it.
const PARALLEL_EDGE_COLOR = '#2563EB';
const PARALLEL_SOURCE_COLOR = '#1D4ED8';
const PARALLEL_BRIDGE_EDGE_COLOR = '#DC2626';

// grid = minor (20px) square lines, gridMajor = major (100px, every 5th
// minor line) — the same faint two-tier square grid Miro's canvas uses,
// replacing the old single dot pattern.
const CANVAS_THEMES = {
  light: { bg: '#ffffff', grid: '#f5f5f6', gridMajor: '#ececee' },
  dark: { bg: '#0a0a0a', grid: '#141416', gridMajor: '#222225' },
} as const;

export interface GraphTask {
  id: string;
  taskId: string;
  taskName: string;
  description: string | null;
  taskTypeId: string | null;
  status: TaskStatus;
  workId: string | null;
  workCode: string;
  workColor: string;
  assigneeName: string | null;
  plannedStartDate: Date | null;
  dueDate: Date | null;
  actualStartDate: Date | null;
  manualPositionX: number | null;
  manualPositionY: number | null;
  prerequisiteCount: number;
  prerequisiteCompletedCount: number;
}

export interface GraphEdgeInput {
  id: string;
  source: string;
  target: string;
  // Series-edge-only (TaskDependency.type) — absent/ignored for parallel
  // edges, which have no FS/SS/FF/SF concept. Defaults to 'FS' wherever
  // missing so pre-existing callers that don't pass it keep working.
  type?: DependencyType;
}

const DEPENDENCY_TYPES: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];

// The five real relationship types, unified into one list — Parallel (no
// enforcement, TaskParallelLink) plus the four TaskDependency types (real
// status-gating). Used both by the create/edit panel and the legend, so
// the two always describe exactly the same five things the same way.
type RelationshipType = 'PARALLEL' | DependencyType;
const RELATIONSHIP_TYPES: RelationshipType[] = ['PARALLEL', ...DEPENDENCY_TYPES];
const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  PARALLEL: 'Parallel',
  ...DEPENDENCY_TYPE_LABELS,
};
const RELATIONSHIP_DESCRIPTIONS: Record<RelationshipType, string> = {
  PARALLEL: 'Visual only — no enforcement',
  FS: "Blocks start until the other finishes",
  SS: "Blocks start until the other starts",
  FF: "Blocks finish until the other finishes",
  SF: "Blocks finish until the other starts",
};

type ActiveTool = 'select' | 'add' | 'link';

interface NodeCallbacks {
  onDeleteRequest: (nodeId: string) => void;
  onConnectFromNode: (nodeId: string) => void;
}

type NodeData = GraphTask & NodeCallbacks & Record<string, unknown>;

const NODE_WIDTH = 260;
const NODE_HEIGHT = 130;

// Each phase divider anchors to the true bottom edge of every task whose
// column number is <= afterColumnNumber — NOT one specific task's Y. A
// single hardcoded task broke as soon as a phase had uneven column depths
// (e.g. the Sep 9 set: Mezzanine Floor and Toilets Works both run 2 rows
// deeper than Kitchen Works, so anchoring to Kitchen's last task, 24p, put
// the banner two rows above where 22r/23r actually render, overlapping
// them). Column number, not row depth, is what "the last column belonging
// to this phase" means, so that's what selects which tasks count toward the
// bottom-edge computation. When starting a new phase, add a new entry here
// with afterColumnNumber set to the highest column number in whatever phase
// is currently at the bottom of the board. Module-level (not component
// state) since it's a static, hardcoded list — a fresh array literal inside
// the component would defeat sectionHeadingNodes' own memoization.
const SECTION_HEADINGS: { label: string; afterColumnNumber: number }[] = [
  { label: 'STRUCTURE INTERNAL WORKS', afterColumnNumber: 20 },
  { label: 'EXTERNAL WORKS', afterColumnNumber: 24 },
];

// Shared string-based helper (vs. layoutWithDagre's own nodeId-keyed version)
// for reading a task's column number directly off its taskId — used by
// sectionHeadingNodes, which only has node.data to work with.
function taskIdColumnNumber(taskId: string | null | undefined): number {
  const match = taskId?.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : Infinity;
}

// Shared by layoutWithDagre (to reserve enough row-gap at a heading boundary
// so the banner doesn't overlap either phase) and sectionHeadingNodes (to
// actually position it) — must stay in sync between the two.
const SECTION_HEADING_GAP_ABOVE = 150;
const SECTION_HEADING_HEIGHT = 90;
const SECTION_HEADING_GAP_BELOW = 150;

// Below this zoom, the existing 10-12px card text is already close to
// illegible — adding a date line at that size would just be noise, so it's
// hidden rather than shrunk further.
const DATE_VISIBLE_ZOOM_THRESHOLD = 0.5;

function formatCardDate(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCardDateRange(start: Date | null, due: Date | null): string {
  const startLabel = formatCardDate(start);
  const dueLabel = formatCardDate(due);
  if (startLabel && dueLabel) return `${startLabel} – ${dueLabel}`;
  if (startLabel) return startLabel;
  if (dueLabel) return dueLabel;
  return 'No planned dates';
}

// Several actions (createTaskFromCanvas, updateTaskPlannedDates, ...) can
// fail with EITHER a plain string OR a Zod-style field-errors object (e.g.
// { due_date: ['Due date must be on or after the planned start date'] }) —
// every call site used to only handle the string case and silently fell
// back to a generic "Failed to ..." message otherwise, hiding the actual,
// actionable reason from the admin.
function formatActionError(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const messages = Object.values(error as Record<string, unknown>)
      .flat()
      .filter((m): m is string => typeof m === 'string');
    if (messages.length > 0) return messages.join(' ');
  }
  return fallback;
}

// Per-node actions/flags that would otherwise need to live on each node's
// `data` — but `data` is only recreated when a node's own task fields
// change, whereas these (duplicate/status/rename, lock state, which node is
// the pending connect-source) can change independently of any node's data
// and used to force a full remap of every node's `data` object on every
// drag frame just to keep them current. Reading them from context instead
// means a position-only update to node A never touches node B's props, so
// React.memo below actually gets to skip re-rendering the other 94 nodes.
interface GraphActions {
  onDuplicate: (nodeId: string) => void;
  onQuickStatusChange: (nodeId: string, status: TaskStatus) => void;
  onRenameRequest: (nodeId: string) => void;
  onOpenTask: (nodeId: string) => void;
  onEdgeDeleteRequest: (edgeId: string) => void;
  locked: boolean;
  pendingLinkSource: string | null;
  // Which of the five relationship types is active in the create panel —
  // only meaningful together with pendingLinkSource, but kept separate so
  // TaskNode can color the pending-source node's border by type (green for
  // Parallel, blue for FS/SS/FF/SF) without needing to know activeTool.
  linkType: RelationshipType | null;
  hoveredNodeId: string | null;
}
const GraphActionsContext = createContext<GraphActions>({
  onDuplicate: () => {},
  onQuickStatusChange: () => {},
  onRenameRequest: () => {},
  onOpenTask: () => {},
  onEdgeDeleteRequest: () => {},
  locked: false,
  pendingLinkSource: null,
  linkType: null,
  hoveredNodeId: null,
});

// Bulk-imported task names (Seq civil_2, Interiors) are built as
// "{section header} — {specific action}" so the section grouping stays
// visible — but a long header eats the fixed-size card's entire 2-line
// clamp, truncating right before the part that actually varies row to row
// (every card in a column reading e.g. "Columns 7,8,9,10 & 9 columns 1st
// lift conrete casting — For…", indistinguishable from its neighbors). If
// the separator is present, render the header as its own small muted line
// and give the action text its own clamped lines; otherwise render the
// plain name exactly as before (a manually-named task with no such prefix
// isn't affected).
function splitTaskName(name: string): { category: string | null; action: string } {
  const sepIdx = name.indexOf(' — ');
  if (sepIdx === -1) return { category: null, action: name };
  return { category: name.slice(0, sepIdx), action: name.slice(sepIdx + 3) };
}

// Field order per Part 4: name, category (Work), task ID — reordered from
// the previous taskId-first layout. The hover delete button, convergence
// badge, and floating NodeToolbar are new; everything else about the node's
// look (size, gray palette, border) is unchanged.
// Wrapped in React.memo — with stable node.data (see computedNodes) and
// GraphActions read from context rather than props, a position-only update
// to one node no longer forces the other 94 to re-render.
const TaskNode = memo(function TaskNode({ id, data, selected }: NodeProps<Node<NodeData>>) {
  const actions = useContext(GraphActionsContext);
  const isPendingLinkSource = actions.pendingLinkSource === id;
  const cfg = FORCED_GRAY;
  const hasConvergence = data.prerequisiteCount >= 2;
  const allPrereqsDone = data.prerequisiteCompletedCount === data.prerequisiteCount;
  const transitions = allowedTransitions(data.status);
  // Selector resolves to a boolean, not the raw zoom level, so this only
  // re-renders nodes when crossing the threshold — not on every zoom tick.
  const showDates = useStore((s) => s.transform[2] >= DATE_VISIBLE_ZOOM_THRESHOLD);

  return (
    <div
      className="group relative rounded-lg border p-3 flex flex-col gap-1 transition-shadow hover:shadow-md"
      style={{
        width: NODE_WIDTH,
        backgroundColor: cfg.bg,
        borderColor: isPendingLinkSource
          ? (actions.linkType === 'PARALLEL' ? PARALLEL_SOURCE_COLOR : CONNECT_SOURCE_COLOR)
          : selected
          ? MANUAL_EDGE_COLOR
          : cfg.border,
        borderWidth: isPendingLinkSource || selected ? 2 : 1,
      }}
    >
      {/* Connecting is click-tool-driven (Part 2), not drag-from-handle —
          nodesConnectable={false} on <ReactFlow> keeps these non-interactive.
          They still have to exist for React Flow to have an anchor point to
          attach any edge to; without them every edge throws React Flow error
          #008 ("Couldn't create edge for source handle id: null") since
          there's no handle at all — named or default — to attach to. */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
      <NodeToolbar
        isVisible={(selected || actions.hoveredNodeId === id) && !actions.locked}
        position={Position.Top}
        offset={10}
      >
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-md p-1">
          {transitions.length > 0 ? (
            transitions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => actions.onQuickStatusChange(id, status)}
                className="text-[10.5px] font-medium px-2 py-1 rounded-md whitespace-nowrap"
                style={{ background: STATUS_COLOR_PALETTE[STATUS_COLOR_GROUP[status]].bg, color: STATUS_COLOR_PALETTE[STATUS_COLOR_GROUP[status]].text }}
              >
                {TRANSITION_LABELS[status] ?? status}
              </button>
            ))
          ) : (
            <span
              className="text-[10.5px] font-medium px-2 py-1 rounded-md whitespace-nowrap"
              style={{ background: STATUS_COLOR_PALETTE[STATUS_COLOR_GROUP[data.status]].bg, color: STATUS_COLOR_PALETTE[STATUS_COLOR_GROUP[data.status]].text }}
            >
              {data.status}
            </span>
          )}
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <button type="button" onClick={() => actions.onOpenTask(id)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="Open task">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
          <button type="button" onClick={() => data.onConnectFromNode(id)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="Link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="19 11 19 5 13 5"/></svg>
          </button>
          <button type="button" onClick={() => actions.onDuplicate(id)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="Duplicate">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button type="button" onClick={() => actions.onRenameRequest(id)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="Rename">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
          </button>
          <button type="button" onClick={() => data.onDeleteRequest(id)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600" title="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"/></svg>
          </button>
        </div>
      </NodeToolbar>

      {!actions.locked && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); data.onDeleteRequest(id); }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-400 hover:text-red-600 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs shadow-sm z-10"
          title="Delete task"
        >
          ×
        </button>
      )}

      {showDates && (
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full text-[9.5px] font-semibold shadow-sm"
          style={{ background: '#FEF08A', color: '#854D0E' }}
        >
          {formatCardDateRange(data.plannedStartDate, data.dueDate)}
        </div>
      )}

      <p className="text-[9.5px] font-mono font-semibold text-muted-foreground/70 leading-tight">{data.taskId}</p>

      {(() => {
        const { category, action } = splitTaskName(data.taskName);
        // "STRUCTURE INTERNAL WORKS" doubles as this task's own category AND
        // the big phase-divider banner's label elsewhere on the canvas — a
        // short blue badge here (instead of the routine plain-text category
        // every other card uses) calls it out as that same phase, not just
        // another category string.
        const isStructureInternalWorks = category === 'STRUCTURE INTERNAL WORKS';
        return (
          <>
            {category && (
              isStructureInternalWorks ? (
                <span
                  className="inline-block self-start px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide mb-0.5"
                  style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                >
                  {category}
                </span>
              ) : (
                <p className="text-[9.5px] text-muted-foreground leading-tight line-clamp-1">{category}</p>
              )
            )}
            <p className="text-[12px] font-semibold text-foreground leading-tight line-clamp-2">{action}</p>
          </>
        );
      })()}

      {hasConvergence && (
        <span
          className="inline-flex self-start items-center text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
          style={{
            background: allPrereqsDone ? STATUS_COLOR_PALETTE.green.bg : STATUS_COLOR_PALETTE.amber.bg,
            color: allPrereqsDone ? STATUS_COLOR_PALETTE.green.text : STATUS_COLOR_PALETTE.amber.text,
          }}
          title={`${data.prerequisiteCompletedCount} of ${data.prerequisiteCount} prerequisites completed`}
        >
          {data.prerequisiteCompletedCount} of {data.prerequisiteCount} done
        </span>
      )}
    </div>
  );
});

interface GroupFrameData extends Record<string, unknown> {
  color: string;
  label: string;
}

// Purely visual — a low-opacity colored frame behind a cluster of nodes
// sharing the same Work, toggled by the "Group by trade" tool. Rendered as a
// real (non-interactive) React Flow node so it pans/zooms in sync with the
// task nodes automatically, rather than a manually-positioned screen-space
// overlay that would need its own transform math.
function GroupFrameNode({ data }: NodeProps<Node<GroupFrameData>>) {
  return (
    <div
      className="w-full h-full rounded-2xl flex items-start p-2"
      style={{ backgroundColor: data.color, opacity: 0.08, border: `1.5px dashed ${data.color}` }}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: data.color, opacity: 4 }}>{data.label}</span>
    </div>
  );
}

interface SectionHeadingData extends Record<string, unknown> {
  label: string;
}

// A big, non-interactive divider marking the start of a whole new phase of
// work below everything already on the board (e.g. civil work vs. interior
// work) — not tied to any real task, purely a visual section break. Real
// React Flow node (not a screen-space overlay) so it pans/zooms in sync.
function SectionHeadingNode({ data }: NodeProps<Node<SectionHeadingData>>) {
  return (
    <div
      className="w-full h-full rounded-2xl flex items-center justify-center shadow-md"
      style={{ backgroundColor: '#0F1F33' }}
    >
      <span className="text-2xl font-bold uppercase tracking-wide text-white">{data.label}</span>
    </div>
  );
}

const nodeTypes = { task: TaskNode, groupFrame: GroupFrameNode, sectionHeading: SectionHeadingNode };

// Finds where the straight line from this node's center toward the other
// node's center crosses this node's own rectangular boundary — the actual
// "floating" attachment point, recomputed from live positions on every
// render (not a fixed Top/Bottom handle, not a pre-baked dagre waypoint).
// Standard ellipse-scaled-to-rectangle intersection: cheap, and numerically
// well-behaved for the near-square card shape used here.
function getNodeIntersection(
  intersectionNode: NonNullable<ReturnType<typeof useInternalNode>>,
  targetNode: NonNullable<ReturnType<typeof useInternalNode>>
): { x: number; y: number } {
  const w = (intersectionNode.measured.width ?? NODE_WIDTH) / 2;
  const h = (intersectionNode.measured.height ?? NODE_HEIGHT) / 2;
  const nodePos = intersectionNode.internals.positionAbsolute;
  const targetPos = targetNode.internals.positionAbsolute;

  const x2 = nodePos.x + w;
  const y2 = nodePos.y + h;
  const x1 = targetPos.x + (targetNode.measured.width ?? NODE_WIDTH) / 2;
  const y1 = targetPos.y + (targetNode.measured.height ?? NODE_HEIGHT) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;

  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 };
}

// One consistent edge renderer for every connection on the canvas — series
// (dagre-auto or manually-dragged) and parallel alike. Always a straight
// line between the two nodes' live boundaries, so it stays correct through
// a drag and never depends on which layout produced the current positions
// (this replaces the old split between a dagre-waypoint renderer for
// auto-layout edges and a fixed Top/Bottom `smoothstep` for manually-
// positioned ones — that split was exactly why a dragged node ending up
// beside, rather than above/below, its neighbor produced a bent line).
// Selected state is deliberately NOT a new color — the node-selected
// convention elsewhere on this canvas is "thicker border, same hue" (see
// TaskNode's borderWidth 1 -> 2), and every color available here already
// carries a real meaning (orange = series, indigo = series touching a
// manually-positioned node, green = parallel) that a new "selected" color
// would collide with. Selected just bumps stroke width and switches to a
// solid line, keeping whichever color/dash the edge already had.
const SELECTED_STROKE_WIDTH = 3.5;

// Delete affordance is select-only, not hover-triggered — this canvas can
// get dense (see FLOWCHART_STATUS.md), and a button that appears on every
// hover while panning across a crowded graph would be far noisier than one
// that only appears on a deliberate click, which Delete/Backspace already
// complements as a keyboard alternative for the exact same selected state.
function FloatingEdge({ id, source, target, style, markerEnd, selected, data }: EdgeProps) {
  const actions = useContext(GraphActionsContext);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  // A manually-arranged grid's row-wrap edge (last task of one row to the
  // first task of the next) jumps both axes at once — a straight line
  // between floating intersection points reads as a stray diagonal slash
  // instead of a flowchart connector. Route just this case as a bottom-to-
  // top elbow (exit the bottom of the row it's leaving, enter the top of
  // the row it's joining) instead of computing a boundary intersection
  // toward the other node's center.
  let path: string;
  let labelX: number;
  let labelY: number;
  if (data?.bigVerticalJump) {
    const sw = sourceNode.measured.width ?? NODE_WIDTH;
    const sh = sourceNode.measured.height ?? NODE_HEIGHT;
    const tw = targetNode.measured.width ?? NODE_WIDTH;
    const sPos = sourceNode.internals.positionAbsolute;
    const tPos = targetNode.internals.positionAbsolute;
    if (data?.isBridge) {
      // A bridge (one section's task linked to a different section entirely)
      // needs real detour treatment a routine same-column pairing doesn't:
      // offset away from the date pill's centered span, a small gap so the
      // line doesn't touch either card, and the bend biased toward the
      // target so the long horizontal run stays in the empty gap ABOVE the
      // target's row instead of cutting across it. The source side is ALSO
      // offset — a bridge's source is very often the same node a straight
      // vertical pairing line already exits from dead-center, and without
      // this the two would run exactly on top of each other for the first
      // stretch, reading as one line instead of two distinct connections.
      const BRIDGE_SOURCE_EXIT_OFFSET = 75;
      const BRIDGE_TARGET_ENTRY_OFFSET = 100;
      const BRIDGE_GAP = 10;
      [path, labelX, labelY] = getSmoothStepPath({
        sourceX: sPos.x + sw / 2 + BRIDGE_SOURCE_EXIT_OFFSET,
        sourceY: sPos.y + sh + BRIDGE_GAP,
        sourcePosition: Position.Bottom,
        targetX: tPos.x + tw / 2 + BRIDGE_TARGET_ENTRY_OFFSET,
        targetY: tPos.y - BRIDGE_GAP,
        targetPosition: Position.Top,
        borderRadius: 12,
        stepPosition: 0.95,
      });
    } else {
      // A same-column pairing (or a genuine manually-arranged row-wrap) has
      // matching source/target X — center-to-center collapses to a plain
      // straight vertical line here, exactly as it did before bridges got
      // their own special-cased routing above. pairingFanOffset was a hub-
      // with-several-standalone-siblings accommodation from the old LR
      // layout (spreading overlapping same-column lines into their own
      // small channels); the current layoutWithDagre no longer computes it
      // (no real data needs it today), but this reads it defensively via
      // `?? 0` in case that ever gets reintroduced.
      const fanOffset = (data?.pairingFanOffset as number | undefined) ?? 0;
      [path, labelX, labelY] = getSmoothStepPath({
        sourceX: sPos.x + sw / 2 + fanOffset,
        sourceY: sPos.y + sh,
        sourcePosition: Position.Bottom,
        targetX: tPos.x + tw / 2 + fanOffset,
        targetY: tPos.y,
        targetPosition: Position.Top,
        borderRadius: 12,
      });
    }
  } else if (data?.bigHorizontalJump) {
    // A hub-and-spoke pairing whose two ends sit more than one column apart
    // (same row, so bigVerticalJump above didn't fire) — a straight line
    // between node centers would run directly through whichever column(s)
    // sit in between. Route it up out of the gap above the row instead: exit
    // and enter from each node's TOP edge, offset off-center so it doesn't
    // sit on top of that column's own FS-chain connector, which already owns
    // the centered top/bottom anchor points.
    const sw = sourceNode.measured.width ?? NODE_WIDTH;
    const tw = targetNode.measured.width ?? NODE_WIDTH;
    const sPos = sourceNode.internals.positionAbsolute;
    const tPos = targetNode.internals.positionAbsolute;
    const HOP_SOURCE_EXIT_OFFSET = 75;
    const HOP_TARGET_ENTRY_OFFSET = -75;
    const HOP_GAP = 20;
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX: sPos.x + sw / 2 + HOP_SOURCE_EXIT_OFFSET,
      sourceY: sPos.y - HOP_GAP,
      sourcePosition: Position.Top,
      targetX: tPos.x + tw / 2 + HOP_TARGET_ENTRY_OFFSET,
      targetY: tPos.y - HOP_GAP,
      targetPosition: Position.Top,
      borderRadius: 12,
    });
  } else {
    const sourceIntersection = getNodeIntersection(sourceNode, targetNode);
    const targetIntersection = getNodeIntersection(targetNode, sourceNode);
    [path] = getStraightPath({
      sourceX: sourceIntersection.x,
      sourceY: sourceIntersection.y,
      targetX: targetIntersection.x,
      targetY: targetIntersection.y,
    });
    labelX = (sourceIntersection.x + targetIntersection.x) / 2;
    labelY = (sourceIntersection.y + targetIntersection.y) / 2;
  }

  const effectiveStyle = selected
    ? { ...style, strokeWidth: SELECTED_STROKE_WIDTH, strokeDasharray: undefined }
    : style;

  const isParallel = data?.linkType === 'parallel';
  const dependencyType = (data?.dependencyType as DependencyType | undefined) ?? 'FS';

  return (
    <>
      <BaseEdge id={id} path={path} style={effectiveStyle} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        {/* Type badge — series edges only, always visible (not just on
            select/hover) so every FS/SS/FF/SF link is identifiable at a
            glance without opening a details panel. Plain static label now —
            changing an edge's type (including switching to/from Parallel,
            which this badge could never represent since it only ever
            rendered for series edges) is the unified create/edit panel's
            job; selecting this edge is what makes that panel show up in
            edit mode. */}
        {!isParallel && (
          <div
            className="nodrag nopan absolute text-center text-[9.5px] font-bold rounded px-1.5 py-0.5 shadow-sm bg-white border border-gray-300 text-gray-700"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            title={DEPENDENCY_TYPE_LABELS[dependencyType]}
          >
            {dependencyType}
          </div>
        )}
        {selected && !actions.locked && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); actions.onEdgeDeleteRequest(id); }}
            className="nodrag nopan absolute w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-300 flex items-center justify-center text-xs shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX + (isParallel ? 0 : 20)}px, ${labelY - 16}px)`, pointerEvents: 'all' }}
            title={isParallel ? 'Remove parallel link' : 'Remove dependency'}
          >
            ×
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { floating: FloatingEdge };

// Small line-style preview shared by the relationship panel and the
// legend, so the two always draw exactly the same swatch for a given type
// rather than two hand-maintained approximations of each other.
function RelationshipSwatch({ type }: { type: RelationshipType }) {
  const isParallel = type === 'PARALLEL';
  const color = isParallel ? PARALLEL_EDGE_COLOR : EDGE_COLOR;
  return (
    <svg width="26" height="10" viewBox="0 0 26 10" className="flex-shrink-0">
      <line x1="0" y1="5" x2={isParallel ? 26 : 19} y2="5" stroke={color} strokeWidth="2" strokeDasharray={isParallel ? '5 3' : undefined} />
      {!isParallel && <path d="M19,1 L26,5 L19,9 Z" fill={color} />}
    </svg>
  );
}

// One shared panel for both jobs the spec asks for: while the Link tool is
// active it picks which of the five types the next two-click creation will
// use (mode 'create'); while exactly one edge is selected instead, it shows
// that edge's current type and lets you change it in place (mode 'edit') —
// including switching category (Parallel <-> FS/SS/FF/SF), which the caller
// (requestEdgeTypeChange) handles as a delete-old/create-new swap rather
// than a field update. Same component, same five rows, same swatches
// either way, so the create and edit experiences never drift apart.
function RelationshipPanel({
  mode,
  activeType,
  onSelect,
  locked,
}: {
  mode: 'create' | 'edit';
  activeType: RelationshipType;
  onSelect: (type: RelationshipType) => void;
  locked: boolean;
}) {
  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-md p-2">
      <div className="px-1.5 pb-1.5 mb-1 border-b border-gray-100 text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide">
        {mode === 'create' ? 'Pick a relationship type' : "Change this link's type"}
      </div>
      <div className="flex flex-col gap-0.5">
        {RELATIONSHIP_TYPES.map((type) => {
          const isActive = type === activeType;
          return (
            <button
              key={type}
              type="button"
              disabled={locked}
              onClick={() => onSelect(type)}
              className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mt-1.5"><RelationshipSwatch type={type} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-semibold">
                  {type === 'PARALLEL' ? 'Parallel' : `${type} — ${RELATIONSHIP_LABELS[type]}`}
                </span>
                <span className={`block text-[10.5px] leading-snug ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                  {RELATIONSHIP_DESCRIPTIONS[type]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {mode === 'create' && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 px-1.5 text-[10px] text-gray-400 leading-snug">
          Click the active type again, press Esc, or pick Select to stop linking.
        </div>
      )}
    </div>
  );
}

// Manually-positioned nodes that end up merely close to (not exactly at)
// the same X as whatever they're connected to render as a slightly-off
// diagonal instead of the clean straight vertical line they're clearly
// meant to be — this snaps the free (non-manual) side into exact alignment
// when it's within this tolerance, so it reads as intentional rather than
// a near-miss. Never moves a node the admin manually positioned themselves.
const AUTO_ALIGN_TOLERANCE_PX = 24;

// Replaces the old dagre-LR-rank-based layout entirely (see this function's
// prior version in git history if it's ever needed) — every section of the
// flowchart now stacks vertically down the page, each as its own 1- or
// 2-column block, rather than every FS chain flowing left-to-right at its
// own dagre rank with parallel-linked pairs stacked as two horizontal rows.
// Verified against the live 122-task graph before this replaced the old
// version: 15 real sections (11 genuine 2-track pairs, 4 standalone final
// tasks), zero FS chains with any branching, zero overlapping boxes, all 14
// real cross-section bridges landing red and all 59 real same-section
// pairings landing blue (see the classification override below for why that
// needed an explicit fix, not just the old geometry-based read).
function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
  manualPositions: Map<string, { x: number; y: number }>
): { nodes: Node[]; edges: Edge[] } {
  const BASE_X = 100;
  // Matches the old LR layout's own rank-to-rank spacing for equal-sized
  // nodes (NODE_WIDTH + ranksep 130) — kept for visual consistency with the
  // rest of this canvas's established rhythm, not recomputed from scratch.
  const COL_GAP = NODE_WIDTH + 130;
  // Tighter than the old TB branch's ranksep (90) — that gap read as too
  // loose once chains started running many rows deep down the page.
  const ROW_STEP = NODE_HEIGHT + 40;
  const SECTION_GAP_ROWS = 1; // one extra row of space between consecutive sections

  const autoNodeIds = new Set(nodes.map((n) => n.id).filter((id) => !manualPositions.has(id)));

  const seriesEdges = edges.filter((e) => e.data?.linkType !== 'parallel');
  const parallelEdges = edges.filter((e) => e.data?.linkType === 'parallel');

  const undirected = new Map<string, Set<string>>();
  const successorOf = new Map<string, string[]>();
  const predecessorOf = new Map<string, string[]>();
  for (const id of autoNodeIds) { undirected.set(id, new Set()); successorOf.set(id, []); predecessorOf.set(id, []); }
  for (const e of seriesEdges) {
    if (!autoNodeIds.has(e.source) || !autoNodeIds.has(e.target)) continue;
    undirected.get(e.source)!.add(e.target);
    undirected.get(e.target)!.add(e.source);
    successorOf.get(e.source)!.push(e.target);
    predecessorOf.get(e.target)!.push(e.source);
  }

  // Connected components of the series-only graph = "chains" — manually-
  // positioned nodes are excluded entirely; this pass only ever arranges
  // auto-laid-out nodes, same convention the old layout used.
  const chainIdByNode = new Map<string, number>();
  let nextChainId = 0;
  const chains: { id: number; members: string[] }[] = [];
  for (const id of autoNodeIds) {
    if (chainIdByNode.has(id)) continue;
    const stack = [id];
    chainIdByNode.set(id, nextChainId);
    const members = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of undirected.get(cur) ?? []) {
        if (!chainIdByNode.has(nb)) { chainIdByNode.set(nb, nextChainId); members.push(nb); stack.push(nb); }
      }
    }
    chains.push({ id: nextChainId, members });
    nextChainId++;
  }

  // Row index (0-based) within each node's own chain. Every real chain in
  // this app today is a simple line — confirmed against the live dataset,
  // no task has more than one FS predecessor or successor — so this is
  // just a walk from the chain's one no-predecessor node along its single
  // successor, repeatedly. A chain that doesn't fit that shape (branching)
  // falls back to a one-off mini dagre TB layout scoped to just its own
  // nodes, so a future branching chain degrades gracefully instead of this
  // function crashing or silently mis-ordering rows.
  const rowIndexByNode = new Map<string, number>();
  for (const chain of chains) {
    const isSimple = chain.members.every(
      (id) => (successorOf.get(id)?.length ?? 0) <= 1 && (predecessorOf.get(id)?.length ?? 0) <= 1
    );
    if (isSimple) {
      const start = chain.members.find((id) => (predecessorOf.get(id)?.length ?? 0) === 0) ?? chain.members[0];
      let cur: string | undefined = start;
      let idx = 0;
      const seen = new Set<string>();
      while (cur != null && !seen.has(cur)) {
        seen.add(cur);
        rowIndexByNode.set(cur, idx);
        idx++;
        cur = successorOf.get(cur)?.[0];
      }
    } else {
      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 90 });
      g.setDefaultEdgeLabel(() => ({}));
      chain.members.forEach((id) => g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
      seriesEdges.forEach((e) => { if (chainIdByNode.get(e.source) === chain.id) g.setEdge(e.source, e.target); });
      dagre.layout(g);
      const ys = chain.members.map((id) => g.node(id).y);
      const minY = Math.min(...ys);
      chain.members.forEach((id) => rowIndexByNode.set(id, Math.round((g.node(id).y - minY) / ROW_STEP)));
    }
  }

  // Cross-chain parallel links, grouped by the (unordered) pair of chains
  // they connect. 2+ links between the same pair is a genuine dual-track
  // pairing (welded into one rigid "section" below); exactly 1 link is a
  // one-off cross-section bridge (see PARALLEL_BRIDGE_EDGE_COLOR) — never
  // welded, since realigning a whole chain onto a single incidental link
  // would drag it away from its own correct date-based position.
  const parallelLinksByChainPair = new Map<string, { id: string; source: string; target: string }[]>();
  for (const e of parallelEdges) {
    const chainA = chainIdByNode.get(e.source);
    const chainB = chainIdByNode.get(e.target);
    if (chainA == null || chainB == null || chainA === chainB) continue;
    const key = chainA < chainB ? `${chainA}:${chainB}` : `${chainB}:${chainA}`;
    if (!parallelLinksByChainPair.has(key)) parallelLinksByChainPair.set(key, []);
    parallelLinksByChainPair.get(key)!.push({ id: e.id, source: e.source, target: e.target });
  }
  const multiLinkPairs = [...parallelLinksByChainPair.entries()].filter(([, v]) => v.length > 1);
  const singleLinkPairs = [...parallelLinksByChainPair.entries()].filter(([, v]) => v.length === 1);

  const groupParent = new Map<number, number>();
  function findGroup(id: number): number {
    let root = id;
    while (groupParent.has(root) && groupParent.get(root) !== root) root = groupParent.get(root)!;
    groupParent.set(id, root);
    return root;
  }
  function unionGroup(a: number, b: number) {
    const rootA = findGroup(a);
    const rootB = findGroup(b);
    if (rootA !== rootB) groupParent.set(rootA, rootB);
  }
  for (const c of chains) if (!groupParent.has(c.id)) groupParent.set(c.id, c.id);
  for (const [key] of multiLinkPairs) { const [a, b] = key.split(':').map(Number); unionGroup(a, b); }

  const groupChains = new Map<number, { id: number; members: string[] }[]>();
  for (const c of chains) {
    const g = findGroup(c.id);
    if (!groupChains.has(g)) groupChains.set(g, []);
    groupChains.get(g)!.push(c);
  }

  // Which chain drives row-alignment (the "anchor" every other chain in the
  // group aligns its rows against) is a DIFFERENT question from which
  // column a chain should visually render in — the largest/most-complete
  // chain is the best alignment reference, but that's an internal-data
  // concern, not a reading-order one. Every set so far numbers its columns'
  // taskId codes in the intended left-to-right reading order (e.g. 21
  // Ground Floor, 22 Mezzanine, 23 Toilets, 24 Kitchen), so that numeric
  // prefix is what decides the actual rendered column below — completely
  // independent of which chain won the alignment role. A taskId without a
  // leading number sorts last rather than crashing.
  const taskIdByNodeId = new Map<string, string>();
  nodes.forEach((n) => {
    const taskId = (n.data as { taskId?: string } | undefined)?.taskId;
    if (taskId) taskIdByNodeId.set(n.id, taskId);
  });
  function taskIdPrefixNumber(nodeId: string): number {
    const taskId = taskIdByNodeId.get(nodeId);
    const match = taskId?.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : Infinity;
  }

  // Within each group, the largest chain (tie-break: lowest chain id, for
  // determinism) anchors row alignment: every OTHER chain in the group has
  // its row order pulled from whichever of its nodes is parallel-linked to
  // an anchor node at row r — so a real 1:1 pairing always lands on exactly
  // the same row, guaranteeing a perfectly horizontal connector by
  // construction, not by coincidence. A node with no such partner falls
  // back to continuing its own chain's order from its nearest already-
  // placed neighbor. A group with only one chain (no pairing at all) is
  // centered between the two column positions below rather than pinned
  // hard to column 0, so a lone standalone task doesn't read as an
  // orphaned left column next to every multi-column section around it.
  const columnByNode = new Map<string, number>();
  const groupOfNode = new Map<string, number>();
  const trackCountByGroup = new Map<number, number>();
  for (const [groupId, memberChains] of groupChains) {
    const sizeSorted = [...memberChains].sort((a, b) => b.members.length - a.members.length || a.id - b.id);
    trackCountByGroup.set(groupId, sizeSorted.length);
    const anchor = sizeSorted[0];
    anchor.members.forEach((id) => groupOfNode.set(id, groupId));

    for (let i = 1; i < sizeSorted.length; i++) {
      const track = sizeSorted[i];
      track.members.forEach((id) => groupOfNode.set(id, groupId));
      const anchorRowForNode = new Map<string, number>();
      for (const e of parallelEdges) {
        const srcChain = chainIdByNode.get(e.source);
        const tgtChain = chainIdByNode.get(e.target);
        if (srcChain === anchor.id && tgtChain === track.id) anchorRowForNode.set(e.target, rowIndexByNode.get(e.source)!);
        else if (tgtChain === anchor.id && srcChain === track.id) anchorRowForNode.set(e.source, rowIndexByNode.get(e.target)!);
      }
      const start = track.members.find((id) => (predecessorOf.get(id)?.length ?? 0) === 0) ?? track.members[0];
      let cur: string | undefined = start;
      let prevRow = -1;
      const seen = new Set<string>();
      while (cur != null && !seen.has(cur)) {
        seen.add(cur);
        const anchored = anchorRowForNode.get(cur);
        const row = anchored != null ? Math.max(anchored, prevRow + 1) : prevRow + 1;
        rowIndexByNode.set(cur, row);
        prevRow = row;
        cur = successorOf.get(cur)?.[0];
      }
    }

    const visualOrder = [...memberChains].sort(
      (a, b) => taskIdPrefixNumber(a.members[0]) - taskIdPrefixNumber(b.members[0])
    );
    visualOrder.forEach((chain, col) => {
      chain.members.forEach((id) => columnByNode.set(id, col));
    });
  }

  // Sections stack top to bottom by task-ID number, NOT calendar date —
  // every set so far was created with its column numbers strictly
  // increasing in the exact order it was meant to appear, so this already
  // matches chronological order wherever the schedule really is one
  // continuous timeline (sets 1-12). It stops being the same thing once a
  // separate workstream is introduced whose OWN dates overlap the existing
  // schedule instead of continuing past it — e.g. "External Works" (cols
  // 25+) runs 7/27-8/12, which falls WITHIN the internal-works date range,
  // not after it. Sorting by date there would sandwich it in the middle of
  // the board instead of below everything, which is never what a new
  // phase divider (see SECTION_HEADINGS) is meant to do. Task-ID order is
  // the one thing that reliably reflects "which phase, and where in it"
  // regardless of how the calendar dates actually overlap.
  const groupMinTaskIdNumber = new Map<number, number>();
  const groupMaxTaskIdNumber = new Map<number, number>();
  for (const [groupId, memberChains] of groupChains) {
    const allIds = memberChains.flatMap((c) => c.members);
    const nums = allIds.map((id) => taskIdPrefixNumber(id));
    groupMinTaskIdNumber.set(groupId, Math.min(...nums));
    groupMaxTaskIdNumber.set(groupId, Math.max(...nums));
  }
  const orderedGroups = [...groupChains.keys()].sort(
    (a, b) => groupMinTaskIdNumber.get(a)! - groupMinTaskIdNumber.get(b)!
  );

  // A SECTION_HEADINGS banner needs extra vertical room reserved right below
  // whichever group its afterColumnNumber falls inside (that group's column
  // range spans it) — otherwise the next group's first row lands where the
  // banner's own margin/gap math would put it, and the banner overlaps one
  // side or the other. A group here can be a multi-column set (e.g. Ground/
  // Mezzanine/Toilets/Kitchen sharing one groupId), so this checks the whole
  // [min, max] column range, not a single task.
  const headingAfterGroupIds = new Set<number>();
  for (const heading of SECTION_HEADINGS) {
    for (const groupId of groupChains.keys()) {
      const min = groupMinTaskIdNumber.get(groupId)!;
      const max = groupMaxTaskIdNumber.get(groupId)!;
      if (heading.afterColumnNumber >= min && heading.afterColumnNumber <= max) headingAfterGroupIds.add(groupId);
    }
  }
  const HEADING_GAP_ROWS = Math.ceil(
    (SECTION_HEADING_GAP_ABOVE + SECTION_HEADING_HEIGHT + SECTION_HEADING_GAP_BELOW) / ROW_STEP
  );

  const yOffsetByGroup = new Map<number, number>();
  let cumulativeRows = 0;
  for (const groupId of orderedGroups) {
    yOffsetByGroup.set(groupId, cumulativeRows * ROW_STEP);
    const memberChains = groupChains.get(groupId)!;
    const maxRow = Math.max(...memberChains.flatMap((c) => c.members.map((id) => rowIndexByNode.get(id) ?? 0)));
    const gapRows = headingAfterGroupIds.has(groupId) ? HEADING_GAP_ROWS : SECTION_GAP_ROWS;
    cumulativeRows += maxRow + 1 + gapRows;
  }

  const autoNodePositions = new Map<string, { x: number; y: number }>();
  for (const id of autoNodeIds) {
    const groupId = groupOfNode.get(id);
    if (groupId == null) { autoNodePositions.set(id, { x: BASE_X, y: 0 }); continue; }
    const col = columnByNode.get(id) ?? 0;
    const trackCount = trackCountByGroup.get(groupId) ?? 1;
    const x = trackCount === 1 ? BASE_X + COL_GAP / 2 : BASE_X + col * COL_GAP;
    const y = (yOffsetByGroup.get(groupId) ?? 0) + (rowIndexByNode.get(id) ?? 0) * ROW_STEP;
    autoNodePositions.set(id, { x, y });
  }

  // Explicit, data-driven pairing/bridge sets — NOT inferred from resulting
  // pixel geometry the way the old LR layout could get away with. This
  // layout only ever uses a small, fixed set of column X values, so a
  // genuine cross-section bridge lands at the exact same dx as a real
  // same-group pairing about half the time purely by chance; geometry
  // alone can no longer tell the two apart (verified against the live
  // 122-task graph before shipping this: 12 of 14 real bridges came out
  // dx=0 under a pure geometric read).
  const realPairingEdgeIds = new Set<string>();
  for (const [, links] of multiLinkPairs) for (const l of links) realPairingEdgeIds.add(l.id);
  const knownBridgeEdgeIds = new Set<string>();
  for (const [, links] of singleLinkPairs) knownBridgeEdgeIds.add(links[0].id);

  // Snap a free node into exact alignment with a manually-positioned
  // neighbor it's already nearly aligned with — a chain's own straight
  // line now shares an X (its column), not a Y, so that's the axis this
  // snaps (the reverse of the old LR layout's convention).
  for (const e of edges) {
    const sourceManual = manualPositions.get(e.source);
    const targetManual = manualPositions.get(e.target);
    if (!!sourceManual === !!targetManual) continue; // need exactly one manual side
    const manual = sourceManual ?? targetManual!;
    const freeId = sourceManual ? e.target : e.source;
    const free = autoNodePositions.get(freeId);
    if (!free) continue;
    const delta = Math.abs(free.x - manual.x);
    if (delta > 0 && delta <= AUTO_ALIGN_TOLERANCE_PX) {
      autoNodePositions.set(freeId, { ...free, x: manual.x });
    }
  }

  const positionedNodes = nodes.map((n) => {
    const manual = manualPositions.get(n.id);
    if (manual) return { ...n, position: manual };
    return { ...n, position: autoNodePositions.get(n.id) ?? { x: 0, y: 0 } };
  });

  const positionById = new Map(positionedNodes.map((n) => [n.id, n.position]));
  const BIG_VERTICAL_JUMP_THRESHOLD = NODE_HEIGHT * 1.5;

  const positionedEdges = edges.map((e) => {
    const sourcePos = positionById.get(e.source);
    const targetPos = positionById.get(e.target);
    const bigVerticalJump = !!sourcePos && !!targetPos
      && Math.abs(sourcePos.y - targetPos.y) > BIG_VERTICAL_JUMP_THRESHOLD;

    if (e.data?.linkType === 'parallel') {
      let isPairing: boolean;
      let isBridge: boolean;
      if (knownBridgeEdgeIds.has(e.id)) { isBridge = true; isPairing = false; }
      else if (realPairingEdgeIds.has(e.id)) { isPairing = true; isBridge = false; }
      else {
        // Anything not covered by the two sets above (e.g. an edge
        // touching a manually-positioned node, so it was never part of
        // any group computed here) falls back to the same geometric read
        // the rest of this canvas has always used.
        isPairing = !!sourcePos && !!targetPos && Math.abs(sourcePos.x - targetPos.x) <= 1;
        isBridge = !isPairing && bigVerticalJump;
      }

      // A hub-and-spoke pairing (3+ tracks in one group, all linked to a
      // shared anchor) can connect two tracks that AREN'T next to each other
      // once columns are ordered by taskId — e.g. anchor in column 0 linked
      // to a spoke in column 2 skips right over column 1's tasks. A straight
      // line between those two nodes' centers runs directly through the
      // skipped column's boxes instead of past them. Same-row (no
      // bigVerticalJump) pairings spanning more than one column gap need the
      // elevated "hop" routing in FloatingEdge instead of a straight line.
      const bigHorizontalJump = isPairing && !bigVerticalJump && !!sourcePos && !!targetPos
        && Math.abs(sourcePos.x - targetPos.x) > COL_GAP * 1.5;

      return {
        ...e,
        type: 'floating',
        data: { ...e.data, bigVerticalJump, isBridge, bigHorizontalJump },
        // A bridge is solid and a touch thicker than the routine dashed
        // pairing line — it's a rare, deliberate cross-section note, not
        // just another same-track pair, so it should read as heavier/more
        // permanent rather than blend in as one more dashed connector.
        style: isBridge
          ? { stroke: PARALLEL_BRIDGE_EDGE_COLOR, strokeWidth: 2.5 }
          : { stroke: PARALLEL_EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '6 4' },
      };
    }

    // Series (FS/SS/FF/SF) is always orange, full stop.
    const data = { ...e.data, bigVerticalJump };
    return { ...e, type: 'floating', data };
  });

  return { nodes: positionedNodes, edges: positionedEdges };
}

interface CreateFormState {
  position: { x: number; y: number };
  // Free-typed prefix, not a Work/Trade picker — combined with taskName as
  // "{category} — {taskName}" on submit (same convention splitTaskName
  // reads back on the card), left blank if the admin doesn't type one.
  category: string;
  taskName: string;
  // No longer a visible field — Work/Trade and Task Type pickers were
  // removed from this form per request; workId still has to be set for the
  // underlying HvacTask row, so it's defaulted silently (see openCreateForm)
  // rather than surfaced as a control.
  workId: string;
  plannedStartDate: string;
  dueDate: string;
}

interface EditFormState {
  nodeId: string;
  // Split the same way the canvas card itself splits a name (splitTaskName)
  // — category is the read-only "{section header}" prefix shown for
  // context, taskName here holds ONLY the editable action part. Reassembled
  // back into one string on save (see submitEditForm); a task with no such
  // prefix just has category: null and taskName holding the whole name,
  // unaffected.
  category: string | null;
  taskName: string;
  description: string;
  plannedStartDate: string;
  dueDate: string;
  taskTypeId: string; // '' = no type
  // Freeform, NOT persisted on HvacTask itself — purely a client-side input
  // that (combined with plannedStartDate) drives the dueDate auto-suggestion
  // below, the same "Task Type -> defaultDurationDays -> suggested due date"
  // flow the separate Create Task form already has (see TaskForm.tsx). Only
  // taskTypeId and the resulting dueDate actually get saved.
  durationDays: string;
}

interface DeleteConfirmState {
  nodeId: string;
  taskName: string;
  humanTaskId: string;
  impact: TaskDeleteImpact | null;
  loading: boolean;
  error: string | null;
}

const ADD_TASK_ACTION_INITIAL: ActionResult = { success: true };

interface TaskDependencyGraphProps {
  tasks: GraphTask[];
  edges: GraphEdgeInput[];
  parallelEdges: GraphEdgeInput[];
  works: WorkOption[];
  taskTypes: TaskTypeOption[];
  isFullscreen?: boolean;
  onReady?: (instance: ReactFlowInstance) => void;
  emptyState?: { hasFilter: boolean; onClear: () => void };
  fullscreenContainer?: React.RefObject<HTMLElement | null>;
}

export function TaskDependencyGraph({
  // taskTypes was unused here for a while (the create form's own Task Type
  // picker was removed from the Add Task dialog) — now read by the EDIT
  // dialog's Task Type dropdown instead (see the Quick Edit dialog below).
  tasks, edges, parallelEdges, works, taskTypes, isFullscreen, onReady, emptyState, fullscreenContainer,
}: TaskDependencyGraphProps) {
  const router = useRouter();
  const [darkCanvas, setDarkCanvas] = useState(false);
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [groupByTrade, setGroupByTrade] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pendingLinkSource, setPendingLinkSource] = useState<string | null>(null);
  // Persistent — set from the create panel, not a popup shown after both
  // nodes are picked. Whatever this is set to when the SECOND node is
  // clicked is the type of link created, and it stays set afterward so
  // several links of the same type can be made back-to-back without
  // reopening the panel each time. Defaults to FS, matching the exact
  // two-click, FS-only flow this replaces for an admin who never touches it.
  const [linkType, setLinkType] = useState<RelationshipType>('FS');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [banner, setBanner] = useState<{ type: 'error' | 'saved'; text: string } | null>(null);
  function flashSaved() {
    setBanner({ type: 'saved', text: 'Saved' });
    setTimeout(() => setBanner((b) => (b?.text === 'Saved' ? null : b)), 1500);
  }
  function flashError(text: string) {
    setBanner({ type: 'error', text });
  }

  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [edgeDeleteConfirm, setEdgeDeleteConfirm] = useState<{ edgeId: string } | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState<CreateFormState | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const requestDeleteNode = useCallback((nodeId: string) => {
    const task = tasks.find((t) => t.id === nodeId);
    if (!task) return;
    setDeleteConfirm({ nodeId, taskName: task.taskName, humanTaskId: task.taskId, impact: null, loading: true, error: null });
    getTaskDeleteImpact(nodeId).then((res) => {
      setDeleteConfirm((prev) => (prev && prev.nodeId === nodeId
        ? { ...prev, loading: false, impact: res.success ? res.data! : null, error: res.success ? null : (formatActionError(res.error, 'Failed to load task info')) }
        : prev));
    });
  }, [tasks]);

  const openEditForm = useCallback((nodeId: string) => {
    const task = tasks.find((t) => t.id === nodeId);
    if (!task) return;
    const { category, action } = splitTaskName(task.taskName);
    setEditForm({
      nodeId: task.id,
      category,
      taskName: action,
      description: task.description ?? '',
      plannedStartDate: task.plannedStartDate ? formatDateKey(task.plannedStartDate, { utc: true }) : '',
      dueDate: task.dueDate ? formatDateKey(task.dueDate, { utc: true }) : '',
      taskTypeId: task.taskTypeId ?? '',
      durationDays: '',
    });
    setEditError(null);
  }, [tasks]);

  const handleConnectFromNode = useCallback((nodeId: string) => {
    setActiveTool('link');
    setPendingLinkSource(nodeId);
  }, []);

  // Mirrors Create Task's own "Task Type -> defaultDurationDays -> suggested
  // due date" flow (see TaskForm.tsx) — recomputes dueDate whenever
  // durationDays or plannedStartDate changes, still fully overridable
  // afterward via the date picker itself. Deliberately NOT keyed on dueDate,
  // so a manual date pick doesn't get immediately clobbered back by this
  // effect re-running.
  useEffect(() => {
    if (!editForm?.plannedStartDate || !editForm?.durationDays) return;
    const days = parseInt(editForm.durationDays, 10);
    if (!Number.isFinite(days) || days <= 0) return;
    let cancelled = false;
    computeDueDate(editForm.plannedStartDate, days).then((due) => {
      if (!cancelled) setEditForm((f) => (f ? { ...f, dueDate: due } : f));
    });
    return () => { cancelled = true; };
  }, [editForm?.plannedStartDate, editForm?.durationDays]);

  // computedNodes/computedEdges bake in only the two callbacks that never
  // need to change out from under a running drag (onDeleteRequest/
  // onConnectFromNode depend only on `tasks`) — this keeps each node's
  // `data` reference stable across position-only updates, which combined
  // with TaskNode's React.memo means a drag on one node no longer forces
  // the other 94 to re-render. Everything that DOES change independently of
  // task data (duplicate/status/rename callbacks, lock state, which node is
  // the pending connect-source) is read from GraphActionsContext instead of
  // `data` — see the Provider further down.
  const { nodes: computedNodes, edges: computedEdges } = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    const rawNodes: Node[] = tasks.map((t) => ({
      id: t.id,
      type: 'task',
      data: {
        ...t,
        onDeleteRequest: requestDeleteNode,
        onConnectFromNode: handleConnectFromNode,
      } as unknown as NodeData,
      position: { x: 0, y: 0 },
    }));

    const rawEdges: Edge[] = edges
      .filter((e) => taskById.has(e.source) && taskById.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'floating',
        data: { linkType: 'series', dependencyType: e.type ?? 'FS' },
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
        style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
      }));

    // Symmetric, non-blocking — dashed, distinctly-colored, and deliberately
    // no markerEnd (an arrow would wrongly imply an order between the two).
    const rawParallelEdges: Edge[] = parallelEdges
      .filter((e) => taskById.has(e.source) && taskById.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'floating',
        data: { linkType: 'parallel' },
        style: { stroke: PARALLEL_EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '6 4' },
      }));

    const manualPositions = new Map(
      tasks
        .filter((t) => t.manualPositionX != null && t.manualPositionY != null)
        .map((t) => [t.id, { x: t.manualPositionX!, y: t.manualPositionY! }])
    );

    return layoutWithDagre(rawNodes, [...rawEdges, ...rawParallelEdges], manualPositions);
  }, [tasks, edges, parallelEdges, requestDeleteNode, handleConnectFromNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(computedNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
    setFlowEdges(computedEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedNodes, computedEdges]);

  // Read by handleDuplicate below so it can look up a node's current
  // position without depending on `nodes` directly — depending on `nodes`
  // would give handleDuplicate (and therefore GraphActionsContext's value)
  // a new identity on every drag frame, undoing the memo-stability fix.
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Same reasoning as nodesRef above — requestEdgeDelete/handleReconnect are
  // handed to context (edges) or React Flow props directly, so they need a
  // way to read the latest edges without depending on `flowEdges` and
  // acquiring a new identity every time an edge moves/changes.
  const flowEdgesRef = useRef(flowEdges);
  useEffect(() => {
    flowEdgesRef.current = flowEdges;
  }, [flowEdges]);

  const handleDuplicate = useCallback((nodeId: string) => {
    const task = tasks.find((t) => t.id === nodeId);
    if (!task || !task.workId) return;
    createTaskFromCanvas({
      taskName: `${task.taskName} (Copy)`,
      workId: task.workId,
      manualPositionX: (task.manualPositionX ?? 0) + 40,
      manualPositionY: (task.manualPositionY ?? 0) + 40,
    }).then((res) => {
      if (!res.success) {
        flashError(formatActionError(res.error, 'Failed to duplicate task'));
        return;
      }
      if (!res.data) {
        flashError('Failed to duplicate task');
        return;
      }
      const original = nodesRef.current.find((n) => n.id === nodeId);
      const position = original
        ? { x: original.position.x + 40, y: original.position.y + 40 }
        : { x: 0, y: 0 };
      setNodes((nds) => [
        ...nds,
        {
          id: res.data!.id,
          type: 'task',
          position,
          data: {
            id: res.data!.id,
            taskId: res.data!.taskId,
            taskName: res.data!.taskName,
            status: 'draft',
            workId: task.workId,
            workCode: task.workCode,
            workColor: task.workColor,
            assigneeName: null,
            plannedStartDate: null,
            dueDate: null,
            manualPositionX: position.x,
            manualPositionY: position.y,
            prerequisiteCount: 0,
            prerequisiteCompletedCount: 0,
          } as unknown as NodeData,
        },
      ]);
      flashSaved();
    });
  }, [tasks, setNodes]);

  const handleQuickStatusChange = useCallback((nodeId: string, status: TaskStatus) => {
    updateTaskStatus(nodeId, status).then((res) => {
      if (!res.success) {
        flashError(formatActionError(res.error, 'Failed to update status'));
        return;
      }
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status } } : n)));
      flashSaved();
    });
  }, [setNodes]);

  // Group-by-trade frames — computed from LIVE local node positions (so they
  // track drags in real time), one per distinct Work among currently visible
  // nodes. Rendered first in the array + given a negative zIndex so real task
  // nodes always paint on top.
  const groupFrameNodes = useMemo((): Node[] => {
    if (!groupByTrade) return [];
    const byWork = new Map<string, { color: string; name: string; positions: { x: number; y: number }[] }>();
    for (const n of nodes) {
      if (n.type !== 'task') continue;
      const d = n.data as unknown as NodeData;
      const key = d.workCode;
      if (!byWork.has(key)) byWork.set(key, { color: d.workColor, name: d.workCode, positions: [] });
      byWork.get(key)!.positions.push(n.position);
    }
    const PAD = 32;
    return [...byWork.entries()].map(([code, g]) => {
      const minX = Math.min(...g.positions.map((p) => p.x)) - PAD;
      const minY = Math.min(...g.positions.map((p) => p.y)) - PAD - 20;
      const maxX = Math.max(...g.positions.map((p) => p.x + NODE_WIDTH)) + PAD;
      const maxY = Math.max(...g.positions.map((p) => p.y + NODE_HEIGHT)) + PAD;
      return {
        id: `group-${code}`,
        type: 'groupFrame',
        position: { x: minX, y: minY },
        width: maxX - minX,
        height: maxY - minY,
        data: { color: g.color, label: g.name },
        draggable: false,
        selectable: false,
        zIndex: -1,
      } as Node;
    });
  }, [nodes, groupByTrade]);

  // Renders SECTION_HEADINGS (module scope, above) — hardcoded dividers
  // marking where each new phase of work begins, not tied to any real
  // task/Work as data, just a visual break between phases. Each one is
  // positioned with a gap above and below so it doesn't crowd either the
  // phase it closes out or the one below it.
  const sectionHeadingNodes = useMemo((): Node[] => {
    const taskNodes = nodes.filter((n) => n.type === 'task');
    if (taskNodes.length === 0) return [];
    const minX = Math.min(...taskNodes.map((n) => n.position.x));
    const maxX = Math.max(...taskNodes.map((n) => n.position.x + NODE_WIDTH));
    const overallMaxY = Math.max(...taskNodes.map((n) => n.position.y + NODE_HEIGHT));

    return SECTION_HEADINGS.map((heading) => {
      // The bottom edge of every task belonging to this phase (column number
      // <= afterColumnNumber) — NOT one hardcoded task's Y — since a phase's
      // columns can run to different depths (e.g. Mezzanine Floor/Toilets
      // Works ending 2 rows past Kitchen Works in the same set). Falls back
      // to the board's current bottom only if no matching task exists yet.
      const phaseNodes = taskNodes.filter(
        (n) => taskIdColumnNumber((n.data as { taskId?: string } | undefined)?.taskId) <= heading.afterColumnNumber
      );
      const anchorBottomY = phaseNodes.length > 0
        ? Math.max(...phaseNodes.map((n) => n.position.y + NODE_HEIGHT))
        : overallMaxY;
      return {
        id: `section-heading-${heading.label.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'sectionHeading',
        position: { x: minX, y: anchorBottomY + SECTION_HEADING_GAP_ABOVE },
        width: maxX - minX,
        height: SECTION_HEADING_HEIGHT,
        data: { label: heading.label },
        draggable: false,
        selectable: false,
        zIndex: -1,
      } as Node;
    });
    // The gap BELOW each banner is reserved by layoutWithDagre's own
    // HEADING_GAP_ROWS (computed from these same SECTION_HEADING_* constants)
    // for the group whose last task is a heading's anchor — this memo only
    // has to place the banner itself, not carve out room for what's below it.
  }, [nodes]);

  // Read by every TaskNode via GraphActionsContext instead of via `data` —
  // memoized so a position-only change to `nodes` (a drag frame) does NOT
  // give this a new reference, which would otherwise re-render every node
  // through context the same way the old per-node `data` remap did.
  // Stable regardless of anything else re-rendering — navigation only ever
  // happens through this explicit action now, never as a side effect of
  // selecting a node.
  const handleOpenTask = useCallback((nodeId: string) => {
    const url = `/tasks/${nodeId}`;
    if (isFullscreen) window.open(url, '_blank');
    else router.push(url);
  }, [isFullscreen, router]);

  // Parallel links are non-blocking and purely visual — removing one has no
  // workflow consequence, so it deletes immediately. Series links gate a
  // real downstream task's status, so removing one goes through the
  // confirmation dialog instead (performEdgeDelete/confirmEdgeDelete below,
  // both plain hoisted function declarations so their source-order position
  // after this callback doesn't matter).
  const requestEdgeDelete = useCallback((edgeId: string) => {
    const edge = flowEdgesRef.current.find((e) => e.id === edgeId);
    if (!edge) return;
    if (edge.data?.linkType === 'parallel') {
      performEdgeDelete(edgeId, 'parallel');
    } else {
      setEdgeDeleteConfirm({ edgeId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unifies "just change FS<->SS<->FF<->SF in place" (a single field update
  // on the same TaskDependency row — optimistic, reverts on a failed server
  // call) with "switch category" (Parallel <-> one of the four gating
  // types — a different underlying table, TaskParallelLink vs
  // TaskDependency, so this deletes the old row and creates a new one of
  // the right kind instead). Both category-switch directions create the
  // new row FIRST, running the exact same validation its normal create path
  // already runs (cycle-check for a new TaskDependency, symmetric-
  // duplicate-check for a new TaskParallelLink), and only remove the old
  // row once that succeeds — a rejected switch leaves the original link
  // completely untouched rather than deleting first and hoping the
  // replacement goes through.
  const requestEdgeTypeChange = useCallback((edgeId: string, newType: RelationshipType) => {
    const edge = flowEdgesRef.current.find((e) => e.id === edgeId);
    if (!edge) return;
    const wasParallel = edge.data?.linkType === 'parallel';
    const currentType: RelationshipType = wasParallel ? 'PARALLEL' : ((edge.data?.dependencyType as DependencyType | undefined) ?? 'FS');
    if (currentType === newType) return;

    const willBeParallel = newType === 'PARALLEL';

    if (!wasParallel && !willBeParallel) {
      const previous = flowEdgesRef.current;
      const nextEdges = previous.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, dependencyType: newType } } : e));
      setFlowEdges(nextEdges);
      updatePrereqBadges([edge.target], nextEdges);
      if (edgeId.startsWith('temp-')) return;
      updateDependencyType(edgeId, newType).then((res) => {
        if (!res.success) {
          flashError(formatActionError(res.error, 'Failed to update dependency type'));
          setFlowEdges(previous);
          updatePrereqBadges([edge.target], previous);
        }
      });
      return;
    }

    const { source, target } = edge;

    if (wasParallel && !willBeParallel) {
      // Parallel is symmetric and carries no "which one is the
      // prerequisite" ordering — the edge's existing source becomes the
      // new dependency's prerequisite (dependsOnTaskId), an arbitrary but
      // deterministic choice (same source/target the parallel link
      // already had, just now read directionally).
      const fd = new FormData();
      fd.set('taskId', target);
      fd.set('dependsOnTaskId', source);
      fd.set('type', newType);
      addTaskDependency(ADD_TASK_ACTION_INITIAL, fd).then((res) => {
        if (!res.success) {
          flashError(formatActionError(res.error, `Could not switch to ${DEPENDENCY_TYPE_LABELS[newType]}`));
          return;
        }
        const newEdgeId = `temp-${source}-${target}`;
        const nextEdges: Edge[] = [
          ...flowEdgesRef.current.filter((e) => e.id !== edgeId),
          {
            id: newEdgeId,
            source,
            target,
            type: 'floating',
            data: { linkType: 'series', dependencyType: newType },
            markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
            style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
          },
        ];
        setFlowEdges(nextEdges);
        updatePrereqBadges([target], nextEdges);
        if (!edgeId.startsWith('temp-')) {
          removeParallelLink(edgeId).then((r) => {
            if (!r.success) flashError(formatActionError(r.error, 'Switched type, but failed to remove the old parallel link'));
          });
        }
        flashSaved();
      });
      return;
    }

    // Series -> Parallel
    createParallelLink(source, target).then((res) => {
      if (!res.success) {
        flashError(formatActionError(res.error, 'Could not switch to Parallel'));
        return;
      }
      const newEdgeId = `temp-parallel-${source}-${target}`;
      const nextEdges: Edge[] = [
        ...flowEdgesRef.current.filter((e) => e.id !== edgeId),
        {
          id: newEdgeId,
          source,
          target,
          type: 'floating',
          data: { linkType: 'parallel' },
          style: { stroke: PARALLEL_EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '6 4' },
        },
      ];
      setFlowEdges(nextEdges);
      updatePrereqBadges([target], nextEdges);
      if (!edgeId.startsWith('temp-')) {
        removeTaskDependency(edgeId).then((r) => {
          if (!r.success) flashError(formatActionError(r.error, 'Switched type, but failed to remove the old dependency'));
        });
      }
      flashSaved();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const graphActionsValue = useMemo(
    (): GraphActions => ({
      onDuplicate: handleDuplicate,
      onQuickStatusChange: handleQuickStatusChange,
      onRenameRequest: openEditForm,
      onOpenTask: handleOpenTask,
      onEdgeDeleteRequest: requestEdgeDelete,
      locked,
      pendingLinkSource,
      linkType: activeTool === 'link' ? linkType : null,
      hoveredNodeId,
    }),
    [handleDuplicate, handleQuickStatusChange, openEditForm, handleOpenTask, requestEdgeDelete, locked, pendingLinkSource, activeTool, linkType, hoveredNodeId]
  );

  const nodesForFlow = useMemo(
    () => (groupByTrade ? [...groupFrameNodes, ...sectionHeadingNodes, ...nodes] : [...sectionHeadingNodes, ...nodes]),
    [groupByTrade, groupFrameNodes, sectionHeadingNodes, nodes]
  );

  // Selects only — the floating toolbar (hover- or selection-driven, see
  // TaskNode) is now the only way to act on a node, including navigating to
  // its detail page (via the toolbar's explicit "Open task" button). A plain
  // click used to navigate immediately, which meant the toolbar could never
  // actually be seen/used before the page changed out from under it.
  function handleNodeClick(_: unknown, node: Node) {
    if (node.type !== 'task') return;
    if (activeTool === 'link' && !locked) {
      if (!pendingLinkSource) {
        setPendingLinkSource(node.id);
        return;
      }
      if (pendingLinkSource === node.id) {
        setPendingLinkSource(null); // clicked the same node again — cancel
        return;
      }
      // Click order convention (unchanged from the old Connect tool, now
      // applied consistently across all four gating types): 1st click is
      // the prerequisite/earlier task, 2nd click is the one gated by it.
      // Parallel is symmetric, so the order is irrelevant there — reusing
      // the exact same two-click flow either way is what makes rapid
      // same-type creation work without any special-casing per type.
      void completeLink(pendingLinkSource, node.id, linkType);
      return;
    }
    // Otherwise: nothing to do here — React Flow has already applied its own
    // selection state by the time this fires, which is all a plain click
    // should do.
  }

  function handleNodeDoubleClick(_: unknown, node: Node) {
    if (locked || node.type !== 'task') return;
    openEditForm(node.id);
  }

  function handleNodeMouseEnter(_: unknown, node: Node) {
    if (node.type === 'task') setHoveredNodeId(node.id);
  }

  function handleNodeMouseLeave() {
    setHoveredNodeId(null);
  }

  // The toolbar's "Add task" button always starts from the same viewport-
  // center point, so creating two tasks in a row without panning would
  // otherwise stack the second directly on top of the first, hiding it.
  // Nudges diagonally in fixed steps until it finds a spot that doesn't
  // overlap any existing node's bounding box.
  function findClearPosition(desired: { x: number; y: number }): { x: number; y: number } {
    const isOccupied = (pos: { x: number; y: number }) =>
      nodes.some((n) => n.type === 'task'
        && Math.abs(n.position.x - pos.x) < NODE_WIDTH * 0.75
        && Math.abs(n.position.y - pos.y) < NODE_HEIGHT * 0.75);

    let candidate = { ...desired };
    let attempts = 0;
    while (isOccupied(candidate) && attempts < 30) {
      candidate = { x: candidate.x + 40, y: candidate.y + 40 };
      attempts++;
    }
    return candidate;
  }

  function handlePaneDoubleClick(event: React.MouseEvent) {
    if (locked || activeTool !== 'add' || !instanceRef.current) return;
    const position = instanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    openCreateForm(findClearPosition(position));
  }

  function handleAddTaskClick() {
    setActiveTool('add');
    const position = instanceRef.current?.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }) ?? { x: 0, y: 0 };
    openCreateForm(findClearPosition(position));
  }

  function openCreateForm(position: { x: number; y: number }) {
    setCreateForm({
      position,
      category: '',
      taskName: '',
      // Silent default — Civil is the trade every task created on this
      // canvas has actually been under; falls back to whatever's first if
      // that work doesn't exist for some reason.
      workId: works.find((w) => w.code === 'CIVIL')?.id ?? works[0]?.id ?? '',
      plannedStartDate: '',
      dueDate: '',
    });
    setCreateError(null);
  }

  function handleNodeDragStop(_event: unknown, node: Node) {
    if (node.type !== 'task') return;
    updateTaskManualPosition(node.id, node.position.x, node.position.y).then((res) => {
      if (res.success) flashSaved();
      else flashError(formatActionError(res.error, 'Failed to save position'));
    });
  }

  // Part 2's auto-layout-after-connect: if BOTH endpoints have no manual
  // position override, re-run the same dagre layout locally (immediately,
  // not waiting on the server round-trip) over the current graph plus the
  // new edge, and snap just the still-auto-laid-out nodes to their fresh
  // positions. Manually-positioned nodes are never touched. This does NOT
  // persist a manual position for the moved nodes — they stay eligible for
  // auto-layout going forward, which is the point (a one-time visual
  // settle, not a snapshot).
  async function completeConnection(sourceId: string, targetId: string, type: DependencyType) {
    // Deliberately does NOT touch activeTool — the panel (and linkType)
    // stays exactly as it is, on both success and failure, so several links
    // of the same type can be created back to back without reopening it.
    // Only the two-click cycle itself resets, so the next click starts a
    // fresh pair rather than reusing whichever node was clicked first here.
    setPendingLinkSource(null);

    const fd = new FormData();
    fd.set('taskId', targetId);
    fd.set('dependsOnTaskId', sourceId);
    fd.set('type', type);
    const res = await addTaskDependency(ADD_TASK_ACTION_INITIAL, fd);
    if (!res.success) {
      flashError(formatActionError(res.error, 'Could not create this dependency'));
      return;
    }

    const newEdgeId = `temp-${sourceId}-${targetId}`;
    setFlowEdges((eds) => [
      ...eds,
      {
        id: newEdgeId,
        source: sourceId,
        target: targetId,
        type: 'floating',
        data: { linkType: 'series', dependencyType: type },
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
        style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
      },
    ]);

    const manualPositions = new Map(
      tasks
        .filter((t) => t.manualPositionX != null && t.manualPositionY != null)
        .map((t) => [t.id, { x: t.manualPositionX!, y: t.manualPositionY! }])
    );
    const sourceHasManual = manualPositions.has(sourceId);
    const targetHasManual = manualPositions.has(targetId);
    if (sourceHasManual && targetHasManual) return; // nothing eligible to re-arrange

    const allEdgesPlain = [
      ...flowEdges.map((e) => ({ source: e.source, target: e.target, data: e.data })),
      { source: sourceId, target: targetId, data: { linkType: 'series' } },
    ];
    // plannedStartDate must travel with each node here — the new layout
    // orders sections by date, so an incremental re-layout without it would
    // have nothing to sort by (see layoutWithDagre's own group-ordering step).
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const plainNodes: Node[] = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: { plannedStartDate: taskById.get(n.id)?.plannedStartDate ?? null },
      position: n.position,
    }));
    const relaid = layoutWithDagre(plainNodes, allEdgesPlain as Edge[], manualPositions);
    const relaidById = new Map(relaid.nodes.map((n) => [n.id, n.position]));

    setNodes((nds) => nds.map((n) => {
      if (manualPositions.has(n.id)) return n; // manually-positioned nodes never move
      const pos = relaidById.get(n.id);
      return pos ? { ...n, position: pos } : n;
    }));

    flashSaved();
  }

  // Symmetric and non-blocking — unlike completeConnection, adding a
  // parallel link never changes any node's rank (layoutWithDagre excludes
  // 'parallel' edges from dagre's graph entirely — see the comment there
  // on why letting dagre rank them isn't needed and actively crashes it),
  // so there's nothing to re-lay-out here; just show the new dashed line.
  async function completeParallelLink(taskAId: string, taskBId: string) {
    // See completeConnection's comment — activeTool/linkType deliberately
    // untouched here too, for the same rapid-repeat-creation reason.
    setPendingLinkSource(null);

    const res = await createParallelLink(taskAId, taskBId);
    if (!res.success) {
      flashError(formatActionError(res.error, 'Could not create this parallel link'));
      return;
    }

    const newEdgeId = `temp-parallel-${taskAId}-${taskBId}`;
    setFlowEdges((eds) => [
      ...eds,
      {
        id: newEdgeId,
        source: taskAId,
        target: taskBId,
        type: 'floating',
        data: { linkType: 'parallel' },
        style: { stroke: PARALLEL_EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '6 4' },
      },
    ]);

    flashSaved();
  }

  // Dispatches to whichever of the two creation paths the active
  // relationship type needs — Parallel (TaskParallelLink, symmetric, no
  // gating) or one of the four TaskDependency types (series, directional,
  // real status-gating). One function so handleNodeClick's two-click flow
  // doesn't need to know which underlying table a given type maps to.
  async function completeLink(sourceId: string, targetId: string, type: RelationshipType) {
    if (type === 'PARALLEL') {
      await completeParallelLink(sourceId, targetId);
    } else {
      await completeConnection(sourceId, targetId, type);
    }
  }

  // Recomputes the "X of Y prerequisites done" badge for the given task
  // node ids from a live edges snapshot — series (TaskDependency) edges
  // only, matching hasConvergence/allPrereqsDone's existing TaskDependency-
  // only definition on TaskNode. Needed because `tasks` (and therefore each
  // node's baked-in prerequisiteCount) only refreshes on a real navigation;
  // every other local mutation in this file that touches a series edge
  // needs to patch this itself to stay live, the same way handleQuickStatusChange
  // already patches `status` locally after its own server call succeeds.
  // Only FS/SS-type edges count here, matching lib/data/works.ts's server-
  // side computation exactly (see that file's comment) — this badge means
  // "is this task blocked from STARTING by its prerequisites", which is
  // exactly what FS/SS edges gate; FF/SF edges never block starting at all.
  // "Done" per prerequisite reuses isDependencySatisfied — the SAME check
  // updateTaskStatus's real gating logic uses — so this optimistic local
  // patch can never visually disagree with what actually gates the task.
  function updatePrereqBadges(taskNodeIds: string[], edgesSnapshot: Edge[]) {
    if (taskNodeIds.length === 0) return;
    setNodes((nds) => {
      const taskById = new Map(nds.map((n) => [n.id, n.data as unknown as NodeData]));
      return nds.map((n) => {
        if (!taskNodeIds.includes(n.id)) return n;
        const startGating = edgesSnapshot.filter((e) => {
          const depType = (e.data?.dependencyType as DependencyType | undefined) ?? 'FS';
          return e.target === n.id && e.data?.linkType !== 'parallel' && (depType === 'FS' || depType === 'SS');
        });
        const prerequisiteCount = startGating.length;
        const prerequisiteCompletedCount = startGating.filter((e) => {
          const depType = (e.data?.dependencyType as DependencyType | undefined) ?? 'FS';
          const prereqTask = taskById.get(e.source);
          return !!prereqTask && isDependencySatisfied(depType, prereqTask);
        }).length;
        return { ...n, data: { ...n.data, prerequisiteCount, prerequisiteCompletedCount } };
      });
    });
  }

  // Shared by the keyboard delete path, the on-edge delete button, and
  // React Flow's own onEdgesDelete (kept as a thin wrapper below) — one
  // place that actually removes an edge locally and on the server.
  function performEdgeDelete(edgeId: string, category: 'series' | 'parallel') {
    const edge = flowEdgesRef.current.find((e) => e.id === edgeId);
    const nextEdges = flowEdgesRef.current.filter((e) => e.id !== edgeId);
    setFlowEdges(nextEdges);
    if (category === 'series' && edge) {
      updatePrereqBadges([edge.target], nextEdges);
    }
    if (edgeId.startsWith('temp-')) return;
    if (category === 'parallel') {
      removeParallelLink(edgeId).then((res) => {
        if (!res.success) flashError(formatActionError(res.error, 'Failed to remove parallel link'));
      });
    } else {
      removeTaskDependency(edgeId).then((res) => {
        if (!res.success) flashError(formatActionError(res.error, 'Failed to remove dependency'));
      });
    }
  }

  // Parallel links are non-blocking and purely visual — removing one has no
  // workflow consequence, so it deletes immediately. Series links gate a
  // real downstream task's status, so removing one goes through the
  // confirmation dialog below instead of deleting right away.
  function confirmEdgeDelete() {
    if (!edgeDeleteConfirm) return;
    performEdgeDelete(edgeDeleteConfirm.edgeId, 'series');
    setEdgeDeleteConfirm(null);
  }

  // React Flow's own delete-key handling is disabled (deleteKeyCode={[]}) in
  // favor of handleKeyDown below, so this only ever fires from a
  // programmatic deleteElements() call — kept as a thin wrapper over
  // performEdgeDelete so any such call still gets the same confirm-for-
  // series/immediate-for-parallel behavior rather than bypassing it.
  function handleEdgesDelete(deleted: Edge[]) {
    for (const e of deleted) {
      requestEdgeDelete(e.id);
    }
  }

  // Drag-to-reconnect an existing edge's endpoint onto a different task.
  // Validates server-side (cycle check for series, symmetric-duplicate
  // check for parallel — both re-run fresh against the database, same as
  // the create paths) before touching local state, so a rejected reconnect
  // simply never moves the edge in the first place rather than needing an
  // explicit "snap back" animation.
  async function handleReconnect(oldEdge: Edge, newConnection: Connection) {
    if (locked) return;
    if (newConnection.source === newConnection.target) {
      flashError('A task cannot depend on or link in parallel with itself.');
      return;
    }

    const category: 'series' | 'parallel' = oldEdge.data?.linkType === 'parallel' ? 'parallel' : 'series';

    if (category === 'parallel') {
      const res = await reconnectParallelLink(oldEdge.id, newConnection.source, newConnection.target);
      if (!res.success) {
        flashError(formatActionError(res.error, 'Could not reconnect this link'));
        return;
      }
      const nextEdges = reconnectEdge(oldEdge, newConnection, flowEdgesRef.current, { shouldReplaceId: false });
      setFlowEdges(nextEdges);
      flashSaved();
      return;
    }

    // Series: edge.source is the prerequisite (dependsOn), edge.target is
    // the dependent task — same mapping completeConnection already uses.
    const res = await reconnectTaskDependency(oldEdge.id, newConnection.target, newConnection.source);
    if (!res.success) {
      flashError(formatActionError(res.error, 'Could not reconnect this dependency'));
      return;
    }
    const nextEdges = reconnectEdge(oldEdge, newConnection, flowEdgesRef.current, { shouldReplaceId: false });
    setFlowEdges(nextEdges);
    updatePrereqBadges([oldEdge.target, newConnection.target], nextEdges);
    flashSaved();
  }

  // React Flow calls onSelectionChange on internal store updates generally,
  // not only on an actual selection change — including updates caused by
  // this component's own re-renders. Building a brand-new array every call
  // (even an empty one representing "still nothing selected") made every
  // call a real state change as far as React is concerned, which re-rendered
  // this component, which triggered another store update, forever. Guarding
  // on whether the id set actually changed breaks that loop.
  function sameIds(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((id) => setB.has(id));
  }

  function handleSelectionChange({ nodes: sel, edges: selE }: { nodes: Node[]; edges: Edge[] }) {
    const nextNodeIds = sel.filter((n) => n.type === 'task').map((n) => n.id);
    const nextEdgeIds = selE.map((e) => e.id);
    setSelectedNodeIds((prev) => (sameIds(prev, nextNodeIds) ? prev : nextNodeIds));
    setSelectedEdgeIds((prev) => (sameIds(prev, nextEdgeIds) ? prev : nextEdgeIds));
  }

  // Edge deletion (Backspace/Delete with only an edge selected) routes
  // through requestEdgeDelete, which itself decides instant-vs-confirm by
  // link type (parallel: instant, series: confirmation dialog — see
  // performEdgeDelete/requestEdgeDelete above). Deleting a NODE never
  // happens this way — pressing Delete with a node selected opens the
  // confirmation dialog instead of removing anything, since a real
  // HvacTask carries checklist history, activity logs, and potentially
  // other tasks' dependencies.
  function handleKeyDown(event: React.KeyboardEvent) {
    if (locked) return;
    // Escape backs out of the link tool — one of the three ways to return
    // to Select mode (the other two: clicking the active type again in the
    // panel, or clicking the Select tool itself).
    if (event.key === 'Escape' && activeTool === 'link') {
      setActiveTool('select');
      setPendingLinkSource(null);
      return;
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    if (selectedNodeIds.length > 0) {
      event.preventDefault();
      requestDeleteNode(selectedNodeIds[0]);
      return;
    }
    if (selectedEdgeIds.length > 0) {
      event.preventDefault();
      requestEdgeDelete(selectedEdgeIds[0]);
    }
  }

  async function submitCreateForm() {
    if (!createForm) return;
    const trimmedName = createForm.taskName.trim();
    if (trimmedName.length < 3) { setCreateError('Task name must be at least 3 characters'); return; }
    if (!createForm.workId) { setCreateError('Failed to create task — no Work/Trade available'); return; }
    // Same "{category} — {name}" convention splitTaskName reads back on the
    // card — blank category (never typed) just leaves the plain name.
    const trimmedCategory = createForm.category.trim();
    const fullName = trimmedCategory ? `${trimmedCategory} — ${trimmedName}` : trimmedName;

    const res = await createTaskFromCanvas({
      taskName: fullName,
      workId: createForm.workId,
      plannedStartDate: createForm.plannedStartDate || null,
      dueDate: createForm.dueDate || null,
      taskTypeId: null,
      manualPositionX: createForm.position.x,
      manualPositionY: createForm.position.y,
    });
    if (!res.success) {
      setCreateError(formatActionError(res.error, 'Failed to create task'));
      return;
    }
    if (!res.data) { setCreateError('Failed to create task'); return; }

    const work = works.find((w) => w.id === createForm.workId);
    setNodes((nds) => [
      ...nds,
      {
        id: res.data!.id,
        type: 'task',
        position: createForm.position,
        data: {
          id: res.data!.id,
          taskId: res.data!.taskId,
          taskName: res.data!.taskName,
          status: 'draft',
          workId: createForm.workId,
          workCode: work?.code ?? '—',
          workColor: work?.color ?? '#9CA3AF',
          assigneeName: null,
          plannedStartDate: createForm.plannedStartDate ? new Date(createForm.plannedStartDate) : null,
          dueDate: createForm.dueDate ? new Date(createForm.dueDate) : null,
          manualPositionX: createForm.position.x,
          manualPositionY: createForm.position.y,
          prerequisiteCount: 0,
          prerequisiteCompletedCount: 0,
        } as NodeData,
      },
    ]);

    // Don't leave the admin to hunt for what they just created — pan so the
    // new node is actually in view, keeping the current zoom level.
    const zoom = instanceRef.current?.getViewport().zoom ?? 1;
    instanceRef.current?.setCenter(
      createForm.position.x + NODE_WIDTH / 2,
      createForm.position.y + NODE_HEIGHT / 2,
      { zoom, duration: 400 }
    );

    flashSaved();
    setCreateForm(null);
    setActiveTool('select');
  }

  async function submitEditForm() {
    if (!editForm) return;
    const trimmedAction = editForm.taskName.trim();
    if (trimmedAction.length < 3) { setEditError('Task name must be at least 3 characters'); return; }
    // Re-glue the read-only category prefix back on before saving — the
    // input only ever held the action part, matching what the canvas card
    // itself displays split (splitTaskName).
    const fullName = editForm.category ? `${editForm.category} — ${trimmedAction}` : trimmedAction;

    const original = tasks.find((t) => t.id === editForm.nodeId);
    const nameChanged = original && original.taskName !== fullName;
    const descriptionChanged = (original?.description ?? '') !== editForm.description;
    const taskTypeChanged = (original?.taskTypeId ?? '') !== editForm.taskTypeId;
    const originalStart = original?.plannedStartDate ? formatDateKey(original.plannedStartDate, { utc: true }) : '';
    const originalDue = original?.dueDate ? formatDateKey(original.dueDate, { utc: true }) : '';
    const datesChanged = originalStart !== editForm.plannedStartDate || originalDue !== editForm.dueDate;

    if (nameChanged) {
      const res = await updateTaskName(editForm.nodeId, fullName);
      if (!res.success) { setEditError(formatActionError(res.error, 'Failed to update task name')); return; }
    }
    if (descriptionChanged) {
      const res = await updateTaskDescription(editForm.nodeId, editForm.description);
      if (!res.success) { setEditError(formatActionError(res.error, 'Failed to update description')); return; }
    }
    if (taskTypeChanged) {
      const res = await updateTaskType(editForm.nodeId, editForm.taskTypeId || null);
      if (!res.success) { setEditError(formatActionError(res.error, 'Failed to update task type')); return; }
    }
    if (datesChanged) {
      const res = await updateTaskPlannedDates(editForm.nodeId, {
        plannedStartDate: editForm.plannedStartDate || null,
        dueDate: editForm.dueDate || null,
      });
      if (!res.success) { setEditError(formatActionError(res.error, 'Failed to update dates')); return; }
    }

    setNodes((nds) => nds.map((n) => (n.id === editForm.nodeId
      ? {
          ...n,
          data: {
            ...n.data,
            taskName: fullName,
            description: editForm.description || null,
            taskTypeId: editForm.taskTypeId || null,
            plannedStartDate: editForm.plannedStartDate ? new Date(editForm.plannedStartDate) : null,
            dueDate: editForm.dueDate ? new Date(editForm.dueDate) : null,
          },
        }
      : n)));
    flashSaved();
    setEditForm(null);
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const res = await deleteHvacTask(deleteConfirm.nodeId);
    if (!res.success) {
      setDeleteConfirm((prev) => (prev ? { ...prev, error: formatActionError(res.error, 'Failed to delete task') } : prev));
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== deleteConfirm.nodeId));
    setFlowEdges((eds) => eds.filter((e) => e.source !== deleteConfirm.nodeId && e.target !== deleteConfirm.nodeId));
    flashSaved();
    setDeleteConfirm(null);
  }

  async function confirmResetLayout() {
    setResetting(true);
    const res = await resetManualPositions(tasks.map((t) => t.id));
    setResetting(false);
    if (!res.success) {
      flashError(formatActionError(res.error, 'Failed to reset layout'));
      return;
    }

    // Clearing manual positions server-side doesn't, by itself, change
    // anything the already-mounted canvas is showing — revalidatePath only
    // affects the next full page load, not this live client tree. Every
    // other mutation in this file (create/delete/drag/connect) reflects its
    // result locally right away; this re-runs the same dagre layout used
    // for the connect-tool's auto-arrange, with an empty manual-positions
    // map so every node settles into pure auto-layout immediately.
    const allEdgesPlain = flowEdges.map((e) => ({ source: e.source, target: e.target, data: e.data }));
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const plainNodes: Node[] = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: { plannedStartDate: taskById.get(n.id)?.plannedStartDate ?? null },
      position: n.position,
    }));
    const relaid = layoutWithDagre(plainNodes, allEdgesPlain as Edge[], new Map());
    const relaidById = new Map(relaid.nodes.map((n) => [n.id, n.position]));
    setNodes((nds) => nds.map((n) => {
      const pos = relaidById.get(n.id);
      return pos ? { ...n, position: pos } : n;
    }));

    flashSaved();
    setResetConfirmOpen(false);
  }

  const isCompleted = deleteConfirm?.impact?.status === 'completed';

  if (tasks.length === 0 && !emptyState) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center h-full">
        <p className="text-[13px] font-semibold text-gray-300">No tasks to show</p>
      </div>
    );
  }

  const canvas = darkCanvas ? CANVAS_THEMES.dark : CANVAS_THEMES.light;

  const TOOL_BUTTON_BASE = 'w-9 h-9 flex items-center justify-center rounded-lg transition-colors';

  // The same five-option panel serves two purposes: while the Link tool is
  // active it picks the type the next two-click creation will use; while
  // exactly one edge is selected (and the Link tool ISN'T active — creating
  // takes priority if both are somehow true at once) it instead shows and
  // lets you change THAT edge's current type in place. One shared component
  // instead of a separate "create" picker and "edit" picker, per the spec.
  const singleSelectedEdge = activeTool !== 'link' && selectedEdgeIds.length === 1 && !locked
    ? flowEdges.find((e) => e.id === selectedEdgeIds[0])
    : undefined;
  const editingEdgeType: RelationshipType | undefined = singleSelectedEdge
    ? (singleSelectedEdge.data?.linkType === 'parallel' ? 'PARALLEL' : ((singleSelectedEdge.data?.dependencyType as DependencyType | undefined) ?? 'FS'))
    : undefined;
  const relationshipPanelMode: 'create' | 'edit' | null =
    activeTool === 'link' ? 'create' : (singleSelectedEdge ? 'edit' : null);

  return (
    <div className="relative h-full w-full rounded-xl border border-border overflow-hidden" onKeyDownCapture={handleKeyDown}>
      {banner && (
        <div
          className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 rounded-lg text-[12.5px] font-medium shadow-md flex items-center gap-2 ${
            banner.type === 'error' ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-gray-900 text-white'
          }`}
        >
          {banner.text}
          {banner.type === 'error' && (
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">✕</button>
          )}
        </div>
      )}

      {activeTool === 'link' && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-[11.5px] font-medium shadow-md"
          style={{ background: linkType === 'PARALLEL' ? PARALLEL_SOURCE_COLOR : CONNECT_SOURCE_COLOR }}
        >
          <span className="font-semibold">{RELATIONSHIP_LABELS[linkType]}</span>
          <span className="opacity-90">
            {pendingLinkSource
              ? (linkType === 'PARALLEL' ? 'Click the second task…' : 'Click the dependent task…')
              : (linkType === 'PARALLEL' ? 'Click the first task…' : 'Click the prerequisite task…')}
          </span>
        </div>
      )}

      {/* ── Part 1: left Miro-style toolbar ── */}
      <TooltipProvider>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 bg-white border border-gray-200 rounded-xl shadow-md p-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => { setActiveTool('select'); setPendingLinkSource(null); }}
                className={`${TOOL_BUTTON_BASE} ${activeTool === 'select' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l7.07 17 2.51-7.39L21 11.07Z"/></svg>
              </button>
            }
          />
          <TooltipContent side="right">Select</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={locked}
                onClick={handleAddTaskClick}
                className={`${TOOL_BUTTON_BASE} ${activeTool === 'add' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              </button>
            }
          />
          <TooltipContent side="right">Add task</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={locked}
                onClick={() => { setActiveTool('link'); setPendingLinkSource(null); }}
                className={`${TOOL_BUTTON_BASE} ${activeTool === 'link' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              </button>
            }
          />
          <TooltipContent side="right">Link — Parallel / FS / SS / FF / SF</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => setGroupByTrade((v) => !v)}
                className={`${TOOL_BUTTON_BASE} ${groupByTrade ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
            }
          />
          <TooltipContent side="right">Group by trade</TooltipContent>
        </Tooltip>
        <div className="h-px bg-gray-200 my-0.5" />
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => { setLocked((v) => !v); setActiveTool('select'); setPendingLinkSource(null); }}
                className={`${TOOL_BUTTON_BASE} ${locked ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {locked ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                )}
              </button>
            }
          />
          <TooltipContent side="right">{locked ? 'Unlock canvas' : 'Lock canvas (view only)'}</TooltipContent>
        </Tooltip>
      </div>
      </TooltipProvider>

      {relationshipPanelMode && (
        <RelationshipPanel
          mode={relationshipPanelMode}
          activeType={relationshipPanelMode === 'create' ? linkType : editingEdgeType!}
          locked={locked}
          onSelect={(type) => {
            if (relationshipPanelMode === 'create') {
              if (type === linkType) {
                // Clicking the already-active type again is one of the
                // three ways to deactivate (see the panel's own footer
                // hint) — the other two are Escape and the Select tool.
                setActiveTool('select');
                setPendingLinkSource(null);
                return;
              }
              setLinkType(type);
              return;
            }
            if (singleSelectedEdge) requestEdgeTypeChange(singleSelectedEdge.id, type);
          }}
        />
      )}

      {/* ── Top-right utilities: reset layout + board theme (not part of the tool set, kept accessible) ── */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => instanceRef.current?.fitView({ padding: 0.2, duration: 300 })}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium shadow-sm transition-colors"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
          title="Re-center the view on every currently-visible task"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          Center
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => setResetConfirmOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
          Reset Layout
        </button>
        <button
          onClick={() => setDarkCanvas((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium shadow-sm transition-colors"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
          title={darkCanvas ? 'Switch to light board' : 'Switch to dark board'}
        >
          {darkCanvas ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center h-full">
          <p className="text-[13px] font-semibold text-gray-300">No tasks found</p>
          {emptyState?.hasFilter && (
            <button onClick={emptyState.onClear} className="mt-3 text-[12px] font-semibold text-gray-400 hover:text-gray-900 underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="h-full w-full" onDoubleClick={handlePaneDoubleClick}>
          {/* ── Relationship-type legend — one row per type, same swatches
              and descriptions the create/edit panel uses ── */}
          <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1.5 bg-white border border-gray-200 rounded-lg shadow-md px-2.5 py-2 text-[10.5px] text-gray-600 max-w-[210px]">
            {RELATIONSHIP_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-1.5">
                <RelationshipSwatch type={type} />
                <span>
                  <span className="font-semibold text-gray-700">{type === 'PARALLEL' ? 'Parallel' : type}</span>
                  {' — '}
                  {RELATIONSHIP_DESCRIPTIONS[type]}
                </span>
              </div>
            ))}
            <div className="pt-0.5 mt-0.5 border-t border-gray-100 text-[9.5px] text-gray-400 leading-snug">
              Select a link to change its type from the same panel used to create it.
            </div>
          </div>
          <GraphActionsContext.Provider value={graphActionsValue}>
          <ReactFlow
            nodes={nodesForFlow}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeMouseEnter={handleNodeMouseEnter}
            onNodeMouseLeave={handleNodeMouseLeave}
            onNodeDragStop={handleNodeDragStop}
            onEdgesDelete={handleEdgesDelete}
            onReconnect={handleReconnect}
            onSelectionChange={handleSelectionChange}
            onInit={(instance) => { instanceRef.current = instance; onReady?.(instance); }}
            deleteKeyCode={[]}
            nodesDraggable={activeTool === 'select' && !locked}
            nodesConnectable={false}
            edgesReconnectable={!locked}
            elementsSelectable={!locked}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ backgroundColor: canvas.bg, cursor: activeTool === 'link' ? 'crosshair' : undefined }}
          >
            {/* Miro-style square grid instead of the default dot pattern —
                a faint 20px minor grid plus a slightly more visible 100px
                major grid every 5 squares, same as Miro's own two-tier
                canvas grid. */}
            <Background variant={BackgroundVariant.Lines} color={canvas.grid} gap={20} lineWidth={1} />
            <Background variant={BackgroundVariant.Lines} color={canvas.gridMajor} gap={100} lineWidth={1} />
            <Controls showInteractive={false} className="pmc-flow-controls" />
            <MiniMap
              className="pmc-flow-minimap"
              pannable
              zoomable
              style={{ width: 130, height: 90 }}
              nodeColor={() => FORCED_GRAY.dot}
            />
          </ReactFlow>
          </GraphActionsContext.Provider>
        </div>
      )}

      {/* ── Create task ── */}
      <Dialog open={!!createForm} onOpenChange={(open) => { if (!open) { setCreateForm(null); setActiveTool('select'); } }}>
        <DialogContent container={fullscreenContainer}>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Creates a real task with the standard dependency checklist — this isn&apos;t a draft.</DialogDescription>
          </DialogHeader>
          {createError && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{createError}</div>}
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="canvas_task_category">Category <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="canvas_task_category"
                value={createForm?.category ?? ''}
                onChange={(e) => setCreateForm((f) => (f ? { ...f, category: e.target.value } : f))}
                placeholder="e.g. Internal retaining walls @ 2'-6&quot;& 4'-6&quot; levels"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="canvas_task_name">Task Name</Label>
              <Input
                id="canvas_task_name"
                value={createForm?.taskName ?? ''}
                onChange={(e) => setCreateForm((f) => (f ? { ...f, taskName: e.target.value } : f))}
                placeholder="e.g. Form work fixing"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Planned Start <span className="text-muted-foreground">(optional)</span></Label>
                <WorkingDayPicker
                  name="canvas_planned_start"
                  defaultValue={createForm?.plannedStartDate || undefined}
                  onDateChange={(d) => setCreateForm((f) => (f ? { ...f, plannedStartDate: d ? formatDateKey(d) : '' } : f))}
                  container={fullscreenContainer}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Planned End <span className="text-muted-foreground">(optional)</span></Label>
                <WorkingDayPicker
                  name="canvas_due_date"
                  defaultValue={createForm?.dueDate || undefined}
                  onDateChange={(d) => setCreateForm((f) => (f ? { ...f, dueDate: d ? formatDateKey(d) : '' } : f))}
                  container={fullscreenContainer}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="button" onClick={submitCreateForm}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Quick edit (rename) ── */}
      <Dialog open={!!editForm} onOpenChange={(open) => { if (!open) setEditForm(null); }}>
        <DialogContent container={fullscreenContainer}>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Quick edit — for checklist, status, or comments, open the full task page.</DialogDescription>
          </DialogHeader>
          {editError && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{editError}</div>}
          <div className="space-y-3 mt-2">
            {editForm?.category && (
              <div className="space-y-1">
                <Label className="text-muted-foreground">Category</Label>
                <p className="text-[12.5px] text-muted-foreground leading-snug">{editForm.category}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Planned Start</Label>
                <WorkingDayPicker
                  name="canvas_edit_planned_start"
                  defaultValue={editForm?.plannedStartDate || undefined}
                  onDateChange={(d) => setEditForm((f) => (f ? { ...f, plannedStartDate: d ? formatDateKey(d) : '' } : f))}
                  container={fullscreenContainer}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Planned End</Label>
                <WorkingDayPicker
                  name="canvas_edit_due_date"
                  defaultValue={editForm?.dueDate || undefined}
                  // Also fed as `value` (not just defaultValue) so the
                  // Duration-days auto-suggestion above can re-sync this
                  // picker's displayed date after the dialog's already
                  // mounted — see the useEffect computing editForm.dueDate
                  // from durationDays/plannedStartDate. Still fully
                  // overridable by picking a date directly afterward.
                  value={editForm?.dueDate || undefined}
                  onDateChange={(d) => setEditForm((f) => (f ? { ...f, dueDate: d ? formatDateKey(d) : '' } : f))}
                  container={fullscreenContainer}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="canvas_edit_name">Task Name</Label>
              <Input
                id="canvas_edit_name"
                value={editForm?.taskName ?? ''}
                onChange={(e) => setEditForm((f) => (f ? { ...f, taskName: e.target.value } : f))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="canvas_edit_description">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="canvas_edit_description"
                value={editForm?.description ?? ''}
                onChange={(e) => setEditForm((f) => (f ? { ...f, description: e.target.value } : f))}
                placeholder="Describe the scope of work…"
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="canvas_edit_task_type">
                  Task Type <span className="text-muted-foreground">(optional)</span>
                </Label>
                <select
                  id="canvas_edit_task_type"
                  value={editForm?.taskTypeId ?? ''}
                  onChange={(e) => {
                    const taskTypeId = e.target.value;
                    const type = taskTypes.find((t) => t.id === taskTypeId);
                    setEditForm((f) => (f ? {
                      ...f,
                      taskTypeId,
                      durationDays: type ? String(type.defaultDurationDays) : f.durationDays,
                    } : f));
                  }}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">No type</option>
                  {taskTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.defaultDurationDays} working days</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="canvas_edit_duration">
                  Duration (days) <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="canvas_edit_duration"
                  type="number"
                  min="1"
                  step="1"
                  value={editForm?.durationDays ?? ''}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, durationDays: e.target.value } : f))}
                  placeholder="e.g. 5"
                />
                <p className="text-[11px] text-muted-foreground">
                  Recomputes Planned End from Planned Start — still overridable above.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="button" onClick={submitEditForm}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation — deliberately not casual ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent container={fullscreenContainer}>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>This permanently removes the task and its checklist/activity history.</DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-[13px] font-semibold">{deleteConfirm?.taskName}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{deleteConfirm?.humanTaskId}</p>
            </div>

            {deleteConfirm?.loading && (
              <p className="text-[12px] text-muted-foreground">Checking dependencies…</p>
            )}

            {isCompleted && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
                Completed tasks cannot be deleted.
              </div>
            )}

            {!isCompleted && deleteConfirm?.impact && deleteConfirm.impact.dependentCount > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
                {deleteConfirm.impact.dependentCount} task{deleteConfirm.impact.dependentCount === 1 ? '' : 's'} depend{deleteConfirm.impact.dependentCount === 1 ? 's' : ''} on this — their dependency links will be removed too.
              </div>
            )}

            {deleteConfirm?.error && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{deleteConfirm.error}</div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={isCompleted || deleteConfirm?.loading}
            >
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove dependency confirmation — series edges only; parallel
          links delete immediately with no dialog (see requestEdgeDelete) ── */}
      <Dialog open={!!edgeDeleteConfirm} onOpenChange={(open) => { if (!open) setEdgeDeleteConfirm(null); }}>
        <DialogContent container={fullscreenContainer}>
          <DialogHeader>
            <DialogTitle>Remove Dependency?</DialogTitle>
            <DialogDescription>
              This removes the blocking relationship between these two tasks — the downstream task may become unblocked as a result.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="button" variant="destructive" onClick={confirmEdgeDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset layout confirmation ── */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent container={fullscreenContainer}>
          <DialogHeader>
            <DialogTitle>Reset Layout</DialogTitle>
            <DialogDescription>
              Clears every manually-arranged position for the {tasks.length} task{tasks.length === 1 ? '' : 's'} currently shown, reverting them to automatic layout. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="button" variant="destructive" onClick={confirmResetLayout} disabled={resetting}>
              {resetting ? 'Resetting…' : 'Reset Layout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .pmc-flow-controls button {
          border-radius: 8px;
          border-color: var(--border);
          background: var(--card);
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .pmc-flow-controls button:hover { background: var(--muted); }
        .pmc-flow-minimap {
          opacity: 0.88;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}
