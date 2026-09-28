/**
 * PaulFolio â€” Admin Dashboard Logic
 *
 * Menangani CRUD untuk:
 * - Projects   (tabel `projects`)
 * - Messages   (tabel `contact_messages`)
 * - Users      (tabel `profiles`)
 *
 * Hanya user dengan role 'admin' yang boleh mengakses dashboard ini.
 * Guard dilakukan di initAdmin() sebelum render apa pun.
 *
 * Catatan teknis: File ini sengaja TIDAK pakai ES module import/export
 * agar bisa dimuat sebagai <script> biasa. Semua dependensi diambil
 * dari global yang di-expose supabase.js dan auth.js.
 */

/**
 * Tunggu client Supabase siap dipakai (supabase.js memuat SDK via CDN).
 * @returns {Promise<object|null>}
 */
async function waitForSupabase() {
  if (window.supabaseReady) {
    await window.supabaseReady;
  }
  return window.supabase || null;
}

// ============================================================
// STATE & UTIL
// ============================================================
const state = {
  projects: [],
  messages: [],
  users: [],
  editingProjectId: null,
  editingMessageId: null,
  editingUserId: null,
};

/**
 * Tampilkan toast sederhana (memanfaatkan #toast bila ada).
 */
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  if (toast && toastMessage) {
    toastMessage.textContent = message;
    toast.style.background = isError ? '#f43f5e' : '#10b981';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  } else {
    console.log('[Admin]', message);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return iso;
  }
}

function friendlyError(err, fallback = 'Terjadi kesalahan.') {
  if (!err) return fallback;
  return err.message || fallback;
}

// ============================================================
// AUTH GUARD
// ============================================================
async function requireAdmin() {
  if (!window.isSupabaseConfigured()) {
    return {
      ok: false,
      reason: 'unconfigured',
      message: 'Supabase belum dikonfigurasi. Isi kredensial di supabase.js lalu refresh halaman.',
    };
  }

  const client = await waitForSupabase();
  if (!client) {
    return {
      ok: false,
      reason: 'error',
      message: 'Gagal memuat Supabase client. Periksa koneksi internet lalu refresh halaman.',
    };
  }

  const user = await window.getCurrentUser();
  if (!user) {
    return { ok: false, reason: 'unauthenticated', message: 'Anda harus login sebagai admin.' };
  }

  const { data: profile, error } = await window.getCurrentProfile(user);
  if (error) {
    return { ok: false, reason: 'error', message: 'Gagal memuat profil: ' + error };
  }
  if (!profile) {
    return { ok: false, reason: 'no-profile', message: 'Profil tidak ditemukan. Hubungi administrator.' };
  }
  if (profile.role !== 'admin') {
    return { ok: false, reason: 'forbidden', message: 'Akses ditolak. Halaman ini khusus admin.' };
  }

  return { ok: true, user, profile };
}

// ============================================================
// PROJECTS CRUD
// ============================================================
async function loadProjects() {
  const { data, error } = await window.supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Gagal memuat proyek: ' + friendlyError(error), true);
    state.projects = [];
  } else {
    state.projects = data || [];
  }
  renderProjects();
}

function renderProjects() {
  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;

  if (state.projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; display:block; margin-bottom:12px;"></i>
          Belum ada proyek. Tambahkan proyek pertama Anda.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = state.projects.map(p => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          ${p.image
            ? `<img src="${escapeHtml(p.image)}" alt="" style="width:48px; height:48px; object-fit:cover; border-radius:8px;">`
            : `<div style="width:48px; height:48px; border-radius:8px; background:var(--bg-glass); display:flex; align-items:center; justify-content:center; color:var(--text-dim);"><i class="fa-solid fa-image"></i></div>`}
          <strong>${escapeHtml(p.title)}</strong>
        </div>
      </td>
      <td><span class="tag">${escapeHtml(p.category)}</span></td>
      <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.description || '-')}</td>
      <td>${escapeHtml(p.client || '-')}</td>
      <td>${escapeHtml(p.period || '-')}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="window.adminEditProject('${p.id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-outline btn-sm" style="color:var(--accent); border-color:rgba(244,63,94,.4);" onclick="window.adminDeleteProject('${p.id}')" title="Hapus">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function resetProjectForm() {
  state.editingProjectId = null;
  const form = document.getElementById('projectForm');
  if (form) form.reset();
  const btn = document.getElementById('projectSubmitBtn');
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Tambah Proyek';
  }
  const title = document.getElementById('projectFormTitle');
  if (title) title.textContent = 'Tambah Proyek Baru';
}

