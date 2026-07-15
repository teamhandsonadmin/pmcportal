'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Headless — subscribes to changes on the two DPR tables and re-runs the
// server component's own data fetch via router.refresh() instead of
// building a separate client-side fetching/caching layer. Debounced because
// one DPR submission is itself several row changes (the report, plus one
// insert per photo) that should collapse into a single refetch.
export function DprRealtimeRefresher() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function scheduleRefresh() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => router.refresh(), 500);
    }

    const channel = supabase
      .channel('dpr-admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_progress_reports' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_progress_report_photos' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
