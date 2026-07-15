export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export function isOverdue(dueDate: Date | string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export function formatDistanceMeters(meters: number | null | undefined): string {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function calcOverallProgress(
  categories: { completionPct: number }[]
): number {
  if (!categories.length) return 0;
  const sum = categories.reduce((acc, c) => acc + c.completionPct, 0);
  return Math.round(sum / categories.length);
}

// 'YYYY-MM-DD' for a calendar day — deliberately NOT toISOString().slice(0, 10),
// which converts to UTC first and can shift the date by a day depending on the
// caller's timezone offset. Pass utc: true when reading a Postgres DATE column
// (Prisma returns those as UTC-midnight Date objects with no real timezone of
// their own), and utc: false (the default) for a Date representing a day a
// user picked in their local browser — e.g. from a calendar/date picker.
export function formatDateKey(date: Date, opts?: { utc?: boolean }): string {
  const utc = opts?.utc ?? false;
  const y = utc ? date.getUTCFullYear() : date.getFullYear();
  const m = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
  const d = utc ? date.getUTCDate() : date.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
