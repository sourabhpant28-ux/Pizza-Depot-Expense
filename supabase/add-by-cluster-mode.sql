-- ============================================================
-- Add 'by_cluster' to the allocation_mode CHECK constraint
-- Run this in the Supabase SQL Editor before using the new mode
-- ============================================================

-- Drop the existing constraint (auto-named by Postgres)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_allocation_mode_check;

-- Recreate it with by_cluster included
ALTER TABLE expenses
  ADD CONSTRAINT expenses_allocation_mode_check
  CHECK (allocation_mode IN ('equal_all', 'equal_selected', 'manual', 'by_cluster'));
