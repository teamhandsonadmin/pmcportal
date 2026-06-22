'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createWork } from '@/app/actions/works';
import type { ActionResult } from '@/lib/types/hvac';

const PRESET_COLORS = [
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#0EA5E9', // sky
];

const initialState: ActionResult<{ workId: string }> = { success: true };

export function WorkForm({ projectId }: { projectId?: string }) {
  const [state, formAction, isPending] = useActionState(createWork, initialState);
  const errors = (!state.success && typeof state.error === 'object') ? state.error : {};
  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

  return (
    <form action={formAction} className="space-y-5">
      {projectId && <input type="hidden" name="project_id" value={projectId} />}
      {globalError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
          {globalError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Work Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. HVAC, Electrical, Plumbing"
          required
        />
        {errors.name && <p className="text-xs text-red-500">{errors.name[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code">
          Short Code
          <span className="text-muted-foreground font-normal ml-1">(used as task ID prefix)</span>
        </Label>
        <Input
          id="code"
          name="code"
          placeholder="e.g. ELEC, PLMB, CIVIL"
          maxLength={10}
          className="uppercase"
          required
        />
        <p className="text-[11.5px] text-muted-foreground">Uppercase letters and numbers, max 10 chars</p>
        {errors.code && <p className="text-xs text-red-500">{errors.code[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description
          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Describe the scope of this work type…"
          rows={3}
          className="resize-none"
        />
        {errors.description && <p className="text-xs text-red-500">{errors.description[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c}
                defaultChecked={i === 0}
                className="sr-only peer"
              />
              <span
                className="block w-7 h-7 rounded-lg border-2 border-transparent peer-checked:border-foreground transition-all ring-offset-1"
                style={{ backgroundColor: c }}
              />
            </label>
          ))}
        </div>
        {errors.color && <p className="text-xs text-red-500">{errors.color[0]}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create Work'}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
