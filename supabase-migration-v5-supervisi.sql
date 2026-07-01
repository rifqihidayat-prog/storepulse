CREATE TABLE IF NOT EXISTS visit_supervisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
  checklist_item_name TEXT NOT NULL,
  area TEXT NOT NULL,
  deadline_date DATE NOT NULL,
  status TEXT DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
