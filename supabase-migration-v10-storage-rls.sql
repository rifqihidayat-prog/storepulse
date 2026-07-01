-- Migration v10: Storage RLS for staff uploads
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses DROP IF EXISTS)

-- 1. Staff dapat upload foto ke folder follow-up/
DROP POLICY IF EXISTS "Staff upload follow-up photos" ON storage.objects;
CREATE POLICY "Staff upload follow-up photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos' AND
    (storage.foldername(name))[1] = 'follow-up'
  );

-- 2. Semua user authenticated dapat membaca foto
DROP POLICY IF EXISTS "Public read visit photos" ON storage.objects;
CREATE POLICY "Public read visit photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'visit-photos');
