'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface ReportWorkOption {
  id: string;
  name: string;
}

interface ReportDateRangePickerProps {
  projectId: string;
  initialFrom: string | null;
  initialTo: string | null;
  workOptions: ReportWorkOption[];
  initialWorkId: string | null;
}

// Query-param driven rather than local state feeding a client-side filter —
// the report's numbers all come from a server query (getProjectReportData),
// so "generate" has to be a real navigation that changes what the server
// component fetches, not just a client-side re-render of already-fetched data.
// The date range and the Work picker apply independently — either can be set
// without the other (e.g. "just Civil Works, no date filter" is a valid
// request), so `generate()` only includes whichever of the two is filled in.
export function ReportDateRangePicker({
  projectId, initialFrom, initialTo, workOptions, initialWorkId,
}: ReportDateRangePickerProps) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom ?? '');
  const [to, setTo] = useState(initialTo ?? '');
  const [workId, setWorkId] = useState(initialWorkId ?? '');
  const hasAnyFilter = !!(initialFrom && initialTo) || !!initialWorkId;

  function generate() {
    const params = new URLSearchParams();
    if (from && to) { params.set('from', from); params.set('to', to); }
    if (workId) params.set('work', workId);
    const qs = params.toString();
    router.push(`/projects/${projectId}/report${qs ? `?${qs}` : ''}`);
  }

  function reset() {
    setFrom('');
    setTo('');
    setWorkId('');
    router.push(`/projects/${projectId}/report`);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {workOptions.length > 0 && (
        <>
          <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Work</span>
          <select
            value={workId}
            onChange={(e) => setWorkId(e.target.value)}
            className="text-[13px] text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-gray-400 bg-white"
          >
            <option value="">All Works</option>
            {workOptions.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <div className="w-px self-stretch bg-gray-100" />
        </>
      )}

      <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Date Range</span>
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="text-[13px] text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-gray-400"
      />
      <span className="text-[12px] text-gray-400">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="text-[13px] text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-gray-400"
      />
      <Button type="button" onClick={generate}>
        Generate Report
      </Button>
      {hasAnyFilter && (
        <button
          type="button"
          onClick={reset}
          className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          Reset to full project
        </button>
      )}
    </div>
  );
}
