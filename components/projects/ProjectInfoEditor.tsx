'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { updateProjectInfo } from '@/app/actions/projects';
import type { ActionResult } from '@/lib/types/tasks';

const initialState: ActionResult = { success: true };

export function ProjectInfoEditor({
  projectId,
  initialName,
  initialAddress,
  initialArea,
  initialBudget,
  initialPhotoUrl,
}: {
  projectId: string;
  initialName: string;
  initialAddress: string | null;
  initialArea: string | null;
  initialBudget: string | null;
  initialPhotoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateProjectInfo, initialState);
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && open) setOpen(false);
  }

  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-[14px] font-semibold text-gray-900">Project Info</h2>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[11.5px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Edit info
          </button>
        </div>

        <div className="p-5 pt-3 flex gap-4">
          {initialPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={initialPhotoUrl}
              alt=""
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-gray-200"
            />
          )}
          <dl className="space-y-1.5 min-w-0">
            <div>
              <dt className="text-[10.5px] text-gray-400 uppercase tracking-wide">Name</dt>
              <dd className="text-[13px] text-gray-900 font-medium truncate">{initialName}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] text-gray-400 uppercase tracking-wide">Address</dt>
              <dd className="text-[12.5px] text-gray-600 truncate">{initialAddress || '—'}</dd>
            </div>
            <div className="flex gap-6">
              <div>
                <dt className="text-[10.5px] text-gray-400 uppercase tracking-wide">Area</dt>
                <dd className="text-[12.5px] text-gray-600">{initialArea || '—'}</dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-gray-400 uppercase tracking-wide">Budget</dt>
                <dd className="text-[12.5px] text-gray-600">{initialBudget || '—'}</dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Project Info</DialogTitle>
          </DialogHeader>

          <form action={formAction} className="space-y-4 mt-2">
            <input type="hidden" name="projectId" value={projectId} />

            {globalError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
                {globalError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">Project Name</Label>
              <Input id="name" name="name" type="text" defaultValue={initialName} required minLength={2} maxLength={200} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" type="text" defaultValue={initialAddress ?? ''} maxLength={500} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="area">Area / Size</Label>
                <Input id="area" name="area" type="text" defaultValue={initialArea ?? ''} maxLength={50} placeholder="e.g. 3475 SF" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget</Label>
                <Input id="budget" name="budget" type="text" defaultValue={initialBudget ?? ''} maxLength={100} placeholder="e.g. 120k USD" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="photoUrl">Cover Photo URL</Label>
              <Input id="photoUrl" name="photoUrl" type="url" defaultValue={initialPhotoUrl ?? ''} placeholder="https://… (optional)" />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Info'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
