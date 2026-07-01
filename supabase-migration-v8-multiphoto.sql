-- Migration v8: Multi-photo evidence for follow-up
-- Run this in Supabase SQL Editor

ALTER TABLE visit_supervisions ADD COLUMN IF NOT EXISTS evidence_photos TEXT;
