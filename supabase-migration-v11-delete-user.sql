-- Migration v11: DELETE policy for profiles table + cascading store_staff cleanup
-- Masalah: Manager tidak bisa hapus user karena tidak ada DELETE policy di RLS.
-- Solusi: Tambah policy DELETE untuk manager + hapus store_staff sebelum profile dihapus.

-- 1. Hapus relasi store_staff dulu (cascade)
CREATE OR REPLACE FUNCTION delete_user_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM store_staff WHERE profile_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER before_profile_delete
  BEFORE DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION delete_user_cascade();

-- 2. Policy DELETE untuk manager
CREATE POLICY "Manager delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );
