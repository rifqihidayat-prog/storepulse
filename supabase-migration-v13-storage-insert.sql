-- Migration v13: Allow all authenticated users to INSERT into visit-photos bucket
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses DROP IF EXISTS)

-- Hapus policy lama yang terbatas ke follow-up/ folder
DROP POLICY IF EXISTS "Staff upload follow-up photos" ON storage.objects;

-- Policy baru: semua authenticated user bisa upload ke bucket visit-photos (path apapun)
CREATE POLICY "Authenticated upload visit photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visit-photos');
