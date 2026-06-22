'use client';

import { useState, useMemo } from 'react';

type Priority = 'high' | 'medium' | 'low';
type Status = 'unread' | 'acknowledged';
type Filter = 'all' | 'unread' | 'acknowledged';

interface Alert {
  id: string;
  task: string;
  taskId: string;
  category: string;
  message: string;
  priority: Priority;
  status: Status;
  from: string;
  date: string;
  time: string;
}

const INITIAL_ALERTS: Alert[] = [
  {
    id: 'ALERT-001',
    task: 'Ceiling Electrical Conduit Marking',
    taskId: 'TASK-002',
    category: 'Electrical',
    message: 'Please update your progress before 5:30 PM today. The admin needs the DPR completed for this task.',
    priority: 'high',
    status: 'unread',
    from: 'Admin',
    date: '22 Jun 2026',
    time: '09:15 AM',
  },
  {
    id: 'ALERT-002',
    task: 'CPVC & PVC Pipe Level Marking',
    taskId: 'TASK-013',
    category: 'Plumbing',
    message: 'Consultant drawing has been revised (Rev-04). Please review the latest version before proceeding with pipe routing.',
    priority: 'medium',
    status: 'unread',
    from: 'Project Manager',
    date: '22 Jun 2026',
    time: '10:30 AM',
  },
  {
    id: 'ALERT-003',
    task: 'Window Stone Jambing Works',
    taskId: 'TASK-025',
    category: 'Flooring',
    message: 'Site photos for completed window stone work are pending. Please upload before end of day.',
    priority: 'low',
    status: 'unread',
    from: 'Admin',
    date: '21 Jun 2026',
    time: '04:00 PM',
  },
  {
    id: 'ALERT-004',
    task: 'HVAC Refrigerant Piping',
    taskId: 'TASK-003',
    category: 'HVAC',
    message: 'Material for refrigerant piping has been delivered to site. Please commence work tomorrow morning.',
    priority: 'high',
    status: 'acknowledged',
    from: 'Project Manager',
    date: '21 Jun 2026',
    time: '02:30 PM',
  },
  {
    id: 'ALERT-005',
    task: 'GI & Wood Framing Works',
    taskId: 'TASK-040',
    category: 'False Ceiling',
    message: 'Dependency approved — architect drawing sign-off received. You may now proceed with GI framing.',
    priority: 'medium',
    status: 'acknowledged',
    from: 'Admin',
    date: '20 Jun 2026',
    time: '11:00 AM',
  },
];

const PRIORITY_STYLES: Record<Priority, { bg: string; text: string; border: string; dot: string; label: string }> = {
  high:   { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#DC2626', label: 'High' },
  medium: { bg: '#FFFBEB', text: '#B45309', border: '#FED7AA', dot: '#F59E0B', label: 'Medium' },
  low:    { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#22C55E', label: 'Low' },
};

const STATUS_STYLES: Record<Status, { label: string; bg: string; text: string }> = {
  unread:       { label: 'Unread',       bg: '#EFF6FF', text: '#1D4ED8' },
  acknowledged: { label: 'Acknowledged', bg: '#F0FDF4', text: '#166534' },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Electrical:    { bg: '#EFF6FF', text: '#1D4ED8' },
  Plumbing:      { bg: '#F0F9FF', text: '#0369A1' },
  Flooring:      { bg: '#FDF4FF', text: '#7C3AED' },
  HVAC:          { bg: '#FFF7ED', text: '#C2410C' },
  'False Ceiling': { bg: '#F8FAFC', text: '#475569' },
};

function CategoryChip({ category }: { category: string }) {
  const style = CATEGORY_COLORS[category] ?? { bg: '#F3F4F6', text: '#374151' };
  return (
    <span
      style={{ backgroundColor: style.bg, color: style.text }}
      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
    >
      {category}
    </span>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter((a) => a.status === filter);
  }, [alerts, filter]);

  const unreadCount = useMemo(() => alerts.filter((a) => a.status === 'unread').length, [alerts]);
  const acknowledgedCount = useMemo(() => alerts.filter((a) => a.status === 'acknowledged').length, [alerts]);

  function acknowledge(id: string) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: 'acknowledged' } : a));
    setToast('Alert acknowledged');
    setTimeout(() => setToast(null), 2200);
  }

  const FILTER_TABS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'acknowledged', label: 'Acknowledged' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">My Alerts</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Alerts from Admin &amp; Project Manager · ABC Villa Construction · Jun 22, 2026
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 shrink-0">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 pb-2 text-[13px] transition-colors ${
                  filter === tab.key
                    ? 'border-b-2 border-gray-900 text-gray-900 font-semibold'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[12px] text-gray-500 bg-white border border-gray-100 rounded-full px-3 py-1 shadow-sm">
            Total: <span className="font-semibold text-gray-800">{alerts.length}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-gray-500 bg-white border border-gray-100 rounded-full px-3 py-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            Unread: <span className="font-semibold text-gray-800">{unreadCount}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-gray-500 bg-white border border-gray-100 rounded-full px-3 py-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Acknowledged: <span className="font-semibold text-gray-800">{acknowledgedCount}</span>
          </span>
        </div>

        {/* Alert list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[14px] text-gray-400">No alerts to show</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((alert) => {
              const p = PRIORITY_STYLES[alert.priority];
              const s = STATUS_STYLES[alert.status];
              return (
                <div
                  key={alert.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-gray-400">{alert.id}</span>
                      <span
                        style={{ backgroundColor: s.bg, color: s.text }}
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                      >
                        {s.label}
                      </span>
                    </div>
                    <span
                      style={{ backgroundColor: p.bg, color: p.text, borderColor: p.border }}
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                    >
                      <span
                        style={{ backgroundColor: p.dot }}
                        className="w-1.5 h-1.5 rounded-full inline-block"
                      />
                      {p.label}
                    </span>
                  </div>

                  {/* Task row */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-gray-900">{alert.task}</span>
                    <span className="text-[10.5px] font-mono text-gray-400">{alert.taskId}</span>
                    <CategoryChip category={alert.category} />
                  </div>

                  {/* Message */}
                  <p className="mt-2 text-[13px] text-gray-600 leading-relaxed">{alert.message}</p>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                    <div className="text-[11.5px] text-gray-400">
                      From: <span className="font-medium text-gray-500">{alert.from}</span>
                      <span className="mx-1.5">·</span>
                      {alert.date}
                      <span className="mx-1">at</span>
                      {alert.time}
                    </div>
                    {alert.status === 'unread' ? (
                      <button
                        onClick={() => acknowledge(alert.id)}
                        className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-800 transition-colors"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6l3 3 5-5" stroke="#15803d" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
