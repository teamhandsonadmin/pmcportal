-- ============================================================
-- One-off data migration: CompletionStatus 3-state -> 6-state
-- ============================================================
-- Run BEFORE updating prisma/schema.prisma's CompletionStatus enum and
-- before `npx prisma db push`. Remaps existing dependency_completions rows
-- from the old lowercase 3-state values to the new UPPER_CASE 6-state
-- values, per the clears/blocks rule:
--   old delivered    -> new YES        (clears)
--   old not_required -> new PROCEED    (clears)
--   old pending       -> new PENDING   (blocks / neutral default)
--
-- Postgres enums can't have values removed directly (no ALTER TYPE ...
-- DROP VALUE), and a column can't be set to a value that isn't yet a member
-- of its enum type — so new members must be added to the *existing* type
-- first, in their own statements (ADD VALUE can't be used in the same
-- transaction that adds it), before any row can be updated to hold them.
-- The old members (pending/delivered/not_required) are left in place here;
-- removing them is handled by `npx prisma db push` after this script runs
-- and confirms zero rows still reference the old values.
--
-- Safe to re-run: ADD VALUE IF NOT EXISTS, and the UPDATEs are no-ops once
-- rows have already been remapped.

ALTER TYPE "CompletionStatus" ADD VALUE IF NOT EXISTS 'YES';
ALTER TYPE "CompletionStatus" ADD VALUE IF NOT EXISTS 'NO';
ALTER TYPE "CompletionStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE "CompletionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "CompletionStatus" ADD VALUE IF NOT EXISTS 'REVISIONS';
ALTER TYPE "CompletionStatus" ADD VALUE IF NOT EXISTS 'PROCEED';

-- Remap existing rows. Run as a second pass (psql commits each of the
-- ADD VALUE statements above individually before reaching these, since
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that
-- added it).
UPDATE dependency_completions SET status = 'YES'     WHERE status = 'delivered';
UPDATE dependency_completions SET status = 'PROCEED' WHERE status = 'not_required';
UPDATE dependency_completions SET status = 'PENDING' WHERE status = 'pending';

-- Verification: must return zero rows once the remap is complete.
SELECT status, count(*) AS remaining_old_rows
FROM dependency_completions
WHERE status IN ('pending', 'delivered', 'not_required')
GROUP BY status;
