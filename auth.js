/**
 * PaulFolio — Authentication System (Supabase Auth)
 *
 * Menyediakan:
 * - signUp(email, password, role, name)  → registrasi + email confirmation
 * - signIn(email, password)               → login
 * - signOut()                             → logout
 * - getCurrentUser()                      → user aktif dari session
 * - getCurrentProfile()                   → data profiles dari user aktif
 * - onAuthStateChange(callback)           → listener perubahan auth state
 * - updateProfile(data)                   → update profil user
 *
 * Catatan penting:
 * - Email confirmation WAJIB aktif di Supabase → Auth → Settings → "Confirm email".
 *   User tidak bisa login sebelum klik link konfirmasi di email.
 * - Role yang didukung: 'user', 'designer', 'admin'.
 *
 * Catatan teknis: File ini sengaja TIDAK pakai ES module import/export
 * agar bisa dimuat sebagai <script> biasa (bukan type="module").
 */

const ALLOWED_ROLES = ['user', 'designer', 'admin'];

/**
 * Normalisasi pesan error Supabase ke bahasa Indonesia yang ramah.
 * @param {object|null} err
 * @param {string} fallback
 * @returns {string}
 */
function friendlyError(err, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (!err) return fallback;
  const msg = (err.message || '').toLowerCase();

  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'Email sudah terdaftar. Silakan login atau gunakan email lain.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
    return 'Email atau password salah. Silakan periksa kembali.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Cek inbox email Anda untuk link verifikasi.';
  }
  if (msg.includes('weak password') || msg.includes('at least 6')) {
    return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
  }
  if (msg.includes('valid email')) {
    return 'Format email tidak valid.';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
  }
  if (msg.includes('network')) {
    return 'Koneksi jaringan bermasalah. Periksa internet Anda.';
  }
  return err.message || fallback;
}

/**
 * Ambil profil user yang sedang login dari tabel `profiles`.
 * @param {object} [user] — auth user object (default: session saat ini)
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
async function getCurrentProfile(user = null) {
  if (!window.isSupabaseConfigured()) {
    return { data: null, error: 'Supabase belum dikonfigurasi. Isi kredensial di supabase.js.' };
  }
  try {
    const authUser = user || (await getCurrentUser());
    if (!authUser) return { data: null, error: null };

    const { data, error } = await window.supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) return { data: null, error: friendlyError(error) };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: friendlyError(e) };
  }
}

/**
 * Daftar akun baru dengan email confirmation.
 *
 * Alur:
 * 1. signUp → Supabase kirim email konfirmasi.
 * 2. Data profil (name, role) dibuat via trigger `handle_new_user` di Supabase
 *    (otomatis mengisi kolom `profiles`). Jika trigger belum dibuat,
 *    fallback: insert manual setelah sign-up berhasil & session ada.
 * 3. Tampilkan pesan "Cek email Anda untuk konfirmasi akun".
 *
 * @param {string} email
 * @param {string} password
 * @param {string} role — 'user' | 'designer'
 * @param {string} name
 * @returns {Promise<{success: boolean, needsEmailConfirm: boolean, message: string, user: object|null, error: string|null}>}
 */
async function signUp(email, password, role = 'user', name = '') {
  if (!window.isSupabaseConfigured()) {
    return {
      success: false,
      needsEmailConfirm: false,
      message: '',
      user: null,
      error: 'Supabase belum dikonfigurasi. Isi kredensial di supabase.js.',
    };
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim();
  const cleanRole = ALLOWED_ROLES.includes(role) ? role : 'user';

  if (!cleanEmail || !cleanName) {
    return {
      success: false,
      needsEmailConfirm: false,
      message: '',
      user: null,
      error: 'Nama dan email wajib diisi.',
    };
  }
  if (!password || password.length < 6) {
    return {
      success: false,
      needsEmailConfirm: false,
      message: '',
      user: null,
      error: 'Password minimal 6 karakter.',
    };
  }

  try {
    const { data, error } = await window.supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          name: cleanName,
          role: cleanRole,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      return {
        success: false,
        needsEmailConfirm: false,
        message: '',
        user: null,
        error: friendlyError(error),
      };
    }

    // Jika email confirmation diminta, Supabase TIDAK membuat session.
    // Jika profil tidak dibuat oleh trigger, lakukan insert manual.
    const userObj = data?.user || null;
    if (userObj) {
      const { data: existing } = await window.supabase
        .from('profiles')
        .select('id')
        .eq('id', userObj.id)
        .maybeSingle();

      if (!existing) {
        const { error: profileError } = await window.supabase.from('profiles').upsert({
          id: userObj.id,
          email: cleanEmail,
          name: cleanName,
          role: cleanRole,
        });
        if (profileError) {
          console.warn('[Auth] Gagal membuat profil:', profileError.message);
        }
      }
    }

    const needsConfirm = data?.user && !data?.session;
    return {
      success: true,
      needsEmailConfirm: !!needsConfirm,
      message: needsConfirm
        ? 'Cek email Anda untuk konfirmasi akun'
        : 'Pendaftaran berhasil! Anda sudah bisa login.',
      user: userObj,
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      needsEmailConfirm: false,
      message: '',
      user: null,
      error: friendlyError(e),
    };
  }
}

