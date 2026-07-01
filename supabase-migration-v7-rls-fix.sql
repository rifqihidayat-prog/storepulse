-- Migration v7: Fix RLS policies for staff follow-up feature
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses DROP IF EXISTS)

-- 1. Staff dapat membaca visits untuk toko yang mereka assign
DROP POLICY IF EXISTS "Staff read visits" ON visits;
CREATE POLICY "Staff read visits" ON visits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM store_staff 
    WHERE store_id = visits.store_id AND profile_id = auth.uid()
  )
);

-- 2. Staff dapat membaca supervisions untuk toko mereka
DROP POLICY IF EXISTS "Staff read supervisions" ON visit_supervisions;
CREATE POLICY "Staff read supervisions" ON visit_supervisions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM visits WHERE id = visit_id AND EXISTS (
      SELECT 1 FROM store_staff 
      WHERE store_id = visits.store_id AND profile_id = auth.uid()
    )
  )
);

-- 3. Staff dapat mengupdate supervisions (tandai selesai, upload bukti)
DROP POLICY IF EXISTS "Staff update supervisions" ON visit_supervisions;
CREATE POLICY "Staff update supervisions" ON visit_supervisions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM visits WHERE id = visit_id AND EXISTS (
      SELECT 1 FROM store_staff 
      WHERE store_id = visits.store_id AND profile_id = auth.uid()
    )
  )
);

-- 4. Staff dapat membaca checklists (catatan & foto SPV)
DROP POLICY IF EXISTS "Staff read checklists" ON visit_checklists;
CREATE POLICY "Staff read checklists" ON visit_checklists FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM visits WHERE id = visit_id AND EXISTS (
      SELECT 1 FROM store_staff 
      WHERE store_id = visits.store_id AND profile_id = auth.uid()
    )
  )
);

-- 5. Aktifkan RLS di visit_supervisions (karena kita sudah menambahkan policy)
ALTER TABLE visit_supervisions ENABLE ROW LEVEL SECURITY;
