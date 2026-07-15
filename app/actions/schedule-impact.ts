'use server';

import { getTaskScheduleImpact } from '@/lib/data/delay-engine';

// getTaskScheduleImpact() lives in lib/data/ (Server-Component-only, no
// 'use server') since its normal caller is the task overview page's initial
// render. The Gantt chart's click-for-details popup needs to fetch the same
// data on demand from a Client Component instead — this is a thin
// client-callable wrapper, not a reimplementation, so both callers share the
// exact same delay-figure calculation.
export async function fetchTaskScheduleImpact(taskId: string) {
  return getTaskScheduleImpact(taskId);
}