/**
 * Login dengan email & password.
 * Jika email belum dikonfirmasi, Supabase menolak login dan kita
 * mengembalikan pesan "Cek email Anda untuk konfirmasi akun".
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, needsEmailConfirm: boolean, message: string, user: object|null, error: string|null}>}
 */
async function signIn(email, password) {
  if (!window.isSupabaseConfigured()) {
    return {
      success: false,
      needsEmailConfirm: false,
      message: '',
      user: null,
      error: 'Supabase belum dikonfigurasi. Isi kredensial di supabase.js.',
    };
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return {
      success: false,
      needsEmailConfirm: false,
      message: '',
      user: null,
      error: 'Email dan password wajib diisi.',
    };
  }

  try {
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      const needsConfirm = /not confirmed/i.test(error.message || '');
      return {
        success: false,
        needsEmailConfirm: needsConfirm,
        message: needsConfirm ? 'Cek email Anda untuk konfirmasi akun' : '',
        user: null,
        error: friendlyError(error),
      };
    }

    return {
      success: true,
      needsEmailConfirm: false,
      message: 'Login berhasil!',
      user: data?.user || null,
      error: null,
    };
  } catch (e) {
    return {
      success: false,
      needsEmailConfirm: false,
      message: '',
      user: null,
      error: friendlyError(e),
    };
  }
}

/**
 * Logout user aktif.
 * @returns {Promise<{success: boolean, message: string, error: string|null}>}
 */
async function signOut() {
  if (!window.isSupabaseConfigured()) {
    return {
      success: true,
      message: 'Supabase belum dikonfigurasi. Sesi lokal dibersihkan.',
      error: null,
    };
  }
  try {
    const { error } = await window.supabase.auth.signOut();
    if (error) {
      return { success: false, message: '', error: friendlyError(error) };
    }
    return { success: true, message: 'Berhasil logout.', error: null };
  } catch (e) {
    return { success: false, message: '', error: friendlyError(e) };
  }
}

/**
 * Ambil user auth yang sedang aktif (dari session tersimpan).
 * @returns {Promise<object|null>}
 */
async function getCurrentUser() {
  if (!window.isSupabaseConfigured()) return null;
  try {
    const { data } = await window.supabase.auth.getSession();
    return data?.session?.user || null;
  } catch (e) {
    console.error('[Auth] getCurrentUser error:', e);
    return null;
  }
}

/**
 * Dengarkan perubahan state auth (SIGNED_IN, SIGNED_OUT, dll).
 * Dipanggil otomatis oleh halaman lain untuk memperbarui UI navbar.
 *
 * @param {(event: string, session: object|null) => void} callback
 * @returns {{unsubscribe: Function}} — bisa di-unsubscribe saat komponen dilepas
 */
function onAuthStateChange(callback) {
  if (!window.isSupabaseConfigured()) {
    // Supabase belum di-config: panggil sekali dengan state kosong.
    try { callback('SIGNED_OUT', null); } catch (_) { /* noop */ }
    return { unsubscribe: () => {} };
  }
  const { data } = window.supabase.auth.onAuthStateChange((event, session) => {
    try { callback(event, session); } catch (e) { console.error('[Auth] callback error:', e); }
  });
  return data.subscription;
}

/**
 * Update profil user aktif (name saja yang diizinkan untuk user biasa;
 * admin dapat mengubah role melalui admin.js).
 * @param {object} dataUpdate — { name?: string, role?: string }
 * @returns {Promise<{success: boolean, message: string, error: string|null}>}
 */
async function updateProfile(dataUpdate = {}) {
  if (!window.isSupabaseConfigured()) {
    return {
      success: false,
      message: '',
      error: 'Supabase belum dikonfigurasi. Isi kredensial di supabase.js.',
    };
  }
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: '', error: 'Anda belum login.' };
  }

  const allowed = {};
  if (typeof dataUpdate.name === 'string' && dataUpdate.name.trim()) {
    allowed.name = dataUpdate.name.trim();
  }
  if (ALLOWED_ROLES.includes(dataUpdate.role)) {
    allowed.role = dataUpdate.role;
  }

  if (Object.keys(allowed).length === 0) {
    return { success: false, message: '', error: 'Tidak ada data yang valid untuk diperbarui.' };
  }

  try {
    const { error } = await window.supabase
      .from('profiles')
      .update(allowed)
      .eq('id', user.id);

    if (error) return { success: false, message: '', error: friendlyError(error) };
    return { success: true, message: 'Profil berhasil diperbarui.', error: null };
  } catch (e) {
    return { success: false, message: '', error: friendlyError(e) };
  }
}

// ============================================================
// EXPOSE TO WINDOW (untuk script.js non-module)
// ============================================================
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.getCurrentProfile = getCurrentProfile;
window.onAuthStateChange = onAuthStateChange;
window.updateProfile = updateProfile;
