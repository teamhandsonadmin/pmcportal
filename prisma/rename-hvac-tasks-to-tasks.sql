-- ============================================================
-- One-time rename: hvac_tasks -> tasks
-- ============================================================
-- The central task table was named hvac_tasks for historical reasons (this
-- app originally only tracked HVAC-trade tasks before growing to cover every
-- trade). This performs a true in-place rename — ALTER TABLE ... RENAME TO —
-- which Postgres handles by updating the table's name while leaving its
-- OID, all rows, all foreign keys, and all indexes completely untouched.
-- This is NOT a drop-and-recreate; no data migration step is needed because
-- none of the actual data moves.
--
-- Apply via: npx prisma db execute --file prisma/rename-hvac-tasks-to-tasks.sql
-- Safe to run only once — re-running after the rename has already happened
-- will fail with "relation hvac_tasks does not exist", which is the correct,
-- obvious signal that it's already done (not silently re-run via CREATE OR
-- REPLACE the way supabase/schema.sql's functions are).
-- ============================================================

ALTER TABLE hvac_tasks RENAME TO tasks;