async function handleProjectSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const btn = document.getElementById('projectSubmitBtn');
  const originalText = btn ? btn.innerHTML : '';

  const payload = {
    title: document.getElementById('projectTitle').value.trim(),
    category: document.getElementById('projectCategory').value.trim(),
    description: document.getElementById('projectDescription').value.trim(),
    image: document.getElementById('projectImage').value.trim(),
    tech_stack: document.getElementById('projectTechStack').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
    client: document.getElementById('projectClient').value.trim(),
    period: document.getElementById('projectPeriod').value.trim(),
  };

  if (!payload.title || !payload.category) {
    showToast('Judul dan kategori proyek wajib diisi.', true);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
  }

  try {
    let error = null;
    if (state.editingProjectId) {
      const res = await window.supabase
        .from('projects')
        .update(payload)
        .eq('id', state.editingProjectId);
      error = res.error;
    } else {
      const res = await window.supabase.from('projects').insert(payload);
      error = res.error;
    }

    if (error) {
      showToast('Gagal menyimpan proyek: ' + friendlyError(error), true);
    } else {
      showToast(state.editingProjectId ? 'Proyek berhasil diperbarui.' : 'Proyek berhasil ditambahkan.');
      resetProjectForm();
      await loadProjects();
    }
  } catch (e) {
    showToast('Gagal menyimpan proyek: ' + friendlyError(e), true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

function editProject(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;

  state.editingProjectId = id;
  document.getElementById('projectTitle').value = p.title || '';
  document.getElementById('projectCategory').value = p.category || '';
  document.getElementById('projectDescription').value = p.description || '';
  document.getElementById('projectImage').value = p.image || '';
  document.getElementById('projectTechStack').value = Array.isArray(p.tech_stack) ? p.tech_stack.join(', ') : '';
  document.getElementById('projectClient').value = p.client || '';
  document.getElementById('projectPeriod').value = p.period || '';

  const btn = document.getElementById('projectSubmitBtn');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Perubahan';
  const title = document.getElementById('projectFormTitle');
  if (title) title.textContent = 'Edit Proyek';

  document.getElementById('projectFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteProject(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Hapus proyek "${p.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;

  const { error } = await window.supabase.from('projects').delete().eq('id', id);
  if (error) {
    showToast('Gagal menghapus proyek: ' + friendlyError(error), true);
  } else {
    showToast('Proyek berhasil dihapus.');
    if (state.editingProjectId === id) resetProjectForm();
    await loadProjects();
  }
}

// ============================================================
// MESSAGES CRUD
// ============================================================
async function loadMessages() {
  const { data, error } = await window.supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Gagal memuat pesan: ' + friendlyError(error), true);
    state.messages = [];
  } else {
    state.messages = data || [];
  }
  renderMessages();
}

function renderMessages() {
  const tbody = document.getElementById('messagesTableBody');
  if (!tbody) return;

  if (state.messages.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-inbox" style="font-size: 2rem; display:block; margin-bottom:12px;"></i>
          Belum ada pesan masuk.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = state.messages.map(m => `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.email)}</td>
      <td>${escapeHtml(m.subject || '-')}</td>
      <td style="max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(m.message)}</td>
      <td>${formatDate(m.created_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="window.adminViewMessage('${m.id}')" title="Lihat Detail">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="btn btn-outline btn-sm" style="color:var(--accent); border-color:rgba(244,63,94,.4);" onclick="window.adminDeleteMessage('${m.id}')" title="Hapus">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function viewMessage(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;

  const modal = document.getElementById('messageModal');
  const body = document.getElementById('messageModalBody');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="margin-bottom:16px;">
      <strong style="color:var(--text-muted);">Dari:</strong>
      <div style="font-size:1.05rem; font-weight:600; margin-top:4px;">${escapeHtml(m.name)} &lt;${escapeHtml(m.email)}&gt;</div>
    </div>
    <div style="margin-bottom:16px;">
      <strong style="color:var(--text-muted);">Subjek:</strong>
      <div style="margin-top:4px;">${escapeHtml(m.subject || '-')}</div>
    </div>
    <div style="margin-bottom:16px;">
      <strong style="color:var(--text-muted);">Tanggal:</strong>
      <div style="margin-top:4px;">${formatDate(m.created_at)}</div>
    </div>
    <div>
      <strong style="color:var(--text-muted);">Pesan:</strong>
      <div style="margin-top:8px; padding:16px; background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:var(--radius-md); white-space:pre-wrap; line-height:1.7;">${escapeHtml(m.message)}</div>
    </div>
  `;
  modal.classList.add('active');
}

async function deleteMessage(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Hapus pesan dari "${m.name}"?`)) return;

  const { error } = await window.supabase.from('contact_messages').delete().eq('id', id);
  if (error) {
    showToast('Gagal menghapus pesan: ' + friendlyError(error), true);
  } else {
    showToast('Pesan berhasil dihapus.');
    await loadMessages();
  }
}

// ============================================================
// USERS CRUD
// ============================================================
async function loadUsers() {
  const { data, error } = await window.supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Gagal memuat user: ' + friendlyError(error), true);
    state.users = [];
  } else {
    state.users = data || [];
  }
  renderUsers();
}

function renderUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (state.users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-users" style="font-size: 2rem; display:block; margin-bottom:12px;"></i>
          Belum ada user terdaftar.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = state.users.map(u => {
    const roleClass = u.role === 'admin' ? 'text-red' : u.role === 'designer' ? 'text-purple' : 'text-emerald';
    return `
    <tr>
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="${roleClass}" style="font-weight:600; text-transform:capitalize;">${escapeHtml(u.role)}</span></td>
      <td>${formatDate(u.created_at)}</td>
      <td>
        <select onchange="window.adminChangeRole('${u.id}', this.value)"
          style="background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-glass); border-radius:8px; padding:6px 10px; font-size:0.85rem;">
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
          <option value="designer" ${u.role === 'designer' ? 'selected' : ''}>designer</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" style="color:var(--accent); border-color:rgba(244,63,94,.4);" onclick="window.adminDeleteUser('${u.id}')" title="Hapus User">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `;}).join('');
}

async function changeRole(userId, newRole) {
  if (!['user', 'designer', 'admin'].includes(newRole)) return;

  const target = state.users.find(u => u.id === userId);
  if (!target) return;

  if (!confirm(`Ubah role "${target.name}" menjadi "${newRole}"?`)) {
    await loadUsers(); // reset select
    return;
  }

  const { error } = await window.supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) {
    showToast('Gagal mengubah role: ' + friendlyError(error), true);
    await loadUsers();
  } else {
    showToast(`Role "${target.name}" berhasil diubah menjadi "${newRole}".`);
    await loadUsers();
  }
}

async function deleteUser(userId) {
  const target = state.users.find(u => u.id === userId);
  if (!target) return;

  const currentUser = await window.getCurrentUser();
  if (currentUser && currentUser.id === userId) {
    showToast('Anda tidak dapat menghapus akun sendiri.', true);
    return;
  }

  if (!confirm(`Hapus user "${target.name}" (${target.email})? Data auth user harus dihapus manual di dashboard Supabase.`)) return;

  const { error } = await window.supabase.from('profiles').delete().eq('id', userId);
  if (error) {
    showToast('Gagal menghapus user: ' + friendlyError(error), true);
  } else {
    showToast('User berhasil dihapus.');
    await loadUsers();
  }
}

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

  const tabBtn = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
  const tabContent = document.getElementById(`tab-${tabName}`);
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');
}

// ============================================================
// INIT
// ============================================================
async function initAdmin() {
  const guard = await requireAdmin();

  const loadingEl = document.getElementById('adminLoading');
  const errorEl = document.getElementById('adminError');
  const contentEl = document.getElementById('adminContent');

  if (!guard.ok) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'flex';
      const icon = errorEl.querySelector('.admin-error-icon');
      const msg = errorEl.querySelector('.admin-error-message');
      const btn = errorEl.querySelector('#adminGoAuth');
      if (icon) icon.className = 'fa-solid ' + (guard.reason === 'unconfigured' ? 'fa-gear' : 'fa-lock') + ' admin-error-icon';
      if (msg) msg.textContent = guard.message;
      if (btn) {
        btn.onclick = () => {
          if (guard.reason === 'unconfigured') {
            window.location.href = 'index.html';
          } else {
            window.location.href = 'auth.html';
          }
        };
      }
    }
    if (contentEl) contentEl.style.display = 'none';
    return;
  }

  if (loadingEl) loadingEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';

  // Tampilkan nama admin di header
  const adminNameEl = document.getElementById('adminUserName');
  if (adminNameEl && guard.profile) {
    adminNameEl.textContent = guard.profile.name || guard.user.email;
  }

  // Bind events
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.signOut();
      window.location.href = 'index.html';
    });
  }

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
  });

  const projectForm = document.getElementById('projectForm');
  if (projectForm) {
    projectForm.addEventListener('submit', handleProjectSubmit);
  }

  const cancelProjectBtn = document.getElementById('projectCancelBtn');
  if (cancelProjectBtn) {
    cancelProjectBtn.addEventListener('click', resetProjectForm);
  }

  const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
  if (closeMessageModalBtn) {
    closeMessageModalBtn.addEventListener('click', () => {
      document.getElementById('messageModal').classList.remove('active');
    });
  }

  // Expose functions ke global scope (untuk onclick di HTML)
  window.adminEditProject = editProject;
  window.adminDeleteProject = deleteProject;
  window.adminViewMessage = viewMessage;
  window.adminDeleteMessage = deleteMessage;
  window.adminChangeRole = changeRole;
  window.adminDeleteUser = deleteUser;

  // Load data awal
  await Promise.all([loadProjects(), loadMessages(), loadUsers()]);
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
