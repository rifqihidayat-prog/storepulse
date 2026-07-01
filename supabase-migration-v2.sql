-- ============================================
-- StorePulse v2 Migration
-- Execute all queries below in Supabase SQL Editor
-- ============================================

-- 1. ADD COORDINATES TO STORES
ALTER TABLE stores ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. ADD COLUMNS TO VISIT_CASH_CHECKS
ALTER TABLE visit_cash_checks ADD COLUMN IF NOT EXISTS initial_capital NUMERIC(12,0);
ALTER TABLE visit_cash_checks ADD COLUMN IF NOT EXISTS petty_cash_balance NUMERIC(12,0);

-- 3. ADD SOLD_STOCK TO VISIT_STOCK_CHECKS
ALTER TABLE visit_stock_checks ADD COLUMN IF NOT EXISTS sold_stock INTEGER DEFAULT 0;

-- 4. UPDATE FINDINGS QUALITY CONSTRAINT (ringan/berat instead of biasa/berkualitas)
ALTER TABLE visit_findings DROP CONSTRAINT IF EXISTS visit_findings_quality_check;
ALTER TABLE visit_findings ADD CONSTRAINT visit_findings_quality_check CHECK (quality IN ('ringan', 'berat'));

-- 5. ADD REVIEW NOTES TO VISITS
ALTER TABLE visits ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 6. CREATE VISIT_ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS visit_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE UNIQUE NOT NULL,
  selfie_photo_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'desktop')),
  is_location_match BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CREATE VISIT_CASH_DENOMINATIONS TABLE
CREATE TABLE IF NOT EXISTS visit_cash_denominations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE NOT NULL,
  denomination INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('coin', 'bill'))
);

-- 8. CREATE VISIT_FEEDBACK_ITEMS TABLE
CREATE TABLE IF NOT EXISTS visit_feedback_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE NOT NULL,
  finding_id UUID REFERENCES visit_findings ON DELETE CASCADE NOT NULL,
  photo_url TEXT,
  feedback_text TEXT,
  UNIQUE(visit_id, finding_id)
);

-- 9. RLS POLICIES FOR NEW TABLES
ALTER TABLE visit_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_cash_denominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read attendance" ON visit_attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert attendance" ON visit_attendance FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update attendance" ON visit_attendance FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read cash denom" ON visit_cash_denominations FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert cash denom" ON visit_cash_denominations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update cash denom" ON visit_cash_denominations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read feedback items" ON visit_feedback_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert feedback items" ON visit_feedback_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update feedback items" ON visit_feedback_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
