-- ============================================================
-- Fix 3 store names to match the authoritative Excel file:
--   "Store codes for Invoices (003)"
--
-- Run this in the Supabase SQL Editor if stores have already
-- been seeded (i.e. npx tsx scripts/seed-stores.ts was run
-- before this patch).
-- ============================================================

UPDATE stores
SET name = 'Tecumseh Rd Pizza Depot 3 - WINDSOR'
WHERE store_code = 'TCMH40';

UPDATE stores
SET name = 'Howard Pizza Depot 4 - WINDSOR'
WHERE store_code = 'HWRD41';

UPDATE stores
SET name = 'Roblin Pizza Depot -Charleswood'
WHERE store_code = 'ROB04';

-- Verify
SELECT store_code, name
FROM stores
WHERE store_code IN ('TCMH40', 'HWRD41', 'ROB04')
ORDER BY store_code;
