-- Migration: Tambah kolom untuk bon klaim
ALTER TABLE visit_cash_checks ADD COLUMN IF NOT EXISTS has_pending_claim BOOLEAN DEFAULT FALSE;
ALTER TABLE visit_cash_checks ADD COLUMN IF NOT EXISTS pending_claim_amount NUMERIC DEFAULT 0;

-- Migration: Tambah kolom untuk catatan, foto, dan area pada checklist
ALTER TABLE visit_checklists ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
ALTER TABLE visit_checklists ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE visit_checklists ADD COLUMN IF NOT EXISTS area TEXT DEFAULT 'exterior';
