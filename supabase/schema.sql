-- ============================================================
-- HVAC Workflow Module — PostgreSQL Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enums
CREATE TYPE task_status AS ENUM (
  'draft', 'ready', 'in_progress', 'on_hold', 'blocked', 'completed'
);

CREATE TYPE dependency_category AS ENUM (
  'architect', 'client', 'consultant', 'contractor'
);

-- ── hvac_tasks ────────────────────────────────────────────────
CREATE TABLE hvac_tasks (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      VARCHAR(20)   UNIQUE NOT NULL,
  task_name    TEXT          NOT NULL,
  project_name TEXT          NOT NULL,
  description  TEXT,
  status       task_status   NOT NULL DEFAULT 'draft',
  created_by   UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  due_date     DATE,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_task_id CHECK (task_id ~ '^HVAC-\d{3,}$')
);

-- ── dependency_items ──────────────────────────────────────────
CREATE TABLE dependency_items (
  id           UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID                 NOT NULL REFERENCES hvac_tasks(id) ON DELETE CASCADE,
  category     dependency_category  NOT NULL,
  item_label   TEXT                 NOT NULL,
  is_mandatory BOOLEAN              NOT NULL DEFAULT true,
  sort_order   SMALLINT             NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- ── dependency_completions ────────────────────────────────────
CREATE TABLE dependency_completions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID         NOT NULL REFERENCES dependency_items(id) ON DELETE CASCADE,
  is_completed BOOLEAN      NOT NULL DEFAULT false,
  comment      TEXT,
  completed_by UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (item_id)
);

-- ── activity_log ──────────────────────────────────────────────
CREATE TABLE activity_log (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID         NOT NULL REFERENCES hvac_tasks(id) ON DELETE CASCADE,
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type VARCHAR(50)  NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_tasks_status      ON hvac_tasks             (status);
CREATE INDEX idx_tasks_project     ON hvac_tasks             (project_name);
CREATE INDEX idx_dep_items_task    ON dependency_items        (task_id, category);
CREATE INDEX idx_dep_comps_item    ON dependency_completions  (item_id);
CREATE INDEX idx_activity_task     ON activity_log            (task_id, created_at DESC);
CREATE INDEX idx_activity_recent   ON activity_log            (created_at DESC);

-- ── Auto task ID ──────────────────────────────────────────────
CREATE SEQUENCE hvac_task_seq START 1;

CREATE OR REPLACE FUNCTION generate_hvac_task_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.task_id := 'HVAC-' || LPAD(nextval('hvac_task_seq')::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_task_id
  BEFORE INSERT ON hvac_tasks
  FOR EACH ROW
  WHEN (NEW.task_id IS NULL)
  EXECUTE FUNCTION generate_hvac_task_id();

-- ── updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON hvac_tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_comps_updated_at
  BEFORE UPDATE ON dependency_completions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Views ─────────────────────────────────────────────────────
CREATE VIEW task_dependency_progress AS
SELECT
  di.task_id,
  di.category,
  COUNT(*)                                                          AS total_items,
  COUNT(*) FILTER (WHERE dc.is_completed = true)                    AS completed_items,
  ROUND(
    COUNT(*) FILTER (WHERE dc.is_completed = true)::numeric
    / NULLIF(COUNT(*), 0) * 100
  )                                                                 AS completion_pct,
  BOOL_AND(dc.is_completed)                                         AS category_complete
FROM dependency_items di
LEFT JOIN dependency_completions dc ON dc.item_id = di.id
WHERE di.is_mandatory = true
GROUP BY di.task_id, di.category;

CREATE VIEW hvac_dashboard_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'ready')       AS ready_count,
  COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
  COUNT(*) FILTER (WHERE status = 'blocked')     AS blocked_count,
  COUNT(*) FILTER (WHERE status = 'completed')   AS completed_count,
  COUNT(*)                                        AS total_count
FROM hvac_tasks;

-- ── Status recalculation ──────────────────────────────────────
CREATE OR REPLACE FUNCTION recalculate_task_status(p_task_id UUID)
RETURNS void AS $$
DECLARE
  v_all_complete BOOLEAN;
  v_status       task_status;
  v_cat_count    INTEGER;
BEGIN
  SELECT status INTO v_status FROM hvac_tasks WHERE id = p_task_id;
  IF v_status = 'completed' THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_cat_count
  FROM (SELECT DISTINCT category FROM dependency_items
        WHERE task_id = p_task_id AND is_mandatory = true) cats;

  IF v_cat_count < 4 THEN
    UPDATE hvac_tasks SET status = 'draft' WHERE id = p_task_id
      AND status NOT IN ('in_progress','on_hold','completed');
    RETURN;
  END IF;

  SELECT (COUNT(*) = 4 AND BOOL_AND(category_complete))
  INTO   v_all_complete
  FROM   task_dependency_progress
  WHERE  task_id = p_task_id;

  IF v_all_complete IS TRUE THEN
    UPDATE hvac_tasks SET status = 'ready'
    WHERE id = p_task_id AND status IN ('draft', 'blocked');
  ELSE
    UPDATE hvac_tasks SET status = 'blocked'
    WHERE id = p_task_id AND status IN ('draft', 'ready');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trg_fn_recalc_status()
RETURNS TRIGGER AS $$
DECLARE v_task_id UUID;
BEGIN
  SELECT task_id INTO v_task_id FROM dependency_items WHERE id = NEW.item_id;
  PERFORM recalculate_task_status(v_task_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_completion_status_recalc
  AFTER INSERT OR UPDATE OF is_completed ON dependency_completions
  FOR EACH ROW EXECUTE FUNCTION trg_fn_recalc_status();

-- ── RLS Policies ──────────────────────────────────────────────
ALTER TABLE hvac_tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log           ENABLE ROW LEVEL SECURITY;

-- hvac_tasks
CREATE POLICY "tasks: read all authenticated"
  ON hvac_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks: insert own"
  ON hvac_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "tasks: update non-completed"
  ON hvac_tasks FOR UPDATE TO authenticated
  USING (status <> 'completed') WITH CHECK (status <> 'completed');

-- dependency_items
CREATE POLICY "dep_items: read all"
  ON dependency_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "dep_items: insert"
  ON dependency_items FOR INSERT TO authenticated WITH CHECK (true);

-- dependency_completions
CREATE POLICY "dep_comp: read all"
  ON dependency_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dep_comp: upsert on open tasks"
  ON dependency_completions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dependency_items di
      JOIN hvac_tasks ht ON ht.id = di.task_id
      WHERE di.id = dependency_completions.item_id
        AND ht.status <> 'completed'
    )
  );

