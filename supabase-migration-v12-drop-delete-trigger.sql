-- Migration v12: Drop the redundant delete trigger from v11
-- Masalah: trigger `before_profile_delete` gagal karena tabel `store_staff` belum ada.
-- Solusi: drop trigger + function. ON DELETE CASCADE pada FK store_staff.profile_id sudah cukup.

DROP TRIGGER IF EXISTS before_profile_delete ON profiles;
DROP FUNCTION IF EXISTS delete_user_cascade;
