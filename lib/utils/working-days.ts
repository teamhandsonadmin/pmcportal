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
