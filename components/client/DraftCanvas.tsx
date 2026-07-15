'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type ReactFlowInstance,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  createDraftNode,
  updateDraftNodePosition,
  updateDraftNode,
  deleteDraftNode,
  createDraftEdge,
  deleteDraftEdge,
  type DraftSequenceData,
} from '@/app/actions/draft-sequence';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface DraftNodeData extends Record<string, unknown> {
  label: string;
  notes: string | null;
  plannedDurationDays: number | null;
  onEdit: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}

function DraftTaskNode({ id, data }: NodeProps<Node<DraftNodeData>>) {
  return (
    <div
      className="group relative rounded-lg border-2 border-gray-300 bg-white p-3 w-52 shadow-sm hover:shadow-md hover:border-gray-400 transition-all cursor-pointer"
      onClick={() => data.onEdit(id)}
    >
      <Handle type="target" position={Position.Top} id="t-top" style={{ background: '#94A3B8', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} id="t-left" style={{ background: '#94A3B8', width: 8, height: 8 }} />

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-400 hover:text-red-600 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs shadow-sm"
        title="Delete task"
      >
        ×
      </button>

      <p className="text-[13px] font-semibold text-gray-900 leading-tight break-words">{data.label}</p>
      {data.notes && <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{data.notes}</p>}
      {data.plannedDurationDays != null && (
        <span className="inline-block mt-1.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
          {data.plannedDurationDays} day{data.plannedDurationDays === 1 ? '' : 's'}
        </span>
      )}

      <Handle type="source" position={Position.Bottom} id="s-bottom" style={{ background: '#6366F1', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="s-right" style={{ background: '#6366F1', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { draftTask: DraftTaskNode };

interface FormState {
  mode: 'create' | 'edit';
  nodeId?: string;
  position?: { x: number; y: number };
  label: string;
  notes: string;
  plannedDurationDays: string;
}

interface DraftCanvasProps {
  draft: DraftSequenceData;
}

export function DraftCanvas({ draft }: DraftCanvasProps) {
  const [nodes, setNodes, onNodesStateChange] = useNodesState<Node<DraftNodeData>>(
    draft.nodes.map((n) => ({
      id: n.id,
      type: 'draftTask',
      position: { x: n.positionX, y: n.positionY },
      data: { label: n.label, notes: n.notes, plannedDurationDays: n.plannedDurationDays, onEdit: () => {}, onDelete: () => {} },
    }))
  );
  const [edges, setEdges, onEdgesStateChange] = useEdgesState<Edge>(
    draft.edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed' as const, color: '#6366F1' },
      style: { stroke: '#6366F1', strokeWidth: 1.75 },
    }))
  );

  const instanceRef = useRef<ReactFlowInstance<Node<DraftNodeData>, Edge> | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'error' | 'saved'; text: string } | null>(null);

  function flashSaved() {
    setBanner({ type: 'saved', text: 'Saved' });
    setTimeout(() => setBanner((b) => (b?.text === 'Saved' ? null : b)), 1500);
  }
  function flashError(text: string) {
    setBanner({ type: 'error', text });
  }

  const openEditForm = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setForm({
      mode: 'edit',
      nodeId,
      label: node.data.label,
      notes: node.data.notes ?? '',
      plannedDurationDays: node.data.plannedDurationDays != null ? String(node.data.plannedDurationDays) : '',
    });
    setFormError(null);
  }, [nodes]);

  const requestDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    deleteDraftNode(nodeId).then((res) => {
      if (res.success) flashSaved();
      else flashError(typeof res.error === 'string' ? res.error : 'Failed to delete task');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire each node's onEdit/onDelete to the latest callbacks without forcing
  // every node to re-render on every keystroke elsewhere in the app.
  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, onEdit: openEditForm, onDelete: requestDeleteNode } })),
    [nodes, openEditForm, requestDeleteNode]
  );

  function handleNodesChange(changes: NodeChange<Node<DraftNodeData>>[]) {
    onNodesStateChange(changes);
  }

  function handleEdgesChange(changes: EdgeChange<Edge>[]) {
    onEdgesStateChange(changes);
  }

  // Fires once at the end of a drag — not on every intermediate pixel of
  // movement — so this is already the right granularity to persist without
  // needing a separate timer-based debounce.
  function handleNodeDragStop(_event: unknown, node: Node) {
    updateDraftNodePosition(node.id, node.position.x, node.position.y).then((res) => {
      if (res.success) flashSaved();
      else flashError(typeof res.error === 'string' ? res.error : 'Failed to save position');
    });
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    createDraftEdge(draft.id, connection.source, connection.target).then((res) => {
      if (!res.success) {
        flashError(typeof res.error === 'string' ? res.error : 'Could not connect these tasks');
        return;
      }
      setEdges((eds) => [
        ...eds,
        {
          id: res.data!.id,
          source: res.data!.sourceNodeId,
          target: res.data!.targetNodeId,
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' as const, color: '#6366F1' },
          style: { stroke: '#6366F1', strokeWidth: 1.75 },
        },
      ]);
      flashSaved();
    });
  }

  function handleNodesDelete(deleted: Node[]) {
    // Local state for these nodes (and any edges React Flow removes as a
    // side effect) is already gone via handleNodesChange/handleEdgesChange —
    // this only needs to persist the deletion server-side. requestDeleteNode
    // isn't reused here since it also does the (now redundant) local removal.
    for (const n of deleted) {
      deleteDraftNode(n.id).then((res) => {
        if (!res.success) flashError(typeof res.error === 'string' ? res.error : 'Failed to delete task');
      });
    }
    flashSaved();
  }

  function handleEdgesDelete(deleted: Edge[]) {
    for (const e of deleted) {
      deleteDraftEdge(e.id).then((res) => {
        if (!res.success) flashError(typeof res.error === 'string' ? res.error : 'Failed to delete connection');
      });
    }
    flashSaved();
  }

  function openCreateFormAt(position: { x: number; y: number }) {
    setForm({ mode: 'create', position, label: '', notes: '', plannedDurationDays: '' });
    setFormError(null);
  }

  function handlePaneDoubleClick(event: React.MouseEvent) {
    if (!instanceRef.current) return;
    const position = instanceRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    openCreateFormAt(position);
  }

  function handleAddTaskClick() {
    const viewport = instanceRef.current?.getViewport();
    const center = instanceRef.current?.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }) ?? { x: 0, y: 0 };
    void viewport;
    openCreateFormAt(center);
  }

  async function submitForm() {
    if (!form) return;
    const trimmedLabel = form.label.trim();
    if (!trimmedLabel) {
      setFormError('Task name is required');
      return;
    }
    const duration = form.plannedDurationDays.trim() ? Number(form.plannedDurationDays) : null;
    if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) {
      setFormError('Planned duration must be a positive number of days');
      return;
    }

    if (form.mode === 'create' && form.position) {
      const res = await createDraftNode(draft.id, trimmedLabel, form.position.x, form.position.y, form.notes.trim() || null, duration);
      if (!res.success) {
        setFormError(typeof res.error === 'string' ? res.error : 'Failed to create task');
        return;
      }
      if (!res.data) {
        setFormError('Failed to create task');
        return;
      }
      setNodes((nds) => [
        ...nds,
        {
          id: res.data!.id,
          type: 'draftTask',
          position: form.position!,
          data: { label: res.data!.label, notes: res.data!.notes, plannedDurationDays: res.data!.plannedDurationDays, onEdit: () => {}, onDelete: () => {} },
        },
      ]);
    } else if (form.mode === 'edit' && form.nodeId) {
      const res = await updateDraftNode(form.nodeId, trimmedLabel, form.notes.trim() || null, duration);
      if (!res.success) {
        setFormError(typeof res.error === 'string' ? res.error : 'Failed to update task');
        return;
      }
      setNodes((nds) => nds.map((n) => (n.id === form.nodeId
        ? { ...n, data: { ...n.data, label: trimmedLabel, notes: form.notes.trim() || null, plannedDurationDays: duration } }
        : n)));
    }

    flashSaved();
    setForm(null);
  }

  return (
    <div className="h-full w-full relative">
      {banner && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 rounded-lg text-[12.5px] font-medium shadow-md flex items-center gap-2 ${
            banner.type === 'error' ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-gray-900 text-white'
          }`}
        >
          {banner.text}
          {banner.type === 'error' && (
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">✕</button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleAddTaskClick}
        className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 text-white text-[12.5px] font-medium hover:bg-black transition-colors shadow-sm"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Task
      </button>

      <div className="absolute top-4 right-4 z-10 text-[11px] text-muted-foreground bg-card border border-border rounded-lg px-3 py-2 shadow-sm max-w-[220px]">
        Double-click empty canvas to add a task. Drag from a node&apos;s edge to another to connect them. Select and press Delete to remove.
      </div>

      <div className="h-full w-full" onDoubleClick={handlePaneDoubleClick}>
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          onInit={(instance) => { instanceRef.current = instance; }}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#d4d4d8" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <Dialog open={!!form} onOpenChange={(open) => { if (!open) setForm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.mode === 'edit' ? 'Edit Task' : 'Add Task'}</DialogTitle>
            <DialogDescription>This is a draft sequence — nothing here is submitted for review yet.</DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{formError}</div>
          )}

          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="draft_label">Task Name</Label>
              <Input
                id="draft_label"
                value={form?.label ?? ''}
                onChange={(e) => setForm((f) => (f ? { ...f, label: e.target.value } : f))}
                placeholder="e.g. Foundation Excavation"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="draft_notes">
                Notes <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="draft_notes"
                value={form?.notes ?? ''}
                onChange={(e) => setForm((f) => (f ? { ...f, notes: e.target.value } : f))}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="draft_duration">
                Planned Duration (days) <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="draft_duration"
                type="number"
                min="1"
                value={form?.plannedDurationDays ?? ''}
                onChange={(e) => setForm((f) => (f ? { ...f, plannedDurationDays: e.target.value } : f))}
                placeholder="e.g. 5"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="button" onClick={submitForm}>{form?.mode === 'edit' ? 'Save Changes' : 'Add Task'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
