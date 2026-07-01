-- Migration v4: Add imbalance_percentage, oversold_items, photo_items_url, photo_dashboard_url to visit_stock_separation
-- Jalankan di Supabase SQL Editor

ALTER TABLE visit_stock_separation
  ADD COLUMN IF NOT EXISTS imbalance_percentage NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS oversold_items INTEGER,
  ADD COLUMN IF NOT EXISTS photo_items_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_dashboard_url TEXT;
