import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { formatDateKey } from './format';

// Server-only (queries Prisma) — never import this file from a 'use client'
// component. React's cache() memoizes per (function, args) for the lifetime
// of a single request/render pass, so calling this repeatedly for the same
// year on one page doesn't re-hit the database each time.
export const getAllBlockedDates = cache(async function getAllBlockedDates(
  year: number
): Promise<Set<string>> {
  const blocked = new Set<string>();

  // Sundays — computed directly, no query needed. UTC-anchored throughout so
  // this doesn't depend on the server process's local timezone.
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  const cursor = new Date(Date.UTC(year, 0, 1));
  for (let i = 0; i < daysInYear; i++) {
    if (cursor.getUTCDay() === 0) blocked.add(formatDateKey(cursor, { utc: true }));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Holidays for that year — a Postgres DATE column, no time/timezone of its
  // own; Prisma returns these as UTC-midnight Date objects, hence utc: true.
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
    select: { date: true },
  });
  for (const h of holidays) blocked.add(formatDateKey(h.date, { utc: true }));

  return blocked;
});

type DateField = 'planned_start_date' | 'due_date';

const FIELD_LABEL: Record<DateField, string> = {
  planned_start_date: 'Planned start date',
  due_date: 'Due date',
};

export interface TaskDateInputs {
  plannedStartDate?: string | null;
  dueDate?: string | null;
}

// Server-side safety net for task scheduling — mirrors WorkingDayPicker's
// disabled-dates rule (Sunday or a Holiday row) plus the start <= end
// ordering check, so a direct request to a server action can't bypass what
// the UI prevents. Returns null when everything's fine, otherwise a
// field-keyed error map in the same shape the rest of this app's Zod error
// handling already uses.
//
// Scoped to the planned pair only — actual dates (actualStartDate/
// actualEndDate) are deferred until the capture mechanism (admin entry vs. a
// future site-engineer mobile screen) is decided; the columns exist on the
// schema but nothing in the app reads/writes them yet.
export async function validateTaskDates(dates: TaskDateInputs): Promise<Record<string, string[]> | null> {
  const { plannedStartDate, dueDate } = dates;
  const errors: Record<string, string[]> = {};

  if (plannedStartDate && dueDate && dueDate < plannedStartDate) {
    errors.due_date = ['Due date must be on or after the planned start date'];
  }

  const values: Record<DateField, string | null | undefined> = {
    planned_start_date: plannedStartDate,
    due_date: dueDate,
  };

  for (const field of ['planned_start_date', 'due_date'] as const) {
    const value = values[field];
    if (!value) continue;

    const year = Number(value.slice(0, 4));
    const blocked = await getAllBlockedDates(year);
    if (!blocked.has(value)) continue;

    const dow = new Date(`${value}T00:00:00.000Z`).getUTCDay();
    const reason = dow === 0
      ? 'a Sunday'
      : await prisma.holiday
          .findUnique({ where: { date: new Date(`${value}T00:00:00.000Z`) }, select: { name: true } })
          .then((h) => h?.name ?? 'a public holiday');

    errors[field] = [...(errors[field] ?? []), `${FIELD_LABEL[field]} falls on ${reason} — choose a working day`];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// The Nth working day on/after `start`, inclusive — i.e. addWorkingDays(start, 1)
// returns `start` itself if it's already a working day. Used to auto-suggest a
// due date from a Task Type's default duration. Crosses year boundaries
// correctly by re-fetching getAllBlockedDates() for whichever year the
// cursor lands in (memoized per year via cache(), so this stays cheap even
// when it re-enters the same year repeatedly near a boundary).
export async function addWorkingDays(start: Date, days: number): Promise<Date> {
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  let year = cursor.getUTCFullYear();
  let blocked = await getAllBlockedDates(year);
  let remaining = Math.max(1, days);

  for (;;) {
    if (cursor.getUTCFullYear() !== year) {
      year = cursor.getUTCFullYear();
      blocked = await getAllBlockedDates(year);
    }
    if (!blocked.has(formatDateKey(cursor, { utc: true }))) {
      remaining--;
      if (remaining === 0) return cursor;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

export function countWorkingDays(
  start: Date,
  end: Date,
  holidayDates: Set<string>
): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (current <= endDay) {
    const dow = current.getDay();
    const iso = current.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidayDates.has(iso)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ─── Pure, synchronous working-day math (for the delay engine) ────────────
// The functions above are async because they lazily fetch Holiday rows per
// year via Prisma. The delay-propagation engine (lib/utils/delay-engine.ts)
// must be a pure function — it's called once per project recompute with a
// pre-fetched blockedDates set covering every year the schedule touches, not
// per-date-lookup. These are UTC-anchored and Sunday-only-non-working,
// consistent with getAllBlockedDates()/WorkingDayPicker, unlike the older
// countWorkingDays() above (unused elsewhere — left as-is) which mixes local
// and UTC date math and treats Saturday as non-working, which isn't this
// app's actual policy.

export function isWorkingDay(date: Date, blockedDates: Set<string>): boolean {
  return !blockedDates.has(formatDateKey(date, { utc: true }));
}

// Inclusive working-day span from `start` to `end` (both counted if both are
// working days) — e.g. same day = 1, next working day = 2. This is the
// inverse of addWorkingDaysSync(start, N) === end, i.e.
// countWorkingDaysBetween(start, addWorkingDaysSync(start, N)) === N. Do NOT
// use this directly as a "how many days did this slip" delta — that's an
// offset, not a span; see the delay engine's workingDayGap() for that.
export function countWorkingDaysBetween(start: Date, end: Date, blockedDates: Set<string>): number {
  const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if (e < s) return 0;
  let count = 0;
  const cursor = new Date(s);
  while (cursor <= e) {
    if (isWorkingDay(cursor, blockedDates)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

// Synchronous counterpart to addWorkingDays() above, taking a pre-fetched
// blockedDates set instead of querying per year — same semantics (the Nth
// working day on/after `date`, inclusive: addWorkingDaysSync(d, 1, ...) === d
// if d is itself a working day).
export function addWorkingDaysSync(date: Date, days: number, blockedDates: Set<string>): Date {
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  let remaining = Math.max(1, days);
  for (;;) {
    if (isWorkingDay(cursor, blockedDates)) {
      remaining--;
      if (remaining === 0) return cursor;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

export function toHolidaySet(holidays: { date: Date }[]): Set<string> {
  return new Set(holidays.map((h) => new Date(h.date).toISOString().slice(0, 10)));
}

export function workingDaysRemaining(
  dueDate: Date,
  holidayDates: Set<string>
): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dueDate < today) return 0;
  return countWorkingDays(today, dueDate, holidayDates);
}
