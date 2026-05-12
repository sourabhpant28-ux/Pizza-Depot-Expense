-- ============================================================
-- Add store detail columns to the stores table
-- Run this in the Supabase SQL Editor before seeding
-- ============================================================

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS store_code    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS city          TEXT,
  ADD COLUMN IF NOT EXISTS province      TEXT,
  ADD COLUMN IF NOT EXISTS cluster_name  TEXT,
  ADD COLUMN IF NOT EXISTS cluster_code  TEXT;
