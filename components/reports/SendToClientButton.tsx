'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { sendReportToClient } from '@/app/actions/reports';

type Stage = 'closed' | 'confirm' | 'done';

interface SendToClientButtonProps {
  projectId: string;
  projectName: string;
  hasClient: boolean;
  reportSentAt: Date | null;
}

// Single confirm step, not the bulk-delete pattern's two-stage typed
// confirmation — this action isn't destructive (nothing is deleted, and
// re-sending is harmless/idempotent), but it does notify a real person, so
// per the request it still needs an explicit confirm rather than firing on
// first click.
export function SendToClientButton({ projectId, projectName, hasClient, reportSentAt }: SendToClientButtonProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('closed');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientNames, setRecipientNames] = useState<string[]>([]);

  async function confirmSend() {
    setSending(true);
    setError(null);
    const res = await sendReportToClient(projectId);
    setSending(false);
    if (!res.success) {
      setError(typeof res.error === 'string' ? res.error : 'Failed to send report');
      return;
    }
    setRecipientNames(res.data?.recipientNames ?? []);
    setStage('done');
    router.refresh();
  }

  function closeAll() {
    setStage('closed');
    setError(null);
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {reportSentAt && (
          <span className="text-[11.5px] text-gray-400">
            Last sent {reportSentAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <Button type="button" onClick={() => setStage('confirm')} disabled={!hasClient} title={hasClient ? undefined : 'No client account is linked to this project yet'}>
          Send to Client
        </Button>
      </div>

      <Dialog open={stage === 'confirm'} onOpenChange={(open) => { if (!open) closeAll(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send report to client?</DialogTitle>
            <DialogDescription>
              This gives the client account on <strong>{projectName}</strong> access to view this exact report,
              with today&apos;s live progress.
            </DialogDescription>
          </DialogHeader>
          {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{error}</div>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
            <Button type="button" onClick={confirmSend} disabled={sending}>
              {sending ? 'Sending…' : 'Send Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stage === 'done'} onOpenChange={(open) => { if (!open) closeAll(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report sent</DialogTitle>
            <DialogDescription>
              {recipientNames.length > 0
                ? `${recipientNames.join(', ')} can now view this report.`
                : 'The client can now view this report.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button">Close</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
