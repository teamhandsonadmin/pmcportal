import { prisma } from '@/lib/prisma';
import { formatDateKey } from '@/lib/utils/format';
import { HolidayCalendar, type HolidayDTO } from '@/components/calendar/HolidayCalendar';

export const dynamic = 'force-dynamic';

const YEAR = 2026;

export default async function HolidayCalendarPage() {
  const rows = await prisma.holiday.findMany({
    where: { date: { gte: new Date(Date.UTC(YEAR, 0, 1)), lt: new Date(Date.UTC(YEAR + 1, 0, 1)) } },
    orderBy: { date: 'asc' },
  });

  const holidays: HolidayDTO[] = rows.map((h) => ({
    id: h.id,
    date: formatDateKey(h.date, { utc: true }),
    name: h.name,
    type: h.type as HolidayDTO['type'],
  }));

  return <HolidayCalendar holidays={holidays} year={YEAR} />;
}
