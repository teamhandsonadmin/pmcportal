'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProjectTotalSft } from '@/app/actions/projects';

export function ProjectTotalSftEditor({
  projectId,
  initialTotalSft,
}: {
  projectId: string;
  initialTotalSft: number | null;
}) {
  const [value, setValue] = useState(initialTotalSft != null ? String(initialTotalSft) : '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateProjectTotalSft(projectId, Number(value));
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to save');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <h2 className="text-[14px] font-semibold text-gray-900 mb-1">Total SFT Target</h2>
      <p className="text-[12px] text-gray-400 mb-4">
        The project-wide square footage target — used to show overall SFT completion progress on
        the project dashboard. Distinct from any individual task&apos;s own SFT target.
      </p>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5 flex-1 max-w-[200px]">
          <Label htmlFor="project_total_sft">Total SFT</Label>
          <Input
            id="project_total_sft"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 25000"
          />
        </div>
        <Button type="button" onClick={save} disabled={isPending || value === ''}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-[12px] text-green-600 font-medium pb-2">Saved</span>}
      </div>
      {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
    </div>
  );
}
