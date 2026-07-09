'use client';

import { useTransition } from 'react';
import { markAttendanceReviewed } from '@/app/actions/attendance';

export function MarkReviewedButton({ recordId }: { recordId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await markAttendanceReviewed(recordId); })}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {isPending ? 'Marking…' : 'Mark reviewed'}
    </button>
  );
}
