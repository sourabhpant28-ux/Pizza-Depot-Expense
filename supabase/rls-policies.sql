-- ============================================================
-- RLS Policies — Marketing Fund Tracker
-- Internal tool: allow full anonymous read/write on all tables
-- Run this in the Supabase SQL Editor after schema.sql
-- ============================================================

-- STORES
CREATE POLICY "Allow all on stores"
  ON stores FOR ALL
  USING (true)
  WITH CHECK (true);

-- EXPENSES
CREATE POLICY "Allow all on expenses"
  ON expenses FOR ALL
  USING (true)
  WITH CHECK (true);

-- EXPENSE ALLOCATIONS
CREATE POLICY "Allow all on expense_allocations"
  ON expense_allocations FOR ALL
  USING (true)
  WITH CHECK (true);
