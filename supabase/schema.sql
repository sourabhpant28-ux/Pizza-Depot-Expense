-- ============================================================
-- Marketing Fund Tracker — Database Schema
-- ============================================================

-- ============================================================
-- 1. STORES
-- ============================================================
CREATE TABLE stores (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  location    TEXT,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL,
  category         TEXT,
  vendor           TEXT,
  total_amount     NUMERIC     NOT NULL,
  month            INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             INTEGER     NOT NULL,
  allocation_mode  TEXT        NOT NULL CHECK (allocation_mode IN ('equal_all', 'equal_selected', 'manual')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. EXPENSE ALLOCATIONS
-- ============================================================
CREATE TABLE expense_allocations (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id       UUID    NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  store_id         UUID    NOT NULL REFERENCES stores(id)   ON DELETE CASCADE,
  allocated_amount NUMERIC NOT NULL
);
