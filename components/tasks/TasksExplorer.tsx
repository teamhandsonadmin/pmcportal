'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskCard, TaskListHeader } from '@/components/hvac/TaskCard';
import { TaskFlowMap } from '@/components/tasks/TaskFlowMap';
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
}

const STATUSES: TaskStatus[] = ['draft', 'ready', 'in_progress', 'on_hold', 'blocked', 'completed'];

export function TasksExplorer({ rows }: { rows: TaskRow[] }) {
  const [search, setSearch] = useState('');
  const [workF, setWorkF] = useState('');
  const [statusF, setStatusF] = useState<TaskStatus | ''>('');
  const [assigneeF, setAssigneeF] = useState('');
  const [projectF, setProjectF] = useState('');

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

  const groupedByWork = useMemo(() => {
    const groups = new Map<string, { workName: string; workCode: string; rows: TaskRow[] }>();
    for (const r of filtered) {
      const key = r.workId ?? 'unassigned';
      if (!groups.has(key)) groups.set(key, { workName: r.workName, workCode: r.workCode, rows: [] });
      groups.get(key)!.rows.push(r);
    }
    return [...groups.values()];
  }, [filtered]);

  return (
    <Tabs defaultValue="list" className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <TabsList variant="line">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="flow">Flowchart View</TabsTrigger>
        </TabsList>

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

          <span className="text-[11.5px] text-gray-400">{filtered.length} of {rows.length} tasks</span>
        </div>
      </div>

      <TabsContent value="list" className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState hasFilter={hasFilter} onClear={clearFilters} />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <TaskListHeader />
            <div>
              {filtered.map((row) => (
                <TaskCard
                  key={row.id}
                  task={{
                    id: row.id,
                    taskId: row.taskId,
                    taskName: row.taskName,
                    projectName: row.projectName,
                    status: row.status,
                    plannedStartDate: row.plannedStartDate,
                    dueDate: row.dueDate,
                  }}
                  overallPct={row.progressPct}
                  assigneeName={row.assigneeName}
                />
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="flow" className="flex-1 min-h-0 overflow-y-auto space-y-5">
        {filtered.length === 0 ? (
          <EmptyState hasFilter={hasFilter} onClear={clearFilters} />
        ) : (
          groupedByWork.map((group) => (
            <div key={group.workCode + group.workName} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold">{group.workName}</h3>
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                  {group.rows.length} {group.rows.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
              <div className="p-5">
                <TaskFlowMap
                  tasks={group.rows.map((r) => ({
                    id: r.id,
                    taskId: r.taskId,
                    taskName: r.taskName,
                    status: r.status,
                    completionPct: r.progressPct,
                    overdue: r.overdue,
                  }))}
                />
              </div>
            </div>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ hasFilter, onClear }: { hasFilter: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
      </div>
      <p className="text-[13px] font-semibold text-gray-300">No tasks found</p>
      {hasFilter && (
        <button onClick={onClear} className="mt-3 text-[12px] font-semibold text-gray-400 hover:text-gray-900 underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
