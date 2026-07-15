'use server';

import { addWorkingDays, getAllBlockedDates } from '@/lib/utils/working-days';
import { formatDateKey } from '@/lib/utils/format';

// Thin client-callable wrapper — <WorkingDayPicker /> calls this as the user
// navigates the calendar to a year it hasn't fetched yet. Sets aren't a safe
// return type across the server action boundary, so this flattens to an array;
// the client reconstitutes its own per-year Set.
export async function getBlockedDatesForYear(year: number): Promise<string[]> {
  const blocked = await getAllBlockedDates(year);
  return [...blocked];
}

// Auto-suggests a Planned End Date from a Task Type's default duration —
// called when the creation form has both a Planned Start Date and a Task
// Type selected. Returns a 'YYYY-MM-DD' string, still fully overridable by
// the user afterward.
export async function computeDueDate(plannedStartDate: string, durationDays: number): Promise<string> {
  const [y, m, d] = plannedStartDate.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const due = await addWorkingDays(start, durationDays);
  return formatDateKey(due, { utc: true });
}
