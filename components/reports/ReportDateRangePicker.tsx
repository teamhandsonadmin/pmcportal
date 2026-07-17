'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface ReportDateRangePickerProps {
  projectId: string;
  initialFrom: string | null;
  initialTo: string | null;
}

// Query-param driven rather than local state feeding a client-side filter —
// the report's numbers all come from a server query (getProjectReportData),
// so "generate" has to be a real navigation that changes what the server
// component fetches, not just a client-side re-render of already-fetched data.
export function ReportDateRangePicker({ projectId, initialFrom, initialTo }: ReportDateRangePickerProps) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom ?? '');
  const [to, setTo] = useState(initialTo ?? '');
  const hasRange = !!(initialFrom && initialTo);

  function generate() {
    if (!from || !to) return;
    const params = new URLSearchParams({ from, to });
    router.push(`/projects/${projectId}/report?${params.toString()}`);
  }

  function reset() {
    setFrom('');
    setTo('');
    router.push(`/projects/${projectId}/report`);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
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
      <Button type="button" onClick={generate} disabled={!from || !to}>
        Generate Report
      </Button>
      {hasRange && (
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
