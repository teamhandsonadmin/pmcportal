'use client';

import { useState, useTransition, useActionState } from 'react';
import { addHoliday, deleteHoliday } from '@/app/actions/holidays';
import type { Holiday, ActionResult } from '@/lib/types/hvac';

interface HolidayCalendarProps {
  holidays: Holiday[];
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['S','M','T','W','T','F','S'];

const initialState: ActionResult = { success: true };

/* National/public holidays shown by default (not DB-stored) */
const BUILT_IN: Record<string, string> = {
  '01-01': "New Year's Day",
  '01-14': 'Makar Sankranti',
  '01-26': 'Republic Day',
  '03-17': 'Holi',
  '04-14': 'Dr. Ambedkar Jayanti',
  '04-18': 'Good Friday',
  '05-01': 'Labour Day',
  '08-15': 'Independence Day',
  '09-05': 'Onam',
  '10-02': 'Gandhi Jayanti',
  '10-20': 'Dussehra',
  '11-05': 'Diwali',
  '11-15': 'Guru Nanak Jayanti',
  '12-25': 'Christmas Day',
};

export function HolidayCalendar({ holidays: initialHolidays }: HolidayCalendarProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState(addHoliday, initialState);
  const [holidays, setHolidays] = useState(initialHolidays);

  const dbHolidayMap = new Map(holidays.map((h) => [new Date(h.date).toISOString().slice(0, 10), h]));

  function getBuiltIn(dateStr: string): string | null {
    const mmdd = dateStr.slice(5);
    return BUILT_IN[mmdd] ?? null;
  }

  function isHoliday(dateStr: string) { return dbHolidayMap.has(dateStr) || getBuiltIn(dateStr) !== null; }

  function getHolidayName(dateStr: string) {
    const db = dbHolidayMap.get(dateStr);
    if (db) return db.name;
    return getBuiltIn(dateStr);
  }

  function handleDayClick(dateStr: string) {
    if (dbHolidayMap.has(dateStr) || getBuiltIn(dateStr)) return;
    setSelectedDate(dateStr === selectedDate ? null : dateStr);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteHoliday(id);
      if (res.success) setHolidays((prev) => prev.filter((h) => h.id !== id));
    });
  }

  function buildMonth(y: number, m: number) {
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  const todayStr = today.toISOString().slice(0, 10);

  /* All holidays this year (DB + built-in) */
  const allThisYear: { dateStr: string; name: string; isBuiltIn: boolean }[] = [];
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= new Date(year, m + 1, 0).getDate(); d++) {
      const ds = `${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const builtIn = getBuiltIn(ds);
      const db = dbHolidayMap.get(ds);
      if (builtIn) allThisYear.push({ dateStr: ds, name: builtIn, isBuiltIn: true });
      else if (db) allThisYear.push({ dateStr: ds, name: db.name, isBuiltIn: false });
    }
  }
  const upcoming = allThisYear.filter((h) => h.dateStr >= todayStr).slice(0, 8);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const bigCells = buildMonth(year, viewMonth);

  return (
    <div className="space-y-6">

      {/* ── Featured month (big view) ───────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Month nav header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors text-lg">‹</button>
            <div>
              <h2 className="text-[18px] font-bold text-gray-900">{MONTHS[viewMonth]}</h2>
              <p className="text-[12px] text-gray-400">{year}</p>
            </div>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors text-lg">›</button>
          </div>
          <div className="flex items-center gap-4 text-[11.5px] text-gray-500">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block"/><span>Public holiday</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block"/><span>Custom holiday</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-gray-900 inline-block"/><span>Today</span></div>
          </div>
        </div>

        <div className="p-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="text-center text-[11.5px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {bigCells.map((day, i) => {
              if (!day) return <div key={i} />;
              const ds = `${year}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const builtIn = getBuiltIn(ds);
              const dbH = dbHolidayMap.get(ds);
              const isToday = ds === todayStr;
              const isSelected = selectedDate === ds;
              const dow = new Date(year, viewMonth, day).getDay();
              const isWeekend = dow === 0 || dow === 6;
              const holidayName = builtIn ?? dbH?.name;

              return (
                <button
                  key={i}
                  onClick={() => !builtIn && !dbH && handleDayClick(ds)}
                  title={holidayName ?? undefined}
                  className={`relative aspect-square rounded-lg flex flex-col items-center justify-start pt-2 text-[13px] font-medium transition-all min-h-[52px] ${
                    builtIn || dbH ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'
                  } ${isSelected ? 'ring-2 ring-gray-900 bg-gray-50' : ''}`}
                  style={{
                    backgroundColor: builtIn ? '#fef2f2' : dbH ? '#fffbeb' : undefined,
                    color: builtIn ? '#dc2626' : dbH ? '#d97706' : isWeekend ? '#9ca3af' : '#1f2937',
                    outline: isToday ? '2px solid #111111' : undefined,
                    outlineOffset: isToday ? '-2px' : undefined,
                  }}
                >
                  <span className="font-semibold">{day}</span>
                  {holidayName && (
                    <span className="text-[8px] leading-tight px-0.5 text-center line-clamp-2 mt-0.5 opacity-75">
                      {holidayName.split(' ').slice(0, 2).join(' ')}
                    </span>
                  )}
                  {isToday && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-gray-900" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add holiday form */}
        {selectedDate && (
          <div className="border-t border-gray-100 px-6 py-5 bg-gray-50">
            <h3 className="text-[13px] font-semibold mb-3 text-gray-800">
              Add holiday — <span className="font-mono text-gray-900">{selectedDate}</span>
            </h3>
            {state && !state.success && (
              <p className="text-[12px] text-red-500 mb-2">{typeof state.error === 'string' ? state.error : 'Please check the form'}</p>
            )}
            <form
              action={(fd) => { fd.set('date', selectedDate); formAction(fd); setSelectedDate(null); }}
              className="flex gap-3 items-end"
            >
              <input type="hidden" name="date" value={selectedDate} />
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-gray-500 block mb-1">Holiday Name</label>
                <input name="name" required placeholder="e.g. National Day"
                  className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all" />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-gray-500 block mb-1">Description (optional)</label>
                <input name="description" placeholder="Optional note"
                  className="w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all" />
              </div>
              <button type="submit" className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-gray-900 hover:bg-black transition-colors flex-shrink-0">Save</button>
              <button type="button" onClick={() => setSelectedDate(null)} className="px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:text-gray-800 border border-gray-200 flex-shrink-0 hover:bg-white transition-colors">Cancel</button>
            </form>
          </div>
        )}
      </div>

      {/* ── Bottom: mini year grid + upcoming list ──────── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Mini month grid */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-gray-900">Year Overview — {year}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setYear(y => y-1)} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">‹</button>
              <span className="text-[12px] font-mono text-gray-500 px-1">{year}</span>
              <button onClick={() => setYear(y => y+1)} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">›</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {MONTHS.map((mName, mIdx) => {
              const cells = buildMonth(year, mIdx);
              const isCurrentMonth = year === currentYear && mIdx === today.getMonth();
              return (
                <button
                  key={mIdx}
                  onClick={() => { setViewMonth(mIdx); }}
                  className="bg-white rounded-xl border p-3 text-left hover:border-gray-900 hover:shadow-sm transition-all group"
                  style={{ borderColor: viewMonth === mIdx && year === currentYear ? '#111111' : '#e5e7eb' }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-900 mb-2 transition-colors">{mName}</p>
                  <div className="grid grid-cols-7 gap-px">
                    {DAYS_SHORT.map((d, i) => (
                      <div key={i} className="text-center text-[7px] text-gray-300 font-medium">{d}</div>
                    ))}
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} />;
                      const ds = `${year}-${String(mIdx+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                      const builtIn = getBuiltIn(ds);
                      const dbH = dbHolidayMap.get(ds);
                      const isToday = ds === todayStr;
                      return (
                        <div key={i} className="aspect-square flex items-center justify-center text-[7.5px] rounded"
                          style={{
                            backgroundColor: builtIn ? '#fef2f2' : dbH ? '#fffbeb' : isToday ? '#111111' : undefined,
                            color: builtIn ? '#dc2626' : dbH ? '#d97706' : isToday ? 'white' : '#374151',
                            fontWeight: isToday || builtIn || dbH ? 700 : 400,
                          }}
                        >{day}</div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upcoming holidays */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-gray-500">Upcoming Holidays</h3>
              <span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{allThisYear.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {upcoming.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-gray-400">No upcoming holidays.</p>
              ) : (
                upcoming.map((h) => {
                  const d = new Date(h.dateStr + 'T00:00:00');
                  const dbH = dbHolidayMap.get(h.dateStr);
                  return (
                    <div key={h.dateStr} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                      <div className="flex-shrink-0 w-9 text-center">
                        <p className="text-[9px] uppercase font-bold" style={{ color: h.isBuiltIn ? '#ef4444' : '#d97706' }}>
                          {MONTHS[d.getMonth()].slice(0,3)}
                        </p>
                        <p className="text-[17px] font-bold leading-tight" style={{ color: h.isBuiltIn ? '#dc2626' : '#d97706' }}>
                          {d.getDate()}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-gray-800 truncate">{h.name}</p>
                        <p className="text-[10.5px]" style={{ color: h.isBuiltIn ? '#ef4444' : '#d97706' }}>
                          {h.isBuiltIn ? 'Public holiday' : 'Custom'}
                        </p>
                      </div>
                      {!h.isBuiltIn && dbH && (
                        <button onClick={() => handleDelete(dbH.id)} disabled={isPending} className="text-[11px] text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">✕</button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="text-[11.5px] text-gray-500 leading-relaxed">
              <span className="font-semibold text-red-500">Red</span> = public/national holidays.<br/>
              <span className="font-semibold text-amber-500">Amber</span> = custom holidays you add.<br/>
              Click any day to mark it as a custom holiday.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
