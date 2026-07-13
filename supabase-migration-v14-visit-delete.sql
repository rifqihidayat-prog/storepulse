-- Migration v14: RLS DELETE policy for manager on visits table
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses DROP IF EXISTS)

DROP POLICY IF EXISTS "Manager delete visits" ON visits;
CREATE POLICY "Manager delete visits" ON visits
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));