-- activity_log
CREATE POLICY "activity: read all"
  ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity: insert own"
  ON activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ── Default checklist items (seed) ───────────────────────────
-- Call this function after creating each task to populate default items.
CREATE OR REPLACE FUNCTION seed_default_dependency_items(p_task_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO dependency_items (task_id, category, item_label, sort_order) VALUES
    -- Architect
    (p_task_id, 'architect', 'HVAC drawings submitted',           1),
    (p_task_id, 'architect', 'HVAC drawings approved',            2),
    (p_task_id, 'architect', 'Structural coordination completed', 3),
    (p_task_id, 'architect', 'Ceiling layout approved',           4),
    (p_task_id, 'architect', 'Final architect signoff',           5),
    -- Client
    (p_task_id, 'client', 'Budget approved',                      1),
    (p_task_id, 'client', 'Material selection approved',          2),
    (p_task_id, 'client', 'Design approval completed',            3),
    (p_task_id, 'client', 'Change requests cleared',              4),
    (p_task_id, 'client', 'Final client signoff',                 5),
    -- Consultant
    (p_task_id, 'consultant', 'HVAC design reviewed',             1),
    (p_task_id, 'consultant', 'Technical approval received',      2),
    (p_task_id, 'consultant', 'Load calculations approved',       3),
    (p_task_id, 'consultant', 'Safety compliance approved',       4),
    (p_task_id, 'consultant', 'Consultant signoff',               5),
    -- Contractor
    (p_task_id, 'contractor', 'Contractor assigned',              1),
    (p_task_id, 'contractor', 'Team mobilized',                   2),
    (p_task_id, 'contractor', 'Equipment available',              3),
    (p_task_id, 'contractor', 'Site readiness confirmed',         4),
    (p_task_id, 'contractor', 'Work permit approved',             5);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
