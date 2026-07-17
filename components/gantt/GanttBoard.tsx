'use client';

import { useMemo, useState } from 'react';
import { STATUS_LABELS } from '@/lib/utils/status-rules';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GanttWorkLeftPanel, GanttWorkTimelinePanel } from '@/components/gantt/GanttWorkSection';
import { GanttTimelineHeader } from '@/components/gantt/GanttTimelineHeader';
import { GanttDetailPopup } from '@/components/gantt/GanttDetailPopup';
import { computeTimelineRange, buildTimelineScale, ZOOM_PX_PER_DAY, TIMELINE_HEADER_HEIGHT, type ZoomLevel } from '@/components/gantt/ganttLayout';
import type { TaskRow } from '@/components/tasks/TasksExplorer';
import type { TaskStatus } from '@/lib/types/hvac';
import type { TaskDelayInfo } from '@/lib/utils/delay-engine';

const STATUSES: TaskStatus[] = ['draft', 'ready', 'in_progress', 'on_hold', 'blocked', 'completed'];
const ZOOM_LEVELS: ZoomLevel[] = ['Day', 'Week', 'Month'];

const selectClass =
  'bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors';

interface GanttBoardProps {
  rows: TaskRow[];
  delayById: Record<string, TaskDelayInfo>;
  groundedIds: string[];
}

export function GanttBoard({ rows, delayById, groundedIds }: GanttBoardProps) {
  const [search, setSearch] = useState('');
  const [workF, setWorkF] = useState('');
  const [statusF, setStatusF] = useState<TaskStatus | ''>('');
  const [assigneeF, setAssigneeF] = useState('');
  const [projectF, setProjectF] = useState('');
  const [zoom, setZoom] = useState<ZoomLevel>('Week');
  const [openWorkCodes, setOpenWorkCodes] = useState<Set<string> | null>(null); // null = "all open" (default)
  const [detailRow, setDetailRow] = useState<TaskRow | null>(null);

  const groundedSet = useMemo(() => new Set(groundedIds), [groundedIds]);
  const today = useMemo(() => new Date(), []);

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

  const hasFilter = !!(search || workF || statusF || assigneeF || projectF);
  const clearFilters = () => { setSearch(''); setWorkF(''); setStatusF(''); setAssigneeF(''); setProjectF(''); };

  const groups = useMemo(() => {
    const map = new Map<string, { workCode: string; workName: string; workColor: string; rows: TaskRow[] }>();
    for (const r of filtered) {
      if (!map.has(r.workCode)) map.set(r.workCode, { workCode: r.workCode, workName: r.workName, workColor: r.workColor, rows: [] });
      map.get(r.workCode)!.rows.push(r);
    }
    return [...map.values()].sort((a, b) => a.workName.localeCompare(b.workName));
  }, [filtered]);

  const scale = useMemo(() => {
    const dates: Date[] = [];
    for (const r of filtered) {
      if (r.plannedStartDate) dates.push(r.plannedStartDate);
      if (r.dueDate) dates.push(r.dueDate);
      if (groundedSet.has(r.id)) {
        const d = delayById[r.id];
        if (d) { dates.push(d.projectedStart); dates.push(d.projectedFinish); }
      }
    }
    const { rangeStart, rangeEnd } = computeTimelineRange(dates, today);
    return buildTimelineScale(rangeStart, rangeEnd, ZOOM_PX_PER_DAY[zoom]);
  }, [filtered, delayById, groundedSet, zoom, today]);

  function isOpen(workCode: string): boolean {
    return openWorkCodes === null || openWorkCodes.has(workCode);
  }
  function toggleWork(workCode: string) {
    setOpenWorkCodes((prev) => {
      // Lazily materialize "all open" into an explicit set on first toggle,
      // seeded with every OTHER group still open (only the clicked one flips).
      const base = prev ?? new Set(groups.map((g) => g.workCode));
      const next = new Set(base);
      if (next.has(workCode)) next.delete(workCode); else next.add(workCode);
      return next;
    });
  }

  return (
    <TooltipProvider>
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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

          <select value={workF} onChange={(e) => setWorkF(e.target.value)} className={selectClass}>
            <option value="">All Works</option>
            {workOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>

          <select value={statusF} onChange={(e) => setStatusF(e.target.value as TaskStatus | '')} className={selectClass}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>

          <select value={assigneeF} onChange={(e) => setAssigneeF(e.target.value)} className={selectClass}>
            <option value="">All Assignees</option>
            {assigneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={projectF} onChange={(e) => setProjectF(e.target.value)} className={selectClass}>
            <option value="">All Projects</option>
            {projectOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {hasFilter && (
            <button onClick={clearFilters} className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="text-[11.5px] text-gray-400">{filtered.length} of {rows.length} tasks</span>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {ZOOM_LEVELS.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-md transition-colors ${
                  zoom === z ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2 rounded-sm bg-gray-400/60" /> Planned (Work color)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2 rounded-sm bg-emerald-500" /> Projected / actual (status color)</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2 rounded-sm" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #DC2626, #DC2626 2px, #FCA5A5 2px, #FCA5A5 4px)' }} />
          Behind plan
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-lg">
          <p className="text-[13px] font-semibold text-gray-300">No tasks found</p>
          {hasFilter && (
            <button onClick={clearFilters} className="mt-3 text-[12px] font-semibold text-gray-400 hover:text-gray-900 underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex border border-border rounded-lg overflow-hidden bg-card">
          {/* Left column: Task / Planned / Status — fixed width, no horizontal scroll needed */}
          <div className="flex-shrink-0 border-r border-border" style={{ width: 320 }}>
            <div style={{ height: TIMELINE_HEADER_HEIGHT }} className="border-b border-border bg-card" />
            {groups.map((g) => (
              <GanttWorkLeftPanel
                key={g.workCode}
                workName={g.workName}
                workColor={g.workColor}
                rows={g.rows}
                open={isOpen(g.workCode)}
                onToggle={() => toggleWork(g.workCode)}
                onOpenDetail={setDetailRow}
              />
            ))}
          </div>

          {/* Timeline column: sticky header + every group's bars, horizontally scrollable as one unit */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ width: scale.totalWidth }}>
              <GanttTimelineHeader scale={scale} today={today} />
              {groups.map((g) => (
                <GanttWorkTimelinePanel
                  key={g.workCode}
                  rows={g.rows}
                  delayById={delayById}
                  groundedIds={groundedSet}
                  scale={scale}
                  open={isOpen(g.workCode)}
                  onOpenDetail={setDetailRow}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <GanttDetailPopup row={detailRow} onClose={() => setDetailRow(null)} />
    </div>
    </TooltipProvider>
  );
}
