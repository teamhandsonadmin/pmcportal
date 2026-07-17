-- ============================================================
-- Realtime publication membership
-- ============================================================
-- A table must be added to the `supabase_realtime` publication before any
-- client can subscribe to postgres_changes on it — this is a server-side
-- prerequisite the client-side `.channel(...).on('postgres_changes', ...)`
-- code alone does nothing without. RLS (already enabled on this table, see
-- the policies applied earlier in this project's history) is what then
-- scopes WHICH rows each subscriber actually receives — confirmed live
-- against this project (not assumed): a client-role subscriber only ever
-- received change events for their own project's rows in a disposable
-- two-project test; see the mobile app's realtime hook for the client code.
--
-- daily_progress_reports / daily_progress_report_photos were already in
-- this publication before this file existed (added manually via the
-- Supabase Dashboard for the admin-web DprRealtimeRefresher feature — not
-- previously captured in any checked-in file, same undocumented-drift
-- situation as the RLS policies push-notifications.sql's header already
-- flags). This file exists so future additions to this publication are
-- version-controlled instead of another dashboard-only change.
-- Apply via `npx prisma db execute --file supabase/realtime.sql`. Safe to
-- re-run — ADD TABLE is a no-op (raises a notice, not an error) if the
-- table is already a publication member... actually it raises an error if
-- already a member, hence the guard below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'dependency_completions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dependency_completions;
  END IF;
END $$;

-- Needed for the mobile app's force-logout kill-switch (see
-- lib/forceLogoutWatch.ts) — a signed-in device subscribes to its own
-- user_profiles row so a change to force_logout_at is received while the
-- app is open, on top of the existing "own profile readable" RLS policy
-- that already scopes what any subscriber can see here.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
  END IF;
END $$;
