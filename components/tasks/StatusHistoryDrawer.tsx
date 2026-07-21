'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon, ClockIcon } from 'lucide-react';
import { getDependencyStatusHistory, type StatusHistoryEntry } from '@/app/actions/dependencies';
import type { CompletionStatus } from '@/lib/types/tasks';
import { STATUS_CHIP } from './StatusDropdown';

function fmt(date: Date): string {
  return format(date, "MMM d, yyyy '·' h:mm a");
}

function StatusBadge({ status }: { status: CompletionStatus }) {
  const cfg = STATUS_CHIP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <cfg.Icon size={12} strokeWidth={2.25} className="flex-shrink-0" />
      {cfg.label}
    </span>
  );
}

interface StatusHistoryDrawerProps {
  itemId: string | null; // null = closed
  itemLabel: string;
  currentStatus: CompletionStatus;
  onClose: () => void;
}

export function StatusHistoryDrawer({ itemId, itemLabel, currentStatus, onClose }: StatusHistoryDrawerProps) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!itemId) { setHistory([]); return; }
    setLoading(true);
    getDependencyStatusHistory(itemId).then((rows) => {
      setHistory(rows);
      setLoading(false);
    });
  }, [itemId]);

  const latest = history[0];

  return (
    <DialogPrimitive.Root open={!!itemId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[1100] bg-black/50 transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup
          className="fixed top-0 right-0 z-[1100] h-full w-full max-w-[420px] bg-background border-l border-border shadow-2xl outline-none flex flex-col
            transition-transform data-starting-style:translate-x-full data-ending-style:translate-x-full"
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                <ClockIcon className="size-3.5 text-muted-foreground" />
                Status history
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[12.5px] text-muted-foreground mt-0.5 truncate">
                {itemLabel}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:bg-muted flex-shrink-0">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <p className="text-[12.5px] text-gray-400 text-center py-8">Loading…</p>
            ) : (
              <>
                {/* Current — always distinguished from the trailing log below */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 mb-5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Current</span>
                    <StatusBadge status={currentStatus} />
                  </div>
                  {latest ? (
                    <p className="text-[11.5px] text-gray-500">
                      Changed by <span className="font-medium text-gray-700">{latest.changedByName ?? 'Unknown'}</span> · {fmt(latest.changedAt)}
                    </p>
                  ) : (
                    <p className="text-[11.5px] text-gray-500">No changes yet</p>
                  )}
                </div>

                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">History</p>
                {history.length === 0 ? (
                  <p className="text-[12.5px] text-gray-400 text-center py-6">No changes yet — this item is still at its default status.</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0 pb-3 border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {entry.oldStatus && <StatusBadge status={entry.oldStatus} />}
                            {entry.oldStatus && <span className="text-gray-300 text-[11px]">→</span>}
                            <StatusBadge status={entry.newStatus} />
                          </div>
                          <p className="text-[11.5px] text-gray-500 mt-1">
                            <span className="font-medium text-gray-700">{entry.changedByName ?? 'Unknown'}</span> · {fmt(entry.changedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
