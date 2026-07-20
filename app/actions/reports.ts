'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentAdminProfile } from '@/lib/auth/current-admin';
import { getProjectClients } from '@/lib/data/report';
import type { ActionResult } from '@/lib/types/tasks';

export interface SendReportResult {
  recipientCount: number;
  recipientNames: string[];
}

// No outbound email or in-app notification system exists anywhere in this
// stack today (no Resend/SendGrid/SMTP configured, no Notification model —
// confirmed by a full repo grep before writing this). Building a real email
// integration for this one feature would mean picking a provider and adding
// a new API key/secret the project doesn't have yet — not something to do
// silently. What IS real and reusable: granting the client(s) access
// (Project.reportSentAt gates app/(client)/client/report/page.tsx, so the
// route is genuinely inaccessible until this runs) and a visible new nav
// tab in ClientLayoutShell once it's set — that's the actual, honest
// "notification" a client will see, the next time they open the app. If real
// email delivery is wanted, the simplest true addition would be Resend
// (a single API key + a plain fetch call, no SDK) — intentionally not added
// here without that key being provisioned first.
export async function sendReportToClient(projectId: string): Promise<ActionResult<SendReportResult>> {
  const admin = await getCurrentAdminProfile();
  if (!admin) return { success: false, error: 'Not authorized' };

  const [project, clients] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    getProjectClients(projectId),
  ]);
  if (!project) return { success: false, error: 'Project not found' };
  if (clients.length === 0) {
    return { success: false, error: 'No client account is linked to this project yet — add one under Access & Roles first.' };
  }

  await prisma.project.update({ where: { id: projectId }, data: { reportSentAt: new Date() } });

  await prisma.activityLog.create({
    data: {
      actionType: 'report_sent_to_client',
      payload: {
        projectId,
        projectName: project.name,
        sentBy: admin.id,
        recipientClientIds: clients.map((c) => c.id),
        recipientEmails: clients.map((c) => c.email),
      },
    },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}/report`);
  revalidatePath('/client/report');

  return {
    success: true,
    data: { recipientCount: clients.length, recipientNames: clients.map((c) => c.fullName) },
  };
}
