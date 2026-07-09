'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { TaskStatus } from '@/lib/types/hvac';

// Mirrors TaskFlowMap.tsx's status→color map for visual continuity between
// the per-Work simple flow and this project-wide graph — this codebase
// already has a few independent status-color maps (see PROJECT_SUMMARY.md),
// this is deliberately not a new source of truth, just the existing pattern.
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft:       { label: 'Draft',       color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', dot: '#9CA3AF' },
  ready:       { label: 'Ready',       color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  on_hold:     { label: 'On Hold',     color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', dot: '#8B5CF6' },
  blocked:     { label: 'Blocked',     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
  completed:   { label: 'Completed',   color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
};

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

const NODE_WIDTH = 208;
const NODE_HEIGHT = 112;

function TaskNode({ data }: NodeProps<Node<GraphTask & Record<string, unknown>>>) {
  const cfg = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.draft;
  return (
    <div
      className="rounded-lg border-2 p-3 flex flex-col gap-1.5 transition-shadow hover:shadow-md"
      style={{ width: NODE_WIDTH, backgroundColor: cfg.bg, borderColor: cfg.border }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#94A3B8', width: 6, height: 6 }} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: data.workColor }} />
          <span className="font-mono text-[10px] font-bold truncate" style={{ color: cfg.color }}>{data.taskId}</span>
        </span>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: cfg.color, backgroundColor: cfg.border }}>
          {cfg.label}
        </span>
      </div>
      <p className="text-[12px] font-semibold text-foreground leading-tight line-clamp-2">{data.taskName}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{data.workCode}</span>
        <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">
          {data.assigneeName ?? 'Unassigned'}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#94A3B8', width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { task: TaskNode };

function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 32, ranksep: 64 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
}

interface TaskDependencyGraphProps {
  tasks: GraphTask[];
  edges: GraphEdgeInput[];
}

export function TaskDependencyGraph({ tasks, edges }: TaskDependencyGraphProps) {
  const router = useRouter();

  const { nodes, flowEdges } = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const rawNodes: Node[] = tasks.map((t) => ({
      id: t.id,
      type: 'task',
      data: t as GraphTask & Record<string, unknown>,
      position: { x: 0, y: 0 },
    }));
    const rawEdges: Edge[] = edges
      .filter((e) => taskById.has(e.source) && taskById.has(e.target))
      .map((e) => {
        const prereqCompleted = taskById.get(e.source)?.status === 'completed';
        const color = prereqCompleted ? '#94A3B8' : '#F59E0B';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: {
            stroke: color,
            strokeWidth: 1.75,
            strokeDasharray: prereqCompleted ? undefined : '5 4',
          },
        };
      });

    return { nodes: layoutWithDagre(rawNodes, rawEdges), flowEdges: rawEdges };
  }, [tasks, edges]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-[13px] font-semibold text-gray-300">No tasks to show</p>
      </div>
    );
  }

  return (
    <div style={{ height: 600 }} className="rounded-xl border border-border overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => router.push(`/hvac/${node.id}`)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
