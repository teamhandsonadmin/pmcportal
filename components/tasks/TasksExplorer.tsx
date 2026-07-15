'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { ReactFlowInstance } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TaskDependencyGraph, type GraphEdgeInput } from '@/components/tasks/TaskDependencyGraph';
import { BulkDeleteDialog } from '@/components/tasks/BulkDeleteDialog';
import type { TaskTypeOption } from '@/components/hvac/TaskTypeManager';
import { STATUS_LABELS } from '@/lib/utils/status-rules';
import type { TaskStatus } from '@/lib/types/hvac';

export interface TaskRow {
  id: string;
  taskId: string;
  taskName: string;
  projectName: string;
  status: TaskStatus;
  plannedStartDate: Date | null;
  dueDate: Date | null;
  progressPct: number;
  overdue: boolean;
  assigneeName: string | null;
  workId: string | null;
  workName: string;
  workCode: string;
  workColor: string;
  manualPositionX: number | null;
  manualPositionY: number | null;
  prerequisiteCount: number;
  prerequisiteCompletedCount: number;
}

export interface WorkOption {
  id: string;
  name: string;
  code: string;
  color: string;
}

const STATUSES: TaskStatus[] = ['draft', 'ready', 'in_progress', 'on_hold', 'blocked', 'completed'];

export function TasksExplorer({
  rows,
  edges,
  parallelEdges,
  initialWork,
  works,
  taskTypes,
}: {
  rows: TaskRow[];
  edges: GraphEdgeInput[];
  parallelEdges: GraphEdgeInput[];
  initialWork?: string;
  works: WorkOption[];
  taskTypes: TaskTypeOption[];
}) {
  const [search, setSearch] = useState('');
  const [workF, setWorkF] = useState(initialWork ?? '');
  const [statusF, setStatusF] = useState<TaskStatus | ''>('');
  const [assigneeF, setAssigneeF] = useState('');
  const [projectF, setProjectF] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cssFallbackFullscreen, setCssFallbackFullscreen] = useState(false);
  const showAsFullscreen = isFullscreen || cssFallbackFullscreen;

  useEffect(() => {
    function onFsChange() {
      const active = document.fullscreenElement === containerRef.current;
      setIsFullscreen(active);
      if (active) requestAnimationFrame(() => rfInstanceRef.current?.fitView());
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    // Must be the first synchronous statement in the handler — requestFullscreen()
    // requires transient user-activation, which is lost across any await/microtask.
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      // iOS Safari and similar: Element.requestFullscreen() isn't supported —
      // fall back to a CSS-only "maximize within viewport" treatment.
      setCssFallbackFullscreen((v) => !v);
      requestAnimationFrame(() => rfInstanceRef.current?.fitView());
    }
  }

  const workOptions = useMemo(() => [...new Map(rows.map((r) => [r.workCode, r.workName])).entries()], [rows]);
  const assigneeOptions = useMemo(
    () => [...new Set(rows.map((r) => r.assigneeName).filter((n): n is string => !!n))],
    [rows]
  );
  const projectOptions = useMemo(() => [...new Set(rows.map((r) => r.projectName))], [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!search ||
            r.taskName.toLowerCase().includes(search.toLowerCase()) ||
            r.taskId.toLowerCase().includes(search.toLowerCase())) &&
          (!workF || r.workCode === workF) &&
          (!statusF || r.status === statusF) &&
          (!assigneeF || r.assigneeName === assigneeF) &&
          (!projectF || r.projectName === projectF)
      ),
    [rows, search, workF, statusF, assigneeF, projectF]
  );

  // Mapped separately (not inline in JSX) so this array only gets a new
  // reference when `filtered` actually changes — TaskDependencyGraph's own
  // useMemo/useEffect are keyed on this reference, and an inline `.map()` in
  // JSX recreates it on every render regardless of whether the underlying
  // data changed, which fed an infinite render loop (recompute -> resync
  // local state -> re-render -> recompute -> ...).
  const graphTasks = useMemo(
    () =>
      filtered.map((r) => ({
        id: r.id,
        taskId: r.taskId,
        taskName: r.taskName,
        status: r.status,
        workId: r.workId,
        workCode: r.workCode,
        workColor: r.workColor,
        assigneeName: r.assigneeName,
        plannedStartDate: r.plannedStartDate,
        dueDate: r.dueDate,
        manualPositionX: r.manualPositionX,
        manualPositionY: r.manualPositionY,
        prerequisiteCount: r.prerequisiteCount,
        prerequisiteCompletedCount: r.prerequisiteCompletedCount,
      })),
    [filtered]
  );

  const hasFilter = !!(search || workF || statusF || assigneeF || projectF);
  const clearFilters = () => { setSearch(''); setWorkF(''); setStatusF(''); setAssigneeF(''); setProjectF(''); };

  const filteredEdges = useMemo(() => {
    const visibleIds = new Set(filtered.map((r) => r.id));
    return edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [filtered, edges]);

  const filteredParallelEdges = useMemo(() => {
    const visibleIds = new Set(filtered.map((r) => r.id));
    return parallelEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [filtered, parallelEdges]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 flex flex-col gap-3 min-h-0',
        showAsFullscreen && 'bg-background p-4',
        cssFallbackFullscreen && 'fixed inset-0 z-50'
      )}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 max-w-xs">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks or IDs…"
              className="bg-transparent text-[12.5px] text-gray-700 placeholder-gray-400 outline-none flex-1"
            />
          </div>

          <select value={workF} onChange={(e) => setWorkF(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors">
            <option value="">All Works</option>
            {workOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>

          <select value={statusF} onChange={(e) => setStatusF(e.target.value as TaskStatus | '')}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors">
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>

          <select value={assigneeF} onChange={(e) => setAssigneeF(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors">
            <option value="">All Assignees</option>
            {assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={projectF} onChange={(e) => setProjectF(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors">
            <option value="">All Projects</option>
            {projectOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {hasFilter && (
            <button onClick={clearFilters}
              className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="text-[11.5px] text-gray-400">{filtered.length} of {rows.length} tasks</span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={toggleFullscreen}
            title={showAsFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {showAsFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
          <BulkDeleteDialog scope={{ search, workCode: workF, status: statusF, assigneeName: assigneeF, projectName: projectF }} />
        </div>
      </div>

      <div className="flex-1 min-h-[480px]">
        <TaskDependencyGraph
          tasks={graphTasks}
          edges={filteredEdges}
          parallelEdges={filteredParallelEdges}
          works={works}
          taskTypes={taskTypes}
          isFullscreen={showAsFullscreen}
          onReady={(instance) => { rfInstanceRef.current = instance; }}
          emptyState={filtered.length === 0 ? { hasFilter, onClear: clearFilters } : undefined}
          fullscreenContainer={containerRef}
        />
      </div>
    </div>
  );
}

