-- ============================================================
-- PaulFolio — Supabase Database Schema
-- Jalankan file ini di Supabase SQL Editor (Dashboard > SQL Editor)
-- File ini idempotent: aman dijalankan berkali-kali
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'designer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image TEXT,
  tech_stack TEXT[],
  client TEXT,
  period TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CONTACT MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill is_read untuk baris lama (aman diulang)
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4b. HELPER: is_admin()
--
-- WAJIB dipakai oleh semua policy yang perlu mengecek role admin.
--
-- Kenapa tidak boleh query langsung `SELECT ... FROM profiles` di dalam
-- policy pada tabel `profiles`? Policy di-OR-kan, jadi Postgres selalu
-- mengevaluasi policy admin itu juga. Subquery ke `profiles` akan memicu
-- RLS `profiles` lagi secara rekursif dan menghasilkan error:
--     42P17: infinite recursion detected in policy for relation "profiles"
-- Akibatnya admin tidak bisa membaca user lain, dan guard admin ikut gagal.
--
-- Solusinya: bungkus pengecekan dalam function SECURITY DEFINER. Function
-- ini dieksekusi dengan hak pemilik (postgres), dan RLS tidak berlaku untuk
-- owning role selama RLS tidak di-FORCE, sehingga tidak ada rekursi.
--
-- `SET search_path` di-pin agar aman dari path-search hijacking.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- Sama seperti is_admin(), tapi untuk user yang hanya bisa read.
-- Dipakai dashboard agar statistik user tetap bisa dimuat.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ============================================================
-- 5. PROFILES POLICIES (drop dulu agar idempotent)
-- ============================================================
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete all profiles" ON profiles;
CREATE POLICY "Admins can delete all profiles" ON profiles
  FOR DELETE USING (public.is_admin());

-- Catatan: pencegahan admin menurunkan role-nya sendiri dilakukan di sisi
-- aplikasi (admin.js), bukan lewat policy, supaya policy tetap sederhana.

-- ============================================================
-- 6. PROJECTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read projects" ON projects;
CREATE POLICY "Anyone can read projects" ON projects
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert projects" ON projects;
CREATE POLICY "Admins can insert projects" ON projects
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update projects" ON projects;
CREATE POLICY "Admins can update projects" ON projects
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
CREATE POLICY "Admins can delete projects" ON projects
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 7. CONTACT MESSAGES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert messages" ON contact_messages;
CREATE POLICY "Anyone can insert messages" ON contact_messages
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read messages" ON contact_messages;
CREATE POLICY "Admins can read messages" ON contact_messages
  FOR SELECT USING (public.is_admin());

-- UPDATE hanya dipakai untuk menandai pesan sudah dibaca / belum dibaca.
DROP POLICY IF EXISTS "Admins can update messages" ON contact_messages;
CREATE POLICY "Admins can update messages" ON contact_messages
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete messages" ON contact_messages;
CREATE POLICY "Admins can delete messages" ON contact_messages
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 8. TRIGGER: Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 9. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_is_read ON contact_messages(is_read);

-- ============================================================
-- 10. STORAGE: bucket untuk gambar proyek
--
-- Bucket ini publik-read (gambar proyek memang meant to publik) tapi
-- write hanya untuk admin. Nama file dibuat client-side dengan prefix
-- acak, jadi tidak ada tebakan nama.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-images',
  'project-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone can read project images" ON storage.objects;
CREATE POLICY "Anyone can read project images" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Admins can upload project images" ON storage.objects;
CREATE POLICY "Admins can upload project images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update project images" ON storage.objects;
CREATE POLICY "Admins can update project images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'project-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'project-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete project images" ON storage.objects;
CREATE POLICY "Admins can delete project images" ON storage.objects
  FOR DELETE USING (bucket_id = 'project-images' AND public.is_admin());
