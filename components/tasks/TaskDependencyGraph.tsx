'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  BaseEdge,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { TaskStatus } from '@/lib/types/hvac';
import { STATUS_COLOR_PALETTE } from '@/lib/utils/status-rules';

// This reference-sequence graph deliberately renders every node in the
// neutral gray palette regardless of its real stored status — the status
// label text still shows the real value, this only suppresses the color.
// A cosmetic override for this view specifically, not a data change.
const FORCED_GRAY = STATUS_COLOR_PALETTE.gray;
const EDGE_COLOR = '#F0A227';

// Miro-style board background — the canvas fill and its dot-grid color
// toggle together so the grid stays visible against either surface.
const CANVAS_THEMES = {
  light: { bg: '#ffffff', dot: '#d4d4d8' },
  dark: { bg: '#0a0a0a', dot: '#52525b' },
} as const;

export interface GraphTask {
  id: string;
  taskId: string;
  taskName: string;
  status: TaskStatus;
  workCode: string;
  workColor: string;
  assigneeName: string | null;
}

export interface GraphEdgeInput {
  id: string;
  source: string;
  target: string;
}

type NodeData = GraphTask & Record<string, unknown>;

const NODE_WIDTH = 208;
const NODE_HEIGHT = 84;

// Minimal by design, matching the reference sequence diagram: just the task
// ID, its name, and its trade/category — no status pill, color dot, or
// assignee. Those live on the task detail page; here they were adding visual
// noise without helping read the sequence.
function TaskNode({ data }: NodeProps<Node<NodeData>>) {
  const cfg = FORCED_GRAY;
  return (
    <div
      className="relative rounded-lg border p-3 flex flex-col gap-1 transition-shadow hover:shadow-md"
      style={{ width: NODE_WIDTH, backgroundColor: cfg.bg, borderColor: cfg.border }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#94A3B8', width: 6, height: 6 }} />
      <span className="font-mono text-[10px] font-bold truncate" style={{ color: cfg.text }}>{data.taskId}</span>
      <p className="text-[12px] font-semibold text-foreground leading-tight line-clamp-2">{data.taskName}</p>
      <span className="text-[10px] text-muted-foreground">({data.workCode})</span>
      <Handle type="source" position={Position.Bottom} style={{ background: '#94A3B8', width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { task: TaskNode };

// Renders the exact bend points dagre computed for this edge, instead of
// letting React Flow's built-in smoothstep/step routing pick its own path
// independently per edge. The built-in routers only look at an edge's own
// source/target and ignore every other edge, so parallel edges through the
// same tier of the graph frequently overlap or run flush alongside each
// other (looking like a doubled line, sometimes in two different colors).
// Dagre already reserves separate lanes for these edges when it lays out
// the whole graph, so reusing its points avoids that collision entirely.
interface DagreEdgeData extends Record<string, unknown> {
  points: { x: number; y: number }[];
}

// Dagre only inserts a bend point between ranks it actually crosses — an
// edge between adjacent ranks gets just its two endpoints, which draws as a
// bare diagonal line straight through the canvas when those ranks don't
// line up horizontally. Stepping through a horizontal midpoint between every
// pair of points turns each segment into a right-angle dogleg instead, using
// the same x-lanes dagre already reserved to keep separate edges apart.
function buildOrthogonalPath(points: { x: number; y: number }[]): string {
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const midY = (a.y + b.y) / 2;
    path += ` L${a.x},${midY} L${b.x},${midY} L${b.x},${b.y}`;
  }
  return path;
}

function DagreEdge({ data, style, markerEnd }: EdgeProps<Edge<DagreEdgeData>>) {
  const points = data?.points ?? [];
  if (points.length < 2) return null;
  return <BaseEdge path={buildOrthogonalPath(points)} style={style} markerEnd={markerEnd} />;
}

const edgeTypes = { dagre: DagreEdge };

function layoutWithDagre(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  // Generous spacing so 3-4 parallel cross-trade branches at the same tier
  // (e.g. Electrical/HVAC/Plumbing all fanning out from one milestone) don't
  // visually collide, and fan-out/reconvergence edges have room to route
  // around node bodies rather than through them.
  g.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const positionedNodes = nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });

  const positionedEdges = edges.map((e) => {
    const points = g.edge(e.source, e.target)?.points ?? [];
    return { ...e, data: { ...(e.data ?? {}), points } };
  });

  return { nodes: positionedNodes, edges: positionedEdges };
}

interface TaskDependencyGraphProps {
  tasks: GraphTask[];
  edges: GraphEdgeInput[];
  isFullscreen?: boolean;
  onReady?: (instance: ReactFlowInstance) => void;
}

export function TaskDependencyGraph({ tasks, edges, isFullscreen, onReady }: TaskDependencyGraphProps) {
  const router = useRouter();
  const [darkCanvas, setDarkCanvas] = useState(false);

  const { nodes, flowEdges } = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    const rawNodes: Node[] = tasks.map((t) => ({
      id: t.id,
      type: 'task',
      data: { ...t } as NodeData,
      position: { x: 0, y: 0 },
    }));

    // One uniform dashed style for every edge, matching the reference
    // sequence diagram — no per-edge color/dash coding to track visually.
    const rawEdges: Edge[] = edges
      .filter((e) => taskById.has(e.source) && taskById.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'dagre',
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
        style: { stroke: EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '5 4' },
      }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutWithDagre(rawNodes, rawEdges);
    return { nodes: layoutedNodes, flowEdges: layoutedEdges };
  }, [tasks, edges]);

  function handleNodeClick(_: unknown, node: Node) {
    const url = `/hvac/${node.id}`;
    // In fullscreen, navigating in-place would strand the user mid-board —
    // open in a new tab instead so the canvas/pan/zoom state stays intact.
    if (isFullscreen) window.open(url, '_blank');
    else router.push(url);
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center h-full">
        <p className="text-[13px] font-semibold text-gray-300">No tasks to show</p>
      </div>
    );
  }

  const canvas = darkCanvas ? CANVAS_THEMES.dark : CANVAS_THEMES.light;

  return (
    <div className="relative h-full w-full rounded-xl border border-border overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onInit={onReady}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: canvas.bg }}
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

      {/* Miro-style board background toggle */}
      <button
        onClick={() => setDarkCanvas((v) => !v)}
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium shadow-sm transition-colors"
        style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
        title={darkCanvas ? 'Switch to light board' : 'Switch to dark board'}
      >
        {darkCanvas ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        )}
        {darkCanvas ? 'Light board' : 'Dark board'}
      </button>

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
