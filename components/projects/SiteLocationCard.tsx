'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import dynamic from 'next/dynamic';
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
import { updateProjectLocation } from '@/app/actions/projects';
import type { ActionResult } from '@/lib/types/hvac';

const SiteLocationMap = dynamic(() => import('./SiteLocationMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});
const SiteLocationPreviewMap = dynamic(() => import('./SiteLocationPreviewMap'), {
  ssr: false,
  loading: () => <MapSkeleton short />,
});

function MapSkeleton({ short }: { short?: boolean }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-gray-100 text-[12px] text-gray-400"
      style={{ minHeight: short ? 160 : 320 }}
    >
      Loading map…
    </div>
  );
}

// No site location on record yet — deliberately not geocoded from the
// project's free-text address (see PART 1 non-goal); center of India at a
// low zoom is a neutral starting point for the pin-drop dialog, not a guess.
const DEFAULT_LAT = 20.5937;
const DEFAULT_LNG = 78.9629;

const initialState: ActionResult = { success: true };

export function SiteLocationCard({
  projectId,
  initialLat,
  initialLng,
}: {
  projectId: string;
  initialLat: number | null;
  initialLng: number | null;
}) {
  const hasLocation = initialLat != null && initialLng != null;
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(initialLat ?? DEFAULT_LAT);
  const [lng, setLng] = useState(initialLng ?? DEFAULT_LNG);

  const [state, formAction, isPending] = useActionState(updateProjectLocation, initialState);
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && open) setOpen(false);
  }

  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

  function openDialog() {
    setLat(initialLat ?? DEFAULT_LAT);
    setLng(initialLng ?? DEFAULT_LNG);
    setOpen(true);
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-[14px] font-semibold text-gray-900">Site Location</h2>
          {hasLocation && (
            <button
              type="button"
              onClick={openDialog}
              className="text-[11.5px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Edit location
            </button>
          )}
        </div>

        <div className="p-5 pt-3">
          {hasLocation ? (
            <div className="space-y-2">
              <SiteLocationPreviewMap lat={initialLat} lng={initialLng} />
              <p className="text-[11px] font-mono text-gray-400 tabular-nums">
                {initialLat.toFixed(6)}, {initialLng.toFixed(6)}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-[12.5px] text-gray-400 mb-3">No site location set</p>
              <Button type="button" size="sm" onClick={openDialog}>Set location</Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Set Site Location</DialogTitle>
          </DialogHeader>

          <form action={formAction} className="space-y-4 mt-2">
            <input type="hidden" name="projectId" value={projectId} />

            {globalError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
                {globalError}
              </div>
            )}

            <p className="text-[12px] text-muted-foreground">
              Drag the pin, click anywhere on the map, or type exact coordinates below.
            </p>

            {open && (
              <SiteLocationMap lat={lat} lng={lng} onChange={(nLat, nLng) => { setLat(nLat); setLng(nLng); }} />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="siteLatitude">Latitude</Label>
                <Input
                  id="siteLatitude"
                  name="siteLatitude"
                  type="number"
                  step="0.0000001"
                  min={-90}
                  max={90}
                  value={lat}
                  onChange={(e) => setLat(e.target.value === '' ? 0 : Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteLongitude">Longitude</Label>
                <Input
                  id="siteLongitude"
                  name="siteLongitude"
                  type="number"
                  step="0.0000001"
                  min={-180}
                  max={180}
                  value={lng}
                  onChange={(e) => setLng(e.target.value === '' ? 0 : Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Location'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
