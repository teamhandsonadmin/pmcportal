-- ============================================================
-- Row Level Security — client-portal read/write policies
-- ============================================================
-- These govern the mobile app's Supabase/PostgREST data path (client role),
-- same reasoning as supabase/push-notifications.sql's own header: schema.sql
-- explicitly disclaims RLS as out of scope for admin-web's direct-Postgres
-- connection, so it lives here instead.
--
-- IMPORTANT — these were NOT previously captured in any file. They were
-- applied directly against the database in an earlier, undocumented pass
-- (see push-notifications.sql's own comment, which already flagged this).
-- This file is a first-time capture of what was found live via pg_policies,
-- written down now specifically because the tasks/hvac_tasks rename showed
-- exactly why that gap is dangerous: a plain ALTER TABLE RENAME silently
-- keeps these policies working (Postgres tracks policy expressions by OID,
-- not by literal text, so pg_policies already read "tasks" automatically
-- the moment the rename happened) — but nothing forced anyone to notice
-- that, or to fix the policy NAME below, which still said "hvac_tasks"
-- until this pass. Keep this file in sync with the live database from now
-- on; do not let it drift back into being undocumented.
--
-- Apply via: npx prisma db execute --file supabase/rls-policies.sql
-- Safe to re-run (DROP POLICY IF EXISTS / CREATE OR REPLACE throughout).
-- ============================================================

-- ── Helper functions (also previously undocumented) ──────────────────────
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select role::text from user_profiles where email = auth.jwt() ->> 'email' limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_client_project_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select client_project_id from user_profiles
  where email = auth.jwt() ->> 'email' and role = 'client'
  limit 1;
$function$;

-- ── tasks ─────────────────────────────────────────────────────────────
-- Renamed from "hvac_tasks readable by staff or own client" — same
-- underlying rule, just the policy's own name no longer refers to the old
-- table name now that hvac_tasks -> tasks.
DROP POLICY IF EXISTS "hvac_tasks readable by staff or own client" ON tasks;
DROP POLICY IF EXISTS "tasks readable by staff or own client" ON tasks;
CREATE POLICY "tasks readable by staff or own client" ON tasks
  FOR SELECT TO authenticated
  USING (
    current_app_role() <> 'client'
    OR work_id IN (SELECT works.id FROM works WHERE works.project_id = current_client_project_id())
  );

-- ── dependency_items ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "dependency_items readable by staff or own client" ON dependency_items;
CREATE POLICY "dependency_items readable by staff or own client" ON dependency_items
  FOR SELECT TO authenticated
  USING (
    current_app_role() <> 'client'
    OR task_id IN (
      SELECT ht.id FROM tasks ht JOIN works w ON w.id = ht.work_id
      WHERE w.project_id = current_client_project_id()
    )
  );

-- ── dependency_completions ────────────────────────────────────────────
DROP POLICY IF EXISTS "dependency_completions readable by staff or own client" ON dependency_completions;
CREATE POLICY "dependency_completions readable by staff or own client" ON dependency_completions
  FOR SELECT TO authenticated
  USING (
    current_app_role() <> 'client'
    OR item_id IN (
      SELECT di.id FROM dependency_items di
      JOIN tasks ht ON ht.id = di.task_id
      JOIN works w ON w.id = ht.work_id
      WHERE w.project_id = current_client_project_id()
    )
  );

DROP POLICY IF EXISTS "client can update their own client-category responses" ON dependency_completions;
CREATE POLICY "client can update their own client-category responses" ON dependency_completions
  FOR UPDATE TO authenticated
  USING (
    current_app_role() = 'client'
    AND item_id IN (
      SELECT di.id FROM dependency_items di
      JOIN tasks ht ON ht.id = di.task_id
      JOIN works w ON w.id = ht.work_id
      WHERE di.category = 'client' AND w.project_id = current_client_project_id()
    )
  )
  WITH CHECK (
    current_app_role() = 'client'
    AND item_id IN (
      SELECT di.id FROM dependency_items di
      JOIN tasks ht ON ht.id = di.task_id
      JOIN works w ON w.id = ht.work_id
      WHERE di.category = 'client' AND w.project_id = current_client_project_id()
    )
  );

DROP POLICY IF EXISTS "client can create their own client-category responses" ON dependency_completions;
CREATE POLICY "client can create their own client-category responses" ON dependency_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() = 'client'
    AND item_id IN (
      SELECT di.id FROM dependency_items di
      JOIN tasks ht ON ht.id = di.task_id
      JOIN works w ON w.id = ht.work_id
      WHERE di.category = 'client' AND w.project_id = current_client_project_id()
    )
  );

-- ── user_profiles ─────────────────────────────────────────────────────
-- Unrelated to the tasks rename — included here only because it was the
-- same "undocumented, live-only" situation; captured for completeness now
-- that this file exists.
DROP POLICY IF EXISTS "own profile readable" ON user_profiles;
CREATE POLICY "own profile readable" ON user_profiles
  FOR SELECT TO authenticated
  USING (email = auth.jwt() ->> 'email');
