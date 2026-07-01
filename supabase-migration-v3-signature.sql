-- ============================================
-- StorePulse v3 Migration - Signature Column
-- Execute in Supabase SQL Editor
-- ============================================

-- 1. ADD SIGNATURE COLUMN TO PROFILES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature TEXT;

-- 2. RLS: Allow managers to update any profile (for setting signature)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Manager update all profiles' AND tablename = 'profiles') THEN
    CREATE POLICY "Manager update all profiles" ON profiles
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
      );
  END IF;
END $$;
