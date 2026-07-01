-- ============================================
-- StorePulse v2 Migration (Fixed - can re-run safely)
-- Execute ALL queries in Supabase SQL Editor
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

-- 9. RLS POLICIES FOR NEW TABLES (with IF NOT EXISTS safety)
ALTER TABLE visit_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_cash_denominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_feedback_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read attendance' AND tablename = 'visit_attendance') THEN
    CREATE POLICY "Read attendance" ON visit_attendance FOR SELECT USING (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Insert attendance' AND tablename = 'visit_attendance') THEN
    CREATE POLICY "Insert attendance" ON visit_attendance FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Update attendance' AND tablename = 'visit_attendance') THEN
    CREATE POLICY "Update attendance" ON visit_attendance FOR UPDATE USING (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read cash denom' AND tablename = 'visit_cash_denominations') THEN
    CREATE POLICY "Read cash denom" ON visit_cash_denominations FOR SELECT USING (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Insert cash denom' AND tablename = 'visit_cash_denominations') THEN
    CREATE POLICY "Insert cash denom" ON visit_cash_denominations FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Update cash denom' AND tablename = 'visit_cash_denominations') THEN
    CREATE POLICY "Update cash denom" ON visit_cash_denominations FOR UPDATE USING (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read feedback items' AND tablename = 'visit_feedback_items') THEN
    CREATE POLICY "Read feedback items" ON visit_feedback_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Insert feedback items' AND tablename = 'visit_feedback_items') THEN
    CREATE POLICY "Insert feedback items" ON visit_feedback_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Update feedback items' AND tablename = 'visit_feedback_items') THEN
    CREATE POLICY "Update feedback items" ON visit_feedback_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
    );
  END IF;
END $$;
