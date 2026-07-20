-- ============================================================
-- Push notifications for new/reopened client-approval items
-- ============================================================
-- Extends supabase/schema.sql's pattern (SECURITY DEFINER plpgsql
-- functions + AFTER triggers) to the mobile app's push-notification
-- feature. Like that file, tables/columns themselves are Prisma-managed
-- (see prisma/schema.prisma's UserProfile.expoPushToken); this file only
-- holds the Postgres-level logic Prisma can't express. Safe to re-run
-- (CREATE OR REPLACE / DROP IF EXISTS throughout). Apply via
-- `npx prisma db execute --file supabase/push-notifications.sql`.
--
-- Unlike schema.sql, this file DOES touch RLS/grants — those live here
-- (not schema.sql) because they govern the mobile app's Supabase/PostgREST
-- data path specifically, which schema.sql's own header explicitly
-- disclaims being in scope for admin-web's direct-Postgres connection.
-- The pre-existing RLS policies/grants/helper functions this file builds
-- on (current_app_role(), current_client_project_id(), the per-table
-- SELECT policies) were applied directly against this database in an
-- earlier pass and were not previously captured in any file — if you find
-- this comment before anyone's fixed that, treat pg_policies/
-- information_schema.role_table_grants as the actual source of truth for
-- everything this file doesn't itself define.
-- ============================================================

-- ── Let a signed-in user register their own device's push token ──────
-- Column-level GRANT (not just an RLS policy) so a compromised or buggy
-- client can only ever touch this one column on their own row — role,
-- status, client_project_id etc. stay completely unwritable from the
-- mobile app's anon-key + RLS data path regardless of what the policy
-- below allows at the row level.
GRANT UPDATE (expo_push_token) ON user_profiles TO authenticated;

DROP POLICY IF EXISTS "own profile push token updatable" ON user_profiles;
CREATE POLICY "own profile push token updatable" ON user_profiles
  FOR UPDATE TO authenticated
  USING (email = auth.jwt() ->> 'email')
  WITH CHECK (email = auth.jwt() ->> 'email');

-- ── Outbound HTTP from Postgres ────────────────────────────────────────
-- Postgres cannot make HTTP calls on its own; pg_net queues an async
-- request and a background worker performs it, so the trigger below never
-- blocks on the actual network round-trip to the Edge Function.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- The Edge Function relays to Expo's push API; it authenticates the call
-- with a Supabase service-role key. That key is a real secret and is
-- deliberately NOT in this file — it's stored in Supabase Vault under the
-- name below, seeded once via a disposable script (see the deployment
-- notes this was delivered with), never checked into source control.
-- The URL itself is not secret (same status as the anon key/project URL
-- already shipped inside the mobile app bundle) — it's already filled in
-- below with this project's actual Edge Function URL, derived from
-- NEXT_PUBLIC_SUPABASE_URL. If this project's Supabase URL ever changes,
-- update the net.http_post() call below to match.

CREATE OR REPLACE FUNCTION notify_client_pending_item(p_item_id UUID)
RETURNS void AS $$
DECLARE
  v_project_id UUID;
  v_item_label TEXT;
  v_task_name  TEXT;
  v_service_key TEXT;
  v_tokens TEXT[];
BEGIN
  SELECT w.project_id, di.item_label, ht.task_name
    INTO v_project_id, v_item_label, v_task_name
  FROM dependency_items di
  JOIN tasks ht ON ht.id = di.task_id
  JOIN works w ON w.id = ht.work_id
  WHERE di.id = p_item_id AND di.category = 'client';

  IF v_project_id IS NULL THEN
    RETURN; -- not a client-category item, or its task/work is missing
  END IF;

  SELECT array_agg(expo_push_token) INTO v_tokens
  FROM user_profiles
  WHERE role = 'client' AND client_project_id = v_project_id AND expo_push_token IS NOT NULL;

  IF v_tokens IS NULL OR array_length(v_tokens, 1) = 0 THEN
    RETURN; -- no client on this project has a registered device yet
  END IF;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'push_edge_function_key';

  PERFORM net.http_post(
    url := 'https://rkccoznjdexlgvzqkhgg.supabase.co/functions/v1/send-push-notification',
    body := jsonb_build_object(
      'tokens', to_jsonb(v_tokens),
      'title', 'Approval needed',
      'body', 'New item needs your approval: ' || v_item_label,
      'data', jsonb_build_object('itemId', p_item_id, 'taskName', v_task_name)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    timeout_milliseconds := 5000
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- "Needs attention" = anything except the two clearing statuses (YES,
-- PROCEED) — broadened from the original PENDING/REVISIONS-only condition
-- so ON_HOLD and NO (an active pause/decline, not just an unanswered item)
-- also trigger a push. Kept in exact sync with site-engineer-app's
-- dependencyAlerts.ts (NEEDS_ATTENTION_STATUSES) and admin-web's own
-- lib/data/notifications.ts — all three must move together.
--
-- A brand-new client-category item is implicitly PENDING the moment it's
-- created — no dependency_completions row exists yet at creation time (see
-- dependencyAlerts.ts's identical "no row yet = PENDING" convention on the
-- mobile side), so this is the only trigger that fires for that case.
--
-- Known consequence, not a bug: a task's checklist is seeded all at once
-- (all 6 categories' items inserted together), so a client can receive a
-- burst of several pushes right after a new task is created rather than
-- one combined notification. Not batched here since the prompt this was
-- built against asked for one push per item; revisit if that turns out to
-- be noisy in practice.
CREATE OR REPLACE FUNCTION trg_fn_notify_on_item_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category = 'client' THEN
    PERFORM notify_client_pending_item(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_item_created_notify ON dependency_items;
CREATE TRIGGER trg_item_created_notify
  AFTER INSERT ON dependency_items
  FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_on_item_created();

-- An existing item's completion (re-)enters PENDING/REVISIONS — e.g. staff
-- reopens something after reviewing it. Split into two triggers (rather
-- than one combined INSERT-OR-UPDATE trigger) because Postgres's WHEN
-- clause forbids referencing OLD at all on a pure-INSERT trigger, even to
-- check "OLD IS NULL" — a plain INSERT trigger's condition can only ever
-- reference NEW. Between the two, this is what actually prevents duplicate
-- notifications for a status that hasn't changed: the UPDATE trigger only
-- fires when the status value itself differs from before, never on a
-- same-value resave.
CREATE OR REPLACE FUNCTION trg_fn_notify_on_completion_reopened()
RETURNS TRIGGER AS $$
DECLARE v_category "DependencyCategory";
BEGIN
  SELECT category INTO v_category FROM dependency_items WHERE id = NEW.item_id;
  IF v_category = 'client' THEN
    PERFORM notify_client_pending_item(NEW.item_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_completion_reopened_notify ON dependency_completions;
DROP TRIGGER IF EXISTS trg_completion_created_notify ON dependency_completions;
DROP TRIGGER IF EXISTS trg_completion_status_change_notify ON dependency_completions;

CREATE TRIGGER trg_completion_created_notify
  AFTER INSERT ON dependency_completions
  FOR EACH ROW
  WHEN (NEW.status NOT IN ('YES', 'PROCEED'))
  EXECUTE FUNCTION trg_fn_notify_on_completion_reopened();

CREATE TRIGGER trg_completion_status_change_notify
  AFTER UPDATE OF status ON dependency_completions
  FOR EACH ROW
  WHEN (NEW.status NOT IN ('YES', 'PROCEED') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_fn_notify_on_completion_reopened();
