'use client';

import { useActionState } from 'react';
import { createProject } from '@/app/actions/projects';
import Link from 'next/link';

const initial = { error: '' };

export function ProjectForm() {
  const [state, action, pending] = useActionState(createProject, initial);

  return (
    <form action={action} className="space-y-5 max-w-2xl">
      {state?.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px] px-4 py-3">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <div className="col-span-2">
          <label className="block text-[13px] font-medium text-foreground mb-1.5">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Elmwood Villas"
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Address</label>
          <input
            name="address"
            type="text"
            placeholder="e.g. 3891 Ranchview Dr, Richardson, California 62639"
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Area / Size</label>
          <input
            name="area"
            type="text"
            placeholder="e.g. 3475 SF"
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Budget</label>
          <input
            name="budget"
            type="text"
            placeholder="e.g. 120k USD"
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Cover Photo URL</label>
          <input
            name="photoUrl"
            type="url"
            placeholder="https://… (optional)"
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          <p className="text-[11.5px] text-muted-foreground mt-1">Paste an image URL to use as the project banner photo.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-5 bg-primary text-white text-[13px] font-medium rounded-lg hover:opacity-85 transition-opacity disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create Project'}
        </button>
        <Link
          href="/projects"
          className="h-10 px-5 border border-border rounded-lg text-[13px] font-medium hover:bg-muted transition-colors flex items-center"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
