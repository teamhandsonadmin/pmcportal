-- ============================================================
-- HVAC Workflow Module — Postgres-level business logic
-- ============================================================
-- Tables, enums, indexes, and foreign keys are managed by Prisma
-- (see prisma/schema.prisma, applied via `npx prisma db push`).
-- This file only holds logic Prisma cannot express: the DB-authoritative
-- task status recalculation trigger. Re-run this file (via
-- `npx prisma db execute --file supabase/schema.sql`) whenever it changes;
-- it is safe to re-run (everything is CREATE OR REPLACE / DROP IF EXISTS).
--
-- Note: the app connects to Postgres directly via Prisma (DATABASE_URL),
-- not through Supabase's PostgREST/RLS layer, so Row Level Security
-- policies are not part of this app's data path and are intentionally
-- not defined here.
-- ============================================================

-- ── Status recalculation ──────────────────────────────────────
-- A task becomes "ready" once all 6 mandatory dependency categories are
-- fully delivered (or explicitly marked not_required), and falls back to
-- "blocked" if it regresses. Tasks with fewer than 6 categories seeded
-- stay in "draft". in_progress / on_hold / completed are never touched here
-- — those are user-driven transitions (see app/actions/hvac-tasks.ts).
CREATE OR REPLACE FUNCTION recalculate_task_status(p_task_id UUID)
RETURNS void AS $$
DECLARE
  v_status       "TaskStatus";
  v_cat_count    INTEGER;
  v_all_complete BOOLEAN;
BEGIN
  SELECT status INTO v_status FROM hvac_tasks WHERE id = p_task_id;
  IF v_status IS NULL OR v_status IN ('in_progress', 'on_hold', 'completed') THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT category) INTO v_cat_count
  FROM dependency_items
  WHERE task_id = p_task_id AND is_mandatory = true;

  IF v_cat_count < 6 THEN
    UPDATE hvac_tasks SET status = 'draft' WHERE id = p_task_id AND status <> 'draft';
    RETURN;
  END IF;

  -- COALESCE the missing completion row to 'pending' before the IN check —
  -- an item that has never been touched has no dependency_completions row
  -- at all, so dc.status is NULL. BOOL_AND() silently skips NULL inputs
  -- rather than treating them as false, so a category where every item is
  -- still untouched was incorrectly reported as complete whenever it wasn't
  -- the only category (the untouched-NULL rows just got ignored, not AND-ed
  -- in as incomplete).
  SELECT COALESCE(BOOL_AND(cat_complete), false) INTO v_all_complete
  FROM (
    SELECT di.category, BOOL_AND(COALESCE(dc.status::text, 'pending') IN ('delivered', 'not_required')) AS cat_complete
    FROM dependency_items di
    LEFT JOIN dependency_completions dc ON dc.item_id = di.id
    WHERE di.task_id = p_task_id AND di.is_mandatory = true
    GROUP BY di.category
  ) sub;

  IF v_all_complete THEN
    UPDATE hvac_tasks SET status = 'ready' WHERE id = p_task_id AND status IN ('draft', 'blocked');
  ELSE
    UPDATE hvac_tasks SET status = 'blocked' WHERE id = p_task_id AND status IN ('draft', 'ready');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fires whenever a checklist item's completion status changes.
CREATE OR REPLACE FUNCTION trg_fn_recalc_status_on_completion()
RETURNS TRIGGER AS $$
DECLARE v_task_id UUID;
BEGIN
  SELECT task_id INTO v_task_id FROM dependency_items WHERE id = NEW.item_id;
  IF v_task_id IS NOT NULL THEN
    PERFORM recalculate_task_status(v_task_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_completion_status_recalc ON dependency_completions;
CREATE TRIGGER trg_completion_status_recalc
  AFTER INSERT OR UPDATE OF status ON dependency_completions
  FOR EACH ROW EXECUTE FUNCTION trg_fn_recalc_status_on_completion();

-- Fires when checklist items themselves are added/removed (e.g. a template
-- is applied to a project and backfills missing items onto existing tasks).
CREATE OR REPLACE FUNCTION trg_fn_recalc_status_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_task_status(OLD.task_id);
  ELSE
    PERFORM recalculate_task_status(NEW.task_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_item_change_recalc ON dependency_items;
CREATE TRIGGER trg_item_change_recalc
  AFTER INSERT OR DELETE ON dependency_items
  FOR EACH ROW EXECUTE FUNCTION trg_fn_recalc_status_on_item_change();
