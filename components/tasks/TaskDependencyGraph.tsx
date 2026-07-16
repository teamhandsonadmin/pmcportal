'use client';

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
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
  updateTaskPlannedDates,
  updateTaskStatus,
  deleteHvacTask,
  getTaskDeleteImpact,
  resetManualPositions,
  type TaskDeleteImpact,
} from '@/app/actions/hvac-tasks';
import { addTaskDependency, removeTaskDependency, reconnectTaskDependency, updateDependencyType } from '@/app/actions/task-dependencies';
import { createParallelLink, removeParallelLink, reconnectParallelLink } from '@/app/actions/task-parallel-links';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
// Deliberately a different hue family (green), not a shade of the series
// edges' blue/orange/indigo — dashed, no arrowhead (symmetric/non-
// directional, so an arrow would wrongly imply an order).
const PARALLEL_EDGE_COLOR = '#16A34A';
const PARALLEL_SOURCE_COLOR = '#15803D';

const CANVAS_THEMES = {
  light: { bg: '#ffffff', dot: '#d4d4d8' },
  dark: { bg: '#0a0a0a', dot: '#52525b' },
} as const;

export interface GraphTask {
  id: string;
  taskId: string;
  taskName: string;
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

type ActiveTool = 'select' | 'add' | 'connect' | 'parallel';

interface NodeCallbacks {
  onDeleteRequest: (nodeId: string) => void;
  onConnectFromNode: (nodeId: string) => void;
}

type NodeData = GraphTask & NodeCallbacks & Record<string, unknown>;

const NODE_WIDTH = 208;
const NODE_HEIGHT = 92;

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
  onDependencyTypeChange: (edgeId: string, type: DependencyType) => void;
  locked: boolean;
  pendingConnectSource: string | null;
  pendingParallelSource: string | null;
  hoveredNodeId: string | null;
}
const GraphActionsContext = createContext<GraphActions>({
  onDuplicate: () => {},
  onQuickStatusChange: () => {},
  onRenameRequest: () => {},
  onOpenTask: () => {},
  onEdgeDeleteRequest: () => {},
  onDependencyTypeChange: () => {},
  locked: false,
  pendingConnectSource: null,
  pendingParallelSource: null,
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
  const isPendingConnectSource = actions.pendingConnectSource === id;
  const isPendingParallelSource = actions.pendingParallelSource === id;
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
        borderColor: isPendingConnectSource
          ? CONNECT_SOURCE_COLOR
          : isPendingParallelSource
          ? PARALLEL_SOURCE_COLOR
          : selected
          ? MANUAL_EDGE_COLOR
          : cfg.border,
        borderWidth: isPendingConnectSource || isPendingParallelSource || selected ? 2 : 1,
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
          <button type="button" onClick={() => data.onConnectFromNode(id)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="Connect">
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

      {(() => {
        const { category, action } = splitTaskName(data.taskName);
        return (
          <>
            {category && (
              <p className="text-[9.5px] text-muted-foreground leading-tight line-clamp-1">{category}</p>
            )}
            <p className="text-[12px] font-semibold text-foreground leading-tight line-clamp-2">{action}</p>
          </>
        );
      })()}
      <span className="text-[10px] text-muted-foreground">{data.workCode}</span>
      <span className="font-mono text-[10px] font-bold truncate" style={{ color: cfg.text }}>{data.taskId}</span>

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

const nodeTypes = { task: TaskNode, groupFrame: GroupFrameNode };

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
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX: sPos.x + sw / 2,
      sourceY: sPos.y + sh,
      sourcePosition: Position.Bottom,
      targetX: tPos.x + tw / 2,
      targetY: tPos.y,
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
            glance without opening a details panel. Text-only distinction
            (not a new color) per the canvas already using color for status/
            parallel-vs-series — doubles as the edit control when selected:
            a real <select> either way, just styled to read as a flat badge
            when not selected and as an obvious dropdown when it is. */}
        {!isParallel && (
          <select
            value={dependencyType}
            disabled={!selected || actions.locked}
            onChange={(e) => { e.stopPropagation(); actions.onDependencyTypeChange(id, e.target.value as DependencyType); }}
            onClick={(e) => e.stopPropagation()}
            className={
              'nodrag nopan absolute text-center text-[9.5px] font-bold rounded px-1 py-0.5 shadow-sm outline-none ' +
              (selected && !actions.locked
                ? 'bg-white border border-gray-300 text-gray-700 cursor-pointer'
                : 'bg-white/90 border border-gray-200 text-gray-500 appearance-none cursor-default')
            }
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            title={`${DEPENDENCY_TYPE_LABELS[dependencyType]}${selected ? ' — change type' : ''}`}
          >
            {DEPENDENCY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
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

// Manually-positioned nodes that end up merely close to (not exactly at)
// the same X as whatever they're connected to render as a slightly-off
// diagonal instead of the clean straight vertical line they're clearly
// meant to be — this snaps the free (non-manual) side into exact alignment
// when it's within this tolerance, so it reads as intentional rather than
// a near-miss. Never moves a node the admin manually positioned themselves.
const AUTO_ALIGN_TOLERANCE_PX = 24;

function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
  manualPositions: Map<string, { x: number; y: number }>,
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph(
    direction === 'LR'
      ? { rankdir: 'LR', nodesep: 70, ranksep: 130 }
      : { rankdir: 'TB', nodesep: 56, ranksep: 90 }
  );
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  // Parallel links are a symmetric, non-blocking visual grouping — there's
  // no real "before/after" between two tasks that just run alongside each
  // other, so only series (TaskDependency) edges participate in dagre's
  // rank computation. A parallel link still renders (via positionedEdges
  // below) as a floating line between wherever its two nodes land.
  //
  // (Tried feeding parallel edges into dagre too, with minlen: 0, so
  // same-date pairs would be forced onto the same rank — that crashes
  // dagre's layout step outright, a real bug in this version's ranking
  // internals with zero-length edges, not just a bad look. Turned out
  // unnecessary anyway: two equal-length independent chains linked 1:1 by
  // index already land on matching ranks purely from each chain's own
  // length, and dagre's node-insertion-order tie-break keeps each chain on
  // its own consistent side within that rank — verified against the actual
  // Seq civil_2 shape (two 59-node FS chains) before relying on it.)
  edges.filter((e) => e.data?.linkType !== 'parallel').forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const autoNodePositions = new Map<string, { x: number; y: number }>();
  nodes.forEach((n) => {
    if (manualPositions.has(n.id)) return;
    const pos = g.node(n.id);
    autoNodePositions.set(n.id, { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 });
  });

  // Snap a free (auto-laid-out) node into exact X alignment with a
  // manually-positioned neighbor it's already nearly aligned with.
  // The "straight line" axis flips with orientation: in TB, two nodes in a
  // straight vertical FS chain share an X; in LR, they share a Y instead
  // (X is now the rank/date axis, not the side-to-side one).
  const snapAxis = direction === 'LR' ? 'y' : 'x';
  for (const e of edges) {
    const sourceManual = manualPositions.get(e.source);
    const targetManual = manualPositions.get(e.target);
    if (!!sourceManual === !!targetManual) continue; // need exactly one manual side
    const manual = sourceManual ?? targetManual!;
    const freeId = sourceManual ? e.target : e.source;
    const free = autoNodePositions.get(freeId);
    if (!free) continue;
    const delta = Math.abs(free[snapAxis] - manual[snapAxis]);
    if (delta > 0 && delta <= AUTO_ALIGN_TOLERANCE_PX) {
      autoNodePositions.set(freeId, { ...free, [snapAxis]: manual[snapAxis] });
    }
  }

  const positionedNodes = nodes.map((n) => {
    const manual = manualPositions.get(n.id);
    if (manual) return { ...n, position: manual };
    return { ...n, position: autoNodePositions.get(n.id) ?? { x: 0, y: 0 } };
  });

  const positionById = new Map(positionedNodes.map((n) => [n.id, n.position]));
  // A manually-arranged grid (e.g. one row per work section, wrapping back
  // to the left edge for the next row) puts most series edges within a row
  // at zero vertical delta, but the edge from a row's last task to the next
  // row's first task jumps both axes at once — a straight line for that one
  // reads as a stray diagonal slash across the canvas instead of a flowchart
  // connector. Flagging it here (not just recomputing the threshold inside
  // FloatingEdge on every render) also means only genuine row-wraps pay for
  // the elbow route; ordinary same-row and dagre-auto-laid edges (delta 0,
  // or a small delta from AUTO_ALIGN_TOLERANCE_PX snapping) keep the
  // straight line they already read fine with.
  const BIG_VERTICAL_JUMP_THRESHOLD = NODE_HEIGHT * 1.5;

  const positionedEdges = edges.map((e) => {
    // Parallel links keep their own dashed/no-arrow styling regardless of
    // whether either endpoint has been manually dragged — the manual-edge
    // recolor below is a series-only concern (it's what signals "this
    // dependency touches a manually-positioned node").
    if (e.data?.linkType === 'parallel') return { ...e, type: 'floating' };

    const sourcePos = positionById.get(e.source);
    const targetPos = positionById.get(e.target);
    const bigVerticalJump = !!sourcePos && !!targetPos
      && Math.abs(sourcePos.y - targetPos.y) > BIG_VERTICAL_JUMP_THRESHOLD;
    const data = { ...e.data, bigVerticalJump };

    if (manualPositions.has(e.source) || manualPositions.has(e.target)) {
      return {
        ...e,
        type: 'floating',
        data,
        style: { stroke: MANUAL_EDGE_COLOR, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: MANUAL_EDGE_COLOR },
      };
    }
    return { ...e, type: 'floating', data };
  });

  return { nodes: positionedNodes, edges: positionedEdges };
}

interface CreateFormState {
  position: { x: number; y: number };
  taskName: string;
  workId: string;
  taskTypeId: string;
  plannedStartDate: string;
  dueDate: string;
}

interface EditFormState {
  nodeId: string;
  taskName: string;
  plannedStartDate: string;
  dueDate: string;
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
  tasks, edges, parallelEdges, works, taskTypes, isFullscreen, onReady, emptyState, fullscreenContainer,
}: TaskDependencyGraphProps) {
  const router = useRouter();
  const [darkCanvas, setDarkCanvas] = useState(false);
  // Horizontal (LR) reads as a left-to-right schedule flow — parallel-linked
  // pairs on the same rank sit stacked directly on top of each other, dates
  // progress left to right. Vertical (TB) is the old default. Defaults to
  // horizontal since that's the layout that actually keeps same-date
  // parallel pairs visually aligned side by side (see layoutWithDagre).
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('LR');
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [groupByTrade, setGroupByTrade] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pendingConnectSource, setPendingConnectSource] = useState<string | null>(null);
  // Persistent selector attached to the Connect tool itself, rather than a
  // popup shown after both nodes are picked — whatever it's set to when the
  // SECOND node is clicked is the type of edge created. Defaults to FS, so
  // an admin who never touches it gets the exact same two-click, FS-only
  // flow that existed before this feature.
  const [pendingConnectType, setPendingConnectType] = useState<DependencyType>('FS');
  const [pendingParallelSource, setPendingParallelSource] = useState<string | null>(null);
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
    setEditForm({
      nodeId: task.id,
      taskName: task.taskName,
      plannedStartDate: task.plannedStartDate ? formatDateKey(task.plannedStartDate, { utc: true }) : '',
      dueDate: task.dueDate ? formatDateKey(task.dueDate, { utc: true }) : '',
    });
    setEditError(null);
  }, [tasks]);

  const handleConnectFromNode = useCallback((nodeId: string) => {
    setActiveTool('connect');
    setPendingConnectSource(nodeId);
  }, []);

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
        style: { stroke: EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '5 4' },
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

    return layoutWithDagre(rawNodes, [...rawEdges, ...rawParallelEdges], manualPositions, layoutDirection);
  }, [tasks, edges, parallelEdges, requestDeleteNode, handleConnectFromNode, layoutDirection]);

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

  // Read by every TaskNode via GraphActionsContext instead of via `data` —
  // memoized so a position-only change to `nodes` (a drag frame) does NOT
  // give this a new reference, which would otherwise re-render every node
  // through context the same way the old per-node `data` remap did.
  // Stable regardless of anything else re-rendering — navigation only ever
  // happens through this explicit action now, never as a side effect of
  // selecting a node.
  const handleOpenTask = useCallback((nodeId: string) => {
    const url = `/hvac/${nodeId}`;
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

  // Optimistic — flips the badge/select immediately, reverts on a failed
  // server call (e.g. the row got deleted from under it). No cycle-check or
  // reconnect-style validation needed: changing a type doesn't touch graph
  // topology, only which status-gating rule applies to this edge.
  const requestDependencyTypeChange = useCallback((edgeId: string, type: DependencyType) => {
    const previous = flowEdgesRef.current;
    setFlowEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, dependencyType: type } } : e)));
    if (edgeId.startsWith('temp-')) return;
    updateDependencyType(edgeId, type).then((res) => {
      if (!res.success) {
        flashError(formatActionError(res.error, 'Failed to update dependency type'));
        setFlowEdges(previous);
      }
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
      onDependencyTypeChange: requestDependencyTypeChange,
      locked,
      pendingConnectSource,
      pendingParallelSource,
      hoveredNodeId,
    }),
    [handleDuplicate, handleQuickStatusChange, openEditForm, handleOpenTask, requestEdgeDelete, requestDependencyTypeChange, locked, pendingConnectSource, pendingParallelSource, hoveredNodeId]
  );

  const nodesForFlow = useMemo(
    () => (groupByTrade ? [...groupFrameNodes, ...nodes] : nodes),
    [groupByTrade, groupFrameNodes, nodes]
  );

  // Selects only — the floating toolbar (hover- or selection-driven, see
  // TaskNode) is now the only way to act on a node, including navigating to
  // its detail page (via the toolbar's explicit "Open task" button). A plain
  // click used to navigate immediately, which meant the toolbar could never
  // actually be seen/used before the page changed out from under it.
  function handleNodeClick(_: unknown, node: Node) {
    if (node.type !== 'task') return;
    if (activeTool === 'connect' && !locked) {
      if (!pendingConnectSource) {
        setPendingConnectSource(node.id);
        return;
      }
      if (pendingConnectSource === node.id) {
        setPendingConnectSource(null); // clicked the same node again — cancel
        return;
      }
      void completeConnection(pendingConnectSource, node.id, pendingConnectType);
      return;
    }
    if (activeTool === 'parallel' && !locked) {
      if (!pendingParallelSource) {
        setPendingParallelSource(node.id);
        return;
      }
      if (pendingParallelSource === node.id) {
        setPendingParallelSource(null); // clicked the same node again — cancel
        return;
      }
      void completeParallelLink(pendingParallelSource, node.id);
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
      taskName: '',
      workId: works[0]?.id ?? '',
      taskTypeId: '',
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
    setPendingConnectSource(null);
    setActiveTool('select');

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
        markerEnd: { type: MarkerType.ArrowClosed, color: MANUAL_EDGE_COLOR },
        style: { stroke: MANUAL_EDGE_COLOR, strokeWidth: 1.5 },
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
    const plainNodes: Node[] = nodes.map((n) => ({ id: n.id, type: n.type, data: {}, position: n.position }));
    const relaid = layoutWithDagre(plainNodes, allEdgesPlain as Edge[], manualPositions, layoutDirection);
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
    setPendingParallelSource(null);
    setActiveTool('select');

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
  function performEdgeDelete(edgeId: string, linkType: 'series' | 'parallel') {
    const edge = flowEdgesRef.current.find((e) => e.id === edgeId);
    const nextEdges = flowEdgesRef.current.filter((e) => e.id !== edgeId);
    setFlowEdges(nextEdges);
    if (linkType === 'series' && edge) {
      updatePrereqBadges([edge.target], nextEdges);
    }
    if (edgeId.startsWith('temp-')) return;
    if (linkType === 'parallel') {
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

    const linkType: 'series' | 'parallel' = oldEdge.data?.linkType === 'parallel' ? 'parallel' : 'series';

    if (linkType === 'parallel') {
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
    const trimmed = createForm.taskName.trim();
    if (trimmed.length < 3) { setCreateError('Task name must be at least 3 characters'); return; }
    if (!createForm.workId) { setCreateError('Work/trade is required'); return; }

    const res = await createTaskFromCanvas({
      taskName: trimmed,
      workId: createForm.workId,
      plannedStartDate: createForm.plannedStartDate || null,
      dueDate: createForm.dueDate || null,
      taskTypeId: createForm.taskTypeId || null,
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
    const trimmed = editForm.taskName.trim();
    if (trimmed.length < 3) { setEditError('Task name must be at least 3 characters'); return; }

    const original = tasks.find((t) => t.id === editForm.nodeId);
    const nameChanged = original && original.taskName !== trimmed;
    const originalStart = original?.plannedStartDate ? formatDateKey(original.plannedStartDate, { utc: true }) : '';
    const originalDue = original?.dueDate ? formatDateKey(original.dueDate, { utc: true }) : '';
    const datesChanged = originalStart !== editForm.plannedStartDate || originalDue !== editForm.dueDate;

    if (nameChanged) {
      const res = await updateTaskName(editForm.nodeId, trimmed);
      if (!res.success) { setEditError(formatActionError(res.error, 'Failed to update task name')); return; }
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
            taskName: trimmed,
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
    const plainNodes: Node[] = nodes.map((n) => ({ id: n.id, type: n.type, data: {}, position: n.position }));
    const relaid = layoutWithDagre(plainNodes, allEdgesPlain as Edge[], new Map(), layoutDirection);
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

      {activeTool === 'connect' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11.5px] font-medium shadow-md">
          <span>{pendingConnectSource ? 'Click the target task…' : 'Click the source task…'}</span>
          <div className="h-4 w-px bg-white/30" />
          <label className="flex items-center gap-1.5 text-[11px] font-normal text-white/90">
            Type
            <select
              value={pendingConnectType}
              onChange={(e) => setPendingConnectType(e.target.value as DependencyType)}
              className="bg-blue-700 border border-white/30 rounded px-1.5 py-0.5 text-white text-[11px] font-semibold outline-none cursor-pointer"
              title="The dependency type the next created link will use"
            >
              {DEPENDENCY_TYPES.map((t) => (
                <option key={t} value={t}>{t} — {DEPENDENCY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {activeTool === 'parallel' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg shadow-md text-white text-[11.5px] font-medium" style={{ background: PARALLEL_SOURCE_COLOR }}>
          {pendingParallelSource ? 'Click the second task…' : 'Click the first task…'}
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
                onClick={() => { setActiveTool('select'); setPendingConnectSource(null); setPendingParallelSource(null); }}
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
                onClick={() => { setActiveTool('connect'); setPendingConnectSource(null); setPendingParallelSource(null); }}
                className={`${TOOL_BUTTON_BASE} ${activeTool === 'connect' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="19 11 19 5 13 5"/></svg>
              </button>
            }
          />
          <TooltipContent side="right">Connect — series (blocking)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={locked}
                onClick={() => { setActiveTool('parallel'); setPendingParallelSource(null); }}
                className={`${TOOL_BUTTON_BASE} ${activeTool === 'parallel' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="17" x2="19" y2="17"/></svg>
              </button>
            }
          />
          <TooltipContent side="right">Parallel — non-blocking link</TooltipContent>
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
                onClick={() => { setLocked((v) => !v); setActiveTool('select'); setPendingConnectSource(null); setPendingParallelSource(null); }}
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

      {/* ── Top-right utilities: reset layout + board theme (not part of the tool set, kept accessible) ── */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setLayoutDirection((d) => (d === 'LR' ? 'TB' : 'LR'));
            // Bounding box changes drastically switching axes — same
            // rAF + settle-timeout fitView pattern used for project
            // switches (one frame isn't always enough for every node in a
            // large graph to be re-measured before fitView reads sizes).
            requestAnimationFrame(() => instanceRef.current?.fitView({ padding: 0.2, duration: 300 }));
            setTimeout(() => instanceRef.current?.fitView({ padding: 0.2, duration: 300 }), 300);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium shadow-sm transition-colors"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
          title={layoutDirection === 'LR' ? 'Switch to vertical layout' : 'Switch to horizontal layout'}
        >
          {layoutDirection === 'LR' ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="6" height="18" rx="1.5"/><rect x="14" y="3" width="6" height="18" rx="1.5"/></svg>
          )}
          {layoutDirection === 'LR' ? 'Horizontal' : 'Vertical'}
        </button>
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
          {/* ── Edge-type legend — small, one line per style ── */}
          <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1.5 bg-white border border-gray-200 rounded-lg shadow-md px-2.5 py-2 text-[10.5px] text-gray-600">
            <div className="flex items-center gap-1.5">
              <svg width="20" height="8" viewBox="0 0 20 8"><line x1="0" y1="4" x2="20" y2="4" stroke={EDGE_COLOR} strokeWidth="2" strokeDasharray="4 3" /></svg>
              Series — blocking
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="8" viewBox="0 0 20 8"><line x1="0" y1="4" x2="20" y2="4" stroke={PARALLEL_EDGE_COLOR} strokeWidth="2" strokeDasharray="5 3" /></svg>
              Parallel — non-blocking
            </div>
            <div className="pt-0.5 mt-0.5 border-t border-gray-100 text-[9.5px] text-gray-400 leading-snug max-w-[175px]">
              Each series link&apos;s badge is its type — FS Finish-to-Start, SS Start-to-Start, FF Finish-to-Finish, SF Start-to-Finish. Select a link to change it.
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
            style={{ backgroundColor: canvas.bg, cursor: activeTool === 'connect' ? 'crosshair' : undefined }}
          >
            <Background color={canvas.dot} />
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
              <Label htmlFor="canvas_task_name">Task Name</Label>
              <Input
                id="canvas_task_name"
                value={createForm?.taskName ?? ''}
                onChange={(e) => setCreateForm((f) => (f ? { ...f, taskName: e.target.value } : f))}
                placeholder="e.g. Foundation Excavation"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="canvas_work_id">Work / Trade</Label>
              <select
                id="canvas_work_id"
                value={createForm?.workId ?? ''}
                onChange={(e) => setCreateForm((f) => (f ? { ...f, workId: e.target.value } : f))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {works.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {taskTypes.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="canvas_task_type">Task Type <span className="text-muted-foreground">(optional)</span></Label>
                <select
                  id="canvas_task_type"
                  value={createForm?.taskTypeId ?? ''}
                  onChange={(e) => setCreateForm((f) => (f ? { ...f, taskTypeId: e.target.value } : f))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">No type</option>
                  {taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
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
            <div className="space-y-1.5">
              <Label htmlFor="canvas_edit_name">Task Name</Label>
              <Input
                id="canvas_edit_name"
                value={editForm?.taskName ?? ''}
                onChange={(e) => setEditForm((f) => (f ? { ...f, taskName: e.target.value } : f))}
                autoFocus
              />
            </div>
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
                  onDateChange={(d) => setEditForm((f) => (f ? { ...f, dueDate: d ? formatDateKey(d) : '' } : f))}
                  container={fullscreenContainer}
                />
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
