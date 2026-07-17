'use server';

import { getNeedsAttentionItems, getUpcomingTasksForNotifications } from '@/lib/data/notifications';

// Called directly from Header.tsx (a client component) on mount/refresh —
// same "call a server action straight from client state" pattern already
// used by BulkDeleteDialog's getBulkDeletePreview, not a new API route.
export async function getNotificationsPanelData() {
  const [needsAttention, upcoming] = await Promise.all([
    getNeedsAttentionItems(),
    getUpcomingTasksForNotifications(),
  ]);
  return { needsAttention, upcoming };
}
