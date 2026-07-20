'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getBlockedDatesForYear } from '@/app/actions/working-days';
import { formatDate, formatDateKey } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

// Parses a 'YYYY-MM-DD' string as a *local* calendar day, not UTC — matching
// how formatDateKey(date) (no utc flag) reads it back out. `new Date('YYYY-MM-DD')`
// parses as UTC midnight, which can render as the previous day in the picker
// for anyone west of UTC.
function parseDateKey(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

interface WorkingDayPickerProps {
  name: string;
  id?: string;
  defaultValue?: string | null;
  /**
   * Auto-suggested value from outside (e.g. Task Type + Planned Start Date).
   * Every *change* to this prop re-syncs the picker, but the user can still
   * freely override it afterward — it's a suggestion, not a controlled lock.
   */
  value?: string | null;
  placeholder?: string;
  /** Dates strictly before this are also disabled (e.g. due date vs. planned start date). */
  minDate?: Date;
  /** Notifies the parent when the selection changes — e.g. so a due-date picker's minDate can track a planned-start-date picker's current value. */
  onDateChange?: (date: Date | undefined) => void;
  /** Forwarded to PopoverContent — needed when this picker is opened from inside a real-fullscreen container (see popover.tsx's own comment). */
  container?: ComponentProps<typeof PopoverContent>['container'];
}

// One shared date picker for plannedStartDate/dueDate everywhere they're set,
// so the "Sundays and holidays aren't selectable" rule can't drift between a
// creation form and an edit form built later. A plain <input type="date">
// can't disable arbitrary individual dates (only a min/max range), which is
// why this exists instead.
export function WorkingDayPicker({ name, id, defaultValue, value, placeholder, minDate, onDateChange, container }: WorkingDayPickerProps) {
  const [selected, setSelected] = useState<Date | undefined>(
    defaultValue ? parseDateKey(defaultValue) : undefined
  );

  // Re-syncs exactly once per incoming `value` change (a fresh auto-suggestion),
  // not on every render — so a manual pick the user makes afterward sticks
  // until the next actual suggestion comes in. Setting state during render
  // (React's documented pattern for this) instead of in an effect avoids an
  // extra render pass.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== undefined && value !== syncedValue) {
    setSyncedValue(value);
    setSelected(value ? parseDateKey(value) : undefined);
  }

  function handleSelect(date: Date | undefined) {
    setSelected(date);
    onDateChange?.(date);
  }
  const [blockedByYear, setBlockedByYear] = useState<Record<number, Set<string>>>({});
  const loadingYears = useRef(new Set<number>());

  function ensureYearLoaded(year: number) {
    if (blockedByYear[year] || loadingYears.current.has(year)) return;
    loadingYears.current.add(year);
    getBlockedDatesForYear(year).then((dates) => {
      setBlockedByYear((prev) => ({ ...prev, [year]: new Set(dates) }));
    });
  }

  useEffect(() => {
    ensureYearLoaded((selected ?? new Date()).getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function isDisabled(date: Date): boolean {
    if (minDate && date < minDate) return true;
    const yearSet = blockedByYear[date.getFullYear()];
    return yearSet ? yearSet.has(formatDateKey(date)) : false;
  }

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn('w-full justify-start text-left font-normal', !selected && 'text-muted-foreground')}
            >
              <CalendarIcon className="size-4" />
              {selected ? formatDate(selected) : (placeholder ?? 'Pick a date')}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" container={container}>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            onMonthChange={(month) => ensureYearLoaded(month.getFullYear())}
            disabled={isDisabled}
            autoFocus
          />
          <p className="px-3 pb-2.5 text-[11px] text-muted-foreground">
            Sundays and public holidays aren&apos;t selectable
          </p>
        </PopoverContent>
      </Popover>
      <input type="hidden" id={id} name={name} value={selected ? formatDateKey(selected) : ''} />
    </>
  );
}
