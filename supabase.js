/**
 * PaulFolio — Supabase Client Configuration
 *
 * Cara pakai:
 * 1. Buat project di https://supabase.com
 * 2. Buka SQL Editor, jalankan isi file supabase-schema.sql
 * 3. Buka Project Settings > API
 * 4. Salin Project URL dan anon public key ke window.SUPABASE_CONFIG di bawah ini
 * 5. Jalankan `npm run dev`
 *
 * Catatan: File ini sengaja TIDAK pakai ES module import/export
 * agar bisa dimuat sebagai <script> biasa (bukan type="module").
 * Supabase di-load via CDN.
 */

// ============================================================
// KONFIGURASI — Ganti dengan kredensial Supabase Anda
// ============================================================
window.SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_URL',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
};

// ============================================================
// SUPABASE CLIENT (CDN)
// ============================================================
window.supabaseReady = new Promise((resolve) => {
  if (window.supabase && typeof window.supabase.from === 'function') {
    // Supabase sudah dimuat (misal dari build Vite)
    resolve(window.supabase);
    return;
  }

  const config = window.SUPABASE_CONFIG;
  if (config.url === 'YOUR_SUPABASE_URL' || config.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('[Supabase] Kredensial belum diisi. Ganti window.SUPABASE_CONFIG di supabase.js.');
    resolve(null);
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = function () {
    window.supabase = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
    resolve(window.supabase);
  };
  script.onerror = function () {
    console.error('[Supabase] Gagal memuat supabase-js dari CDN.');
    resolve(null);
  };
  document.head.appendChild(script);
});

/**
 * Helper untuk mengecek apakah konfigurasi Supabase sudah diisi.
 * @returns {boolean}
 */
window.isSupabaseConfigured = function () {
  const config = window.SUPABASE_CONFIG;
  return (
    config &&
    config.url !== 'YOUR_SUPABASE_URL' &&
    config.anonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
    config.url.startsWith('http')
  );
};
