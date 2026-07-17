'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getBulkDeletePreview, bulkDeleteTasks, type BulkDeleteScope, type BulkDeletePreview } from '@/app/actions/bulk-delete';

type Stage = 'closed' | 'preview' | 'confirm' | 'done';

interface BulkDeleteDialogProps {
  scope: BulkDeleteScope;
}

// Deliberately not reachable from the canvas's main toolbar (Select/Add
// Connect/Group/Lock) — this lives behind an overflow "..." menu in the
// filter bar instead, and everything past the trigger is designed to add
// friction, not remove it: a live-counted informational stage, then a
// typed-phrase stage, before the actual delete ever fires.
export function BulkDeleteDialog({ scope }: BulkDeleteDialogProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('closed');
  const [preview, setPreview] = useState<BulkDeletePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAllProjects = !scope.projectName;
  const requiredPhrase = isAllProjects ? 'DELETE ALL TASKS' : scope.projectName;
  const scopeLabel = isAllProjects
    ? 'Clear ALL tasks across ALL projects'
    : `Clear all tasks in ${scope.projectName}`;

  async function fetchPreview() {
    setLoadingPreview(true);
    setError(null);
    const res = await getBulkDeletePreview(scope);
    setLoadingPreview(false);
    if (!res.success) {
      setError(typeof res.error === 'string' ? res.error : 'Failed to load counts');
      return null;
    }
    if (!res.data) {
      setError('Failed to load counts');
      return null;
    }
    setPreview(res.data);
    return res.data;
  }

  async function openStage1() {
    setMenuOpen(false);
    setStage('preview');
    setTypedPhrase('');
    setDeletedCount(null);
    await fetchPreview();
  }

  async function goToStage2() {
    // Re-fetch right at the transition too, on top of the fetch when the
    // dialog first opened — the live count shown just before the typed
    // confirmation should be as fresh as reasonably possible; the delete
    // itself still re-verifies once more at the moment it actually runs.
    const fresh = await fetchPreview();
    if (fresh) setStage('confirm');
  }

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    const res = await bulkDeleteTasks(scope, typedPhrase);
    setDeleting(false);
    if (!res.success) {
      setError(typeof res.error === 'string' ? res.error : 'Bulk delete failed');
      return;
    }
    if (!res.data) {
      setError('Bulk delete failed');
      return;
    }
    setDeletedCount(res.data.deletedCount);
    setStage('done');
    router.refresh();
  }

  function closeAll() {
    setStage('closed');
    setPreview(null);
    setTypedPhrase('');
    setError(null);
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" size="sm" title="More actions, including permanent deletion">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
              More
            </Button>
          }
        />
        <PopoverContent align="end" className="w-56 p-1">
          <button
            type="button"
            onClick={openStage1}
            className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-md text-[12.5px] font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" /></svg>
            Delete All Tasks…
          </button>
        </PopoverContent>
      </Popover>

      {/* Stage 1 — informational, live counts */}
      <Dialog open={stage === 'preview'} onOpenChange={(open) => { if (!open) closeAll(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">{scopeLabel}</DialogTitle>
            <DialogDescription>This is a permanent action — there is no undo.</DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            {loadingPreview && <p className="text-[13px] text-muted-foreground">Counting matching tasks…</p>}
            {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{error}</div>}
            {!loadingPreview && preview && (
              <p className="text-[13.5px] leading-relaxed">
                This will permanently delete <strong>{preview.taskCount} task{preview.taskCount === 1 ? '' : 's'}</strong>,{' '}
                <strong>{preview.dependencyItemCount} dependency checklist item{preview.dependencyItemCount === 1 ? '' : 's'}</strong>, and{' '}
                <strong>{preview.dependencyLinkCount} cross-task dependency link{preview.dependencyLinkCount === 1 ? '' : 's'}</strong>.
                {' '}This cannot be undone.
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button
              type="button"
              variant="destructive"
              onClick={goToStage2}
              disabled={loadingPreview || !preview || preview.taskCount === 0}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage 2 — typed confirmation, not just a second click */}
      <Dialog open={stage === 'confirm'} onOpenChange={(open) => { if (!open) closeAll(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">{scopeLabel}</DialogTitle>
            <DialogDescription>
              Type <strong>{requiredPhrase}</strong> below to confirm. This permanently deletes{' '}
              {preview?.taskCount ?? 0} task{(preview?.taskCount ?? 0) === 1 ? '' : 's'} and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-2">
            <Label htmlFor="bulk_delete_confirm">Type &ldquo;{requiredPhrase}&rdquo; to confirm</Label>
            <Input
              id="bulk_delete_confirm"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={requiredPhrase}
              autoFocus
              autoComplete="off"
            />
            {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{error}</div>}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={typedPhrase !== requiredPhrase || deleting}
            >
              {deleting ? 'Deleting…' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Done */}
      <Dialog open={stage === 'done'} onOpenChange={(open) => { if (!open) closeAll(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tasks deleted</DialogTitle>
            <DialogDescription>{deletedCount ?? 0} task{(deletedCount ?? 0) === 1 ? '' : 's'} permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button">Close</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
