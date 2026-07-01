-- Migration v9: RLS policies for supervisor/manager monitoring pages
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses DROP IF EXISTS)

-- 1. Supervisor dapat membaca supervisions kunjungan mereka sendiri
DROP POLICY IF EXISTS "Supervisor read supervisions" ON visit_supervisions;
CREATE POLICY "Supervisor read supervisions" ON visit_supervisions FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

-- 2. Manager dapat membaca semua supervisions
DROP POLICY IF EXISTS "Manager read supervisions" ON visit_supervisions;
CREATE POLICY "Manager read supervisions" ON visit_supervisions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);

-- 3. Supervisor dapat membaca checklists kunjungan mereka sendiri
DROP POLICY IF EXISTS "Supervisor read checklists" ON visit_checklists;
CREATE POLICY "Supervisor read checklists" ON visit_checklists FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits WHERE id = visit_id AND supervisor_id = auth.uid())
);

-- 4. Manager dapat membaca semua checklists
DROP POLICY IF EXISTS "Manager read checklists" ON visit_checklists;
CREATE POLICY "Manager read checklists" ON visit_checklists FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
