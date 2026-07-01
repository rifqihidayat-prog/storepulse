-- ============================================
-- StorePulse Database Schema for Supabase
-- Execute this in Supabase SQL Editor
-- ============================================

-- 1. PROFILES TABLE
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('supervisor', 'manager')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STORES TABLE
CREATE TABLE stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. VISITS TABLE
CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores NOT NULL,
  supervisor_id UUID REFERENCES profiles NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'revision')),
  manager_id UUID REFERENCES profiles,
  manager_note TEXT,
  total_score NUMERIC(5,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CASH CHECKS
CREATE TABLE visit_cash_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE UNIQUE NOT NULL,
  cashier_amount NUMERIC(12,0),
  petty_cash_amount NUMERIC(12,0),
  cashier_is_match BOOLEAN,
  petty_cash_is_match BOOLEAN,
  note TEXT
);

-- 5. DEPOSIT VALIDATIONS
CREATE TABLE visit_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE UNIQUE NOT NULL,
  has_pending BOOLEAN,
  photo_url TEXT,
  note TEXT
);

-- 6. STORE CHECKLISTS
CREATE TABLE visit_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('baik', 'kurang', 'buruk'))
);

-- 7. STOCK CHECKS (5 items)
CREATE TABLE visit_stock_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  system_stock INTEGER NOT NULL,
  physical_stock INTEGER NOT NULL,
  is_match BOOLEAN
);

-- 8. FINDINGS
CREATE TABLE visit_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  quality TEXT CHECK (quality IN ('berkualitas', 'biasa'))
);

-- 9. BRIEFINGS
CREATE TABLE visit_briefings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE UNIQUE NOT NULL,
  photo_url TEXT,
  note TEXT
);

-- 10. FEEDBACKS
CREATE TABLE visit_feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE UNIQUE NOT NULL,
  photo_url TEXT,
  feedback_text TEXT
);

-- 11. CHAT MARKETPLACE
CREATE TABLE visit_chat_marketplace (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE NOT NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('tiktok', 'shopee')),
  percentage NUMERIC(5,1),
  photo_url TEXT
);

-- 12. STOCK SEPARATION
CREATE TABLE visit_stock_separation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits ON DELETE CASCADE UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sehat', 'perhatian', 'kritis')),
  imbalance_percentage NUMERIC(5,1),
  oversold_items INTEGER,
  photo_url TEXT,
  photo_items_url TEXT,
  photo_dashboard_url TEXT,
  note TEXT
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_cash_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_chat_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_stock_separation ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update their own
CREATE POLICY "Read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Stores: all authenticated users can CRUD
CREATE POLICY "Read stores" ON stores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert stores" ON stores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Update stores" ON stores FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Delete stores" ON stores FOR DELETE USING (auth.role() = 'authenticated');

-- Visits: supervisors see their own, managers see all
CREATE POLICY "Read visits" ON visits FOR SELECT USING (
  auth.uid() = supervisor_id OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "Insert visits" ON visits FOR INSERT WITH CHECK (auth.uid() = supervisor_id);
CREATE POLICY "Update visits" ON visits FOR UPDATE USING (
  auth.uid() = supervisor_id OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);

-- Cascade policies for child tables
CREATE POLICY "Read cash checks" ON visit_cash_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert cash checks" ON visit_cash_checks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update cash checks" ON visit_cash_checks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read deposits" ON visit_deposits FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert deposits" ON visit_deposits FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update deposits" ON visit_deposits FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

-- (Similar policies for all child tables - simplified pattern)
CREATE POLICY "Read checklists" ON visit_checklists FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert checklists" ON visit_checklists FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update checklists" ON visit_checklists FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read stock checks" ON visit_stock_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert stock checks" ON visit_stock_checks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update stock checks" ON visit_stock_checks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read findings" ON visit_findings FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert findings" ON visit_findings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update findings" ON visit_findings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read briefings" ON visit_briefings FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert briefings" ON visit_briefings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update briefings" ON visit_briefings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read feedbacks" ON visit_feedbacks FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert feedbacks" ON visit_feedbacks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update feedbacks" ON visit_feedbacks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read chat marketplace" ON visit_chat_marketplace FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert chat marketplace" ON visit_chat_marketplace FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update chat marketplace" ON visit_chat_marketplace FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

CREATE POLICY "Read stock separation" ON visit_stock_separation FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND (supervisor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')))
);
CREATE POLICY "Insert stock separation" ON visit_stock_separation FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);
CREATE POLICY "Update stock separation" ON visit_stock_separation FOR UPDATE USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

-- ============================================
-- STORAGE BUCKET
-- ============================================
-- Run this in Supabase Storage:
-- Create bucket 'visit-photos'
-- Set public access

-- ============================================
-- AUTO-UPDATE UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
