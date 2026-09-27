# Panduan Setup Supabase — PaulFolio

Dokumentasi lengkap untuk mengaktifkan backend Supabase pada portfolio PaulFolio.

---

## Langkah 1: Buat Project Supabase

1. Buka [https://supabase.com](https://supabase.com)
2. Klik **"New Project"**
3. Isi detail project:
   - **Name**: `paulfolio`
   - **Database Password**: Buat password kuat (simpan baik-baik)
   - **Region**: Pilih `Southeast Asia (Singapore)` — paling dekat dengan Indonesia
4. Klik **"Create new project"**
5. Tunggu ± 2 menit hingga project ready

---

## Langkah 2: Jalankan SQL Schema

1. Di dashboard Supabase, buka **SQL Editor** (menu kiri)
2. Klik **"New query"**
3. Buka file `supabase-schema.sql` di project ini
4. Salin **seluruh isi** file ke SQL Editor
5. Klik **"Run"** (atau tekan `Ctrl+Enter`)
6. Pastikan tidak ada error. Output sukses: `Success. No rows returned`

Schema ini akan membuat:
- Tabel `profiles` (data user + role)
- Tabel `projects` (data proyek portfolio)
- Tabel `contact_messages` (pesan dari form kontak)
- Row Level Security (RLS) policies
- Trigger auto-create profile saat signup

---

## Langkah 3: Aktifkan Email Confirmation

1. Buka **Authentication** → **Settings** (menu kiri)
2. Scroll ke bagian **"Confirm email"**
3. **Aktifkan** toggle **"Confirm email"**
4. (Opsional) Aktifkan juga **"Secure email change"**
5. Klik **"Save"**

> **Penting**: Tanpa ini, user bisa login langsung tanpa verifikasi email.

---

## Langkah 4: Isi Kredensial di supabase.js

1. Buka **Project Settings** → **API** (menu kiri)
2. Salin:
   - **Project URL** → tempel ke `SUPABASE_URL` di `supabase.js`
   - **anon public** key → tempel ke `SUPABASE_ANON_KEY` di `supabase.js`

Contoh hasil akhir `supabase.js`:
```js
const SUPABASE_URL = 'https://xyzcompany.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

## Langkah 5: Buat Admin User

### Opsi A: Via Dashboard (Paling Mudah)

1. Buka **Authentication** → **Users**
2. Klik **"Add user"** → **"Create new user"**
3. Isi:
   - **Email**: `admin@paulfolio.com` (atau email Anda)
   - **Password**: password kuat
   - **Auto Confirm User**: **AKTIFKAN** (skip email confirmation untuk admin)
4. Klik **"Create user"**
5. Catat **User ID** (UUID) yang muncul
6. Buka **SQL Editor**, jalankan:
   ```sql
   UPDATE profiles
   SET role = 'admin'
   WHERE email = 'admin@paulfolio.com';
   ```

### Opsi B: Via Signup Manual

1. Jalankan `npm run dev`
2. Buka `http://localhost:5173/auth.html`
3. Daftar akun baru
4. Buka email → klik link konfirmasi
5. Login ke Supabase Dashboard → **Authentication** → **Users**
6. Klik user → catat ID-nya
7. Jalankan SQL:
   ```sql
   UPDATE profiles
   SET role = 'admin'
   WHERE id = 'USER_ID_DI_SINI';
   ```

---

## Langkah 6: Jalankan Aplikasi

```bash
npm run dev
```

Buka browser: `http://localhost:5173`

### Halaman Auth
- **Login**: `http://localhost:5173/auth.html?mode=login`
- **Register**: `http://localhost:5173/auth.html?mode=register`

### Halaman Admin
- **Dashboard**: `http://localhost:5173/admin.html`
- Hanya bisa diakses user dengan `role = 'admin'`

---

## Struktur File

```
paulfolio/
├── supabase.js              # Konfigurasi Supabase client
├── auth.js                  # Logic authentication (signUp, signIn, signOut)
├── admin.js                 # Logic admin dashboard (CRUD)
├── auth.html                # Halaman login & register
├── admin.html               # Halaman admin dashboard
├── supabase-schema.sql      # Schema database (jalankan di SQL Editor)
├── SUPABASE_SETUP.md        # File ini
├── script.js                # Main JS (sudah diupdate)
├── style.css                # Styles (sudah diupdate)
├── vite.config.js           # Vite config (sudah diupdate)
├── index.html               # Home (navbar sudah diupdate)
├── about.html               # About (navbar sudah diupdate)
├── projects.html            # Projects (load dari Supabase)
└── contact.html             # Contact (simpan ke Supabase)
```

---

## Troubleshooting

### Error: "Invalid API key"
- Pastikan `SUPABASE_ANON_KEY` di `supabase.js` benar
- Jangan pakai `service_role` key — itu hanya untuk server-side

### Error: "new row violates row-level security policy"
- Pastikan RLS policies sudah dibuat (Jalankan ulang `supabase-schema.sql`)
- Pastikan user sudah login sebelum insert/update

### Error: "Email not confirmed"
- Cek inbox email (folder spam juga)
- Pastikan "Confirm email" aktif di Auth Settings
- Atau: auto-confirm manual via Dashboard untuk testing

### Error: "Profil tidak ditemukan"
- Trigger `handle_new_user` mungkin belum jalan
- Jalankan manual di SQL Editor:
  ```sql
  INSERT INTO profiles (id, email, name, role)
  VALUES ('USER_ID', 'EMAIL', 'NAMA', 'user');
  ```

### Admin tidak bisa login ke admin.html
- Pastikan role di tabel `profiles` sudah `'admin'`
- Jalankan: `SELECT * FROM profiles WHERE email = 'EMAIL_ADMIN';`
- Cek kolom `role` = `'admin'`

---

## Keamanan

- **Jangan pernah** commit `supabase.js` dengan kredensial asli ke GitHub public
- Gunakan `.env` file untuk production (Vite mendukung `import.meta.env`)
- `anon` key aman untuk client-side karena RLS melindungi data
- `service_role` key **HANYA** untuk server-side (jangan taruh di frontend)

---

## Production Deployment

1. Build: `npm run build`
2. Upload folder `dist/` ke hosting (Vercel, Netlify, dll)
3. Tambahkan environment variables di hosting:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Update `supabase.js` untuk baca dari env:
   ```js
   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
   const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
   ```

---

**Selesai!** Sistem auth & admin PaulFolio sudah siap digunakan.
