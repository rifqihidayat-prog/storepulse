-- 1. Store staff junction table
CREATE TABLE IF NOT EXISTS store_staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, profile_id)
);

-- 2. Evidence columns for supervisions
ALTER TABLE visit_supervisions ADD COLUMN IF NOT EXISTS evidence_photo_url TEXT;
ALTER TABLE visit_supervisions ADD COLUMN IF NOT EXISTS completed_note TEXT;

-- 3. Enable RLS on store_staff
ALTER TABLE store_staff ENABLE ROW LEVEL SECURITY;

-- 4. Allow staff to read their own assignments
CREATE POLICY "Staff can read own assignments" ON store_staff
  FOR SELECT USING (profile_id = auth.uid());
