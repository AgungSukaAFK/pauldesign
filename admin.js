/**
 * PaulFolio — Admin Dashboard Logic
 *
 * Menangani CRUD untuk:
 * - Projects   (tabel `projects`)
 * - Messages   (tabel `contact_messages`)
 * - Users      (tabel `profiles`)
 *
 * Fitur pendukung: pencarian, filter, pagination, bulk action,
 * tandai pesan dibaca, export CSV, dan upload gambar ke Supabase Storage.
 *
 * Hanya user dengan role 'admin' yang boleh mengakses dashboard ini.
 * Guard dilakukan di initAdmin() sebelum render apa pun.
 *
 * Catatan teknis: File ini sengaja TIDAK pakai ES module import/export
 * agar bisa dimuat sebagai <script> biasa. Semua dependensi diambil
 * dari global yang di-expose supabase.js dan auth.js.
 *
 * CATATAN RLS: policy admin memanggil public.is_admin() (SECURITY DEFINER).
 * Kalau policy itu diubah lagi menjadi subquery langsung ke `profiles`,
 * Postgres akan kena infinite recursion dan seluruh dashboard gagal.
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
// KONSTANTA
// ============================================================
const STORAGE_BUCKET = 'project-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PAGE_SIZE = 10;
const ROLE_CLASS = {
  admin: 'text-red',
  designer: 'text-purple',
  user: 'text-emerald',
};

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
  viewingMessageId: null,
  pendingImageFile: null,
  removingImagePath: null,
  selection: {
    projects: new Set(),
    messages: new Set(),
    users: new Set(),
  },
  filters: {
    projects: { search: '', category: '', page: 1 },
    messages: { search: '', read: '', page: 1 },
    users: { search: '', role: '', page: 1 },
  },
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

/**
 * Samakan huruf besar/kecil dan buang spasi untuk pencarian.
 */
function normalize(value) {
  return String(value == null ? '' : value).toLowerCase();
}

/**
 * Bangun query string untuk update based on daftar id.
 * Dipakai untuk bulk action Supabase yang butuh filter `.in(...)`.
 */
function fetchByIds(table, ids) {
  return window.supabase.from(table).select('*').in('id', ids);
}

// ============================================================
// PAGINATION
// ============================================================
function paginate(items, page) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    slice: items.slice(start, start + PAGE_SIZE),
    page: safePage,
    totalPages,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + PAGE_SIZE, items.length),
  };
}

function renderPagination(containerId, info, label) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (info.total === 0) {
    container.innerHTML = '';
    return;
  }

  const buttons = [];
  for (let i = 1; i <= info.totalPages; i++) {
    buttons.push(
      `<button class="admin-page-btn ${i === info.page ? 'active' : ''}" data-page="${i}">${i}</button>`
    );
  }

  container.innerHTML = `
    <span class="admin-pagination-info">
      Menampilkan ${info.from}-${info.to} dari ${info.total} ${label}
    </span>
    <div class="admin-pagination-controls">
      <button class="admin-page-btn" data-page="${info.page - 1}" ${info.page === 1 ? 'disabled' : ''}
        aria-label="Halaman sebelumnya">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      ${buttons.join('')}
      <button class="admin-page-btn" data-page="${info.page + 1}" ${info.page === info.totalPages ? 'disabled' : ''}
        aria-label="Halaman berikutnya">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
  `;

  container.querySelectorAll('.admin-page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = Number(btn.getAttribute('data-page'));
      if (Number.isNaN(next) || next < 1) return;
      const target = btn.closest('.admin-tab-content').id.replace('tab-', '');
      state.filters[target].page = next;
      renderActiveTab();
    });
  });
}

// ============================================================
// BULK SELECTION
// ============================================================
function updateBulkBar(key, barId, countId) {
  const selected = state.selection[key];
  const bar = document.getElementById(barId);
  const countEl = document.getElementById(countId);
  const selectAll = document.getElementById(key + 'SelectAll');

  if (countEl) countEl.textContent = String(selected.size);
  if (bar) bar.style.display = selected.size > 0 ? 'flex' : 'none';

  if (selectAll) {
    const visible = getVisibleIds(key);
    const allSelected = visible.length > 0 && visible.every(id => selected.has(id));
    selectAll.checked = allSelected;
    selectAll.indeterminate = !allSelected && visible.some(id => selected.has(id));
  }
}

/**
 * Id yang sedang tampil di halaman ini (bukan seluruh dataset),
 * supaya "pilih semua" tidak sneakily menyentuh baris tersembunyi.
 */
function getVisibleIds(key) {
  const info = getPaginated(key);
  return info.slice.map(row => row.id);
}

function getSource(key) {
  return state[key];
}

function getPaginated(key) {
  const items = filterRows(key);
  return paginate(items, state.filters[key].page);
}

function clearSelection(key) {
  state.selection[key].clear();
  const selectAll = document.getElementById(key + 'SelectAll');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
  updateBulkBar(key, key + 'BulkBar', key + 'SelectedCount');
}

// ============================================================
// FILTERING
// ============================================================
function filterRows(key) {
  const f = state.filters[key];
  const q = normalize(f.search);

  if (key === 'projects') {
    return state.projects.filter(p => {
      if (f.category && p.category !== f.category) return false;
      if (!q) return true;
      const tech = Array.isArray(p.tech_stack) ? p.tech_stack.join(' ') : '';
      return (
        normalize(p.title).includes(q) ||
        normalize(p.client).includes(q) ||
        normalize(p.description).includes(q) ||
        normalize(tech).includes(q)
      );
    });
  }

  if (key === 'messages') {
    return state.messages.filter(m => {
      if (f.read === 'unread' && m.is_read) return false;
      if (f.read === 'read' && !m.is_read) return false;
      if (!q) return true;
      return (
        normalize(m.name).includes(q) ||
        normalize(m.email).includes(q) ||
        normalize(m.subject).includes(q) ||
        normalize(m.message).includes(q)
      );
    });
  }

  return state.users.filter(u => {
    if (f.role && u.role !== f.role) return false;
    if (!q) return true;
    return normalize(u.name).includes(q) || normalize(u.email).includes(q);
  });
}

function refreshCategoryFilter() {
  const select = document.getElementById('projectCategoryFilter');
  if (!select) return;

  const current = state.filters.projects.category;
  const categories = [...new Set(state.projects.map(p => p.category).filter(Boolean))].sort();

  select.innerHTML =
    '<option value="">Semua kategori</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.value = categories.includes(current) ? current : '';
}

function renderActiveTab() {
  const active = document.querySelector('.admin-tab-content.active');
  if (!active) return;
  const key = active.id.replace('tab-', '');
  if (key === 'projects') renderProjects();
  else if (key === 'messages') renderMessages();
  else if (key === 'users') renderUsers();
}

// ============================================================
// STATS
// ============================================================
function updateStats() {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  const unread = state.messages.filter(m => !m.is_read).length;

  set('statProjects', state.projects.length);
  set('statMessages', state.messages.length);
  set('statUsers', state.users.length);
  set('statUnread', unread);

  const pill = document.getElementById('messagesUnreadPill');
  if (pill) {
    pill.textContent = String(unread);
    pill.style.display = unread > 0 ? 'inline-flex' : 'none';
  }

  // Badge di tab button supaya jumlah unread terlihat tanpa pindah tab.
  const tabBtn = document.querySelector('.admin-tab[data-tab="messages"]');
  if (tabBtn) {
    let badge = tabBtn.querySelector('.admin-tab-badge');
    if (unread > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'admin-tab-badge';
        tabBtn.appendChild(badge);
      }
      badge.textContent = String(unread);
    } else if (badge) {
      badge.remove();
    }
  }
}

// ============================================================
// EXPORT CSV
// ============================================================
function toCsv(headers, rows) {
  const escapeCell = value => {
    const str = value == null ? '' : String(value);
    if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  };
  const lines = [headers.map(escapeCell).join(',')];
  rows.forEach(row => lines.push(row.map(escapeCell).join(',')));
  return lines.join('\r\n');
}

function downloadCsv(filename, content) {
  // BOM supaya Excel membaca UTF-8 dengan benar.
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function exportProjects() {
  const rows = filterRows('projects').map(p => [
    p.title,
    p.category,
    p.description,
    p.image,
    Array.isArray(p.tech_stack) ? p.tech_stack.join('; ') : '',
    p.client,
    p.period,
    p.created_at,
  ]);
  downloadCsv(
    `proyek-${stamp()}.csv`,
    toCsv(['Judul', 'Kategori', 'Deskripsi', 'Gambar', 'Tech Stack', 'Klien', 'Periode', 'Dibuat'], rows)
  );
  showToast(`Diekspor ${rows.length} proyek ke CSV.`);
}

function exportMessages() {
  const rows = filterRows('messages').map(m => [
    m.is_read ? 'Sudah dibaca' : 'Belum dibaca',
    m.name,
    m.email,
    m.subject,
    m.message,
    m.created_at,
  ]);
  downloadCsv(
    `pesan-${stamp()}.csv`,
    toCsv(['Status', 'Nama', 'Email', 'Subjek', 'Pesan', 'Tanggal'], rows)
  );
  showToast(`Diekspor ${rows.length} pesan ke CSV.`);
}

function exportUsers() {
  const rows = filterRows('users').map(u => [u.name, u.email, u.role, u.created_at]);
  downloadCsv(`user-${stamp()}.csv`, toCsv(['Nama', 'Email', 'Role', 'Terdaftar'], rows));
  showToast(`Diekspor ${rows.length} user ke CSV.`);
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
    // 42P17 = infinite recursion di policy. Kasih petunjuk yang actionable.
    const msg = String(error);
    if (msg.includes('infinite recursion') || msg.includes('42P17')) {
      return {
        ok: false,
        reason: 'error',
        message:
          'Policy RLS profiles bermasalah (infinite recursion). Jalankan ulang supabase-schema.sql di Supabase SQL Editor.',
      };
    }
    return { ok: false, reason: 'error', message: 'Gagal memuat profil: ' + msg };
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
  refreshCategoryFilter();
  renderProjects();
}

function renderProjects() {
  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;

  const info = getPaginated('projects');
  updateBulkBar('projects', 'projectBulkBar', 'projectSelectedCount');
  renderPagination('projectPagination', info, 'proyek');

  if (info.total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; display:block; margin-bottom:12px;"></i>
          ${state.projects.length === 0
            ? 'Belum ada proyek. Tambahkan proyek pertama Anda.'
            : 'Tidak ada proyek yang cocok dengan filter.'}
        </td>
      </tr>`;
    return;
  }

  const selected = state.selection.projects;

  tbody.innerHTML = info.slice.map(p => `
    <tr class="${selected.has(p.id) ? 'admin-row-selected' : ''}">
      <td class="admin-col-check">
        <input type="checkbox" data-project-check="${escapeHtml(p.id)}"
          ${selected.has(p.id) ? 'checked' : ''} aria-label="Pilih ${escapeHtml(p.title)}">
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          ${p.image
            ? `<img src="${escapeHtml(p.image)}" alt="" loading="lazy" style="width:48px; height:48px; object-fit:cover; border-radius:8px;">`
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
        <button class="btn btn-outline btn-sm" onclick="window.adminEditProject('${escapeHtml(p.id)}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-outline btn-sm" style="color:var(--accent); border-color:rgba(244,63,94,.4);" onclick="window.adminDeleteProject('${escapeHtml(p.id)}')" title="Hapus">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-project-check]').forEach(box => {
    box.addEventListener('change', () => {
      const id = box.getAttribute('data-project-check');
      if (box.checked) state.selection.projects.add(id);
      else state.selection.projects.delete(id);
      renderProjects();
    });
  });
}

function updateImagePreview(url) {
  const preview = document.getElementById('projectImagePreview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview gambar proyek">`;
  } else {
    preview.innerHTML = '<i class="fa-solid fa-image"></i>';
  }
}

function updateImageClearButton() {
  const btn = document.getElementById('projectImageClearBtn');
  if (!btn) return;
  const hasImage = state.pendingImageFile || document.getElementById('projectImage').value.trim();
  btn.style.display = hasImage ? 'inline-flex' : 'none';
}

async function uploadProjectImage(file) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await window.supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = window.supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function removeStoredImage(path) {
  if (!path || !path.includes(`/${STORAGE_BUCKET}/`)) return;
  const { error } = await window.supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.warn('[Admin] Gagal menghapus gambar lama:', error.message);
}

function resetProjectForm() {
  state.editingProjectId = null;
  state.pendingImageFile = null;
  state.removingImagePath = null;

  const form = document.getElementById('projectForm');
  if (form) form.reset();

  const fileInput = document.getElementById('projectImageFile');
  if (fileInput) fileInput.value = '';

  const btn = document.getElementById('projectSubmitBtn');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-plus"></i> Tambah Proyek';

  const title = document.getElementById('projectFormTitle');
  if (title) title.textContent = 'Tambah Proyek Baru';

  updateImagePreview('');
  updateImageClearButton();
}

async function handleProjectSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('projectSubmitBtn');
  const originalText = btn ? btn.innerHTML : '';

  const title = document.getElementById('projectTitle').value.trim();
  const category = document.getElementById('projectCategory').value.trim();
  const imageUrlInput = document.getElementById('projectImage').value.trim();

  if (!title || !category) {
    showToast('Judul dan kategori proyek wajib diisi.', true);
    return;
  }

  if (state.pendingImageFile && state.pendingImageFile.size > MAX_IMAGE_BYTES) {
    showToast('Ukuran gambar melebihi 5 MB.', true);
    return;
  }

  const payload = {
    title,
    category,
    description: document.getElementById('projectDescription').value.trim(),
    image: imageUrlInput,
    tech_stack: document.getElementById('projectTechStack').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
    client: document.getElementById('projectClient').value.trim(),
    period: document.getElementById('projectPeriod').value.trim(),
  };

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
  }

  try {
    if (state.pendingImageFile) {
      const uploaded = await uploadProjectImage(state.pendingImageFile);
      payload.image = uploaded.url;
      await removeStoredImage(state.removingImagePath);
    } else if (payload.image && state.removingImagePath) {
      // Gambar diganti dengan URL lain, bersihkan file storage yang lama.
      await removeStoredImage(state.removingImagePath);
    }

    state.removingImagePath = null;

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
      updateStats();
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
  state.pendingImageFile = null;

  const urlInput = document.getElementById('projectImage');
  if (urlInput) urlInput.value = p.image || '';

  // Simpan path storage lama supaya bisa dihapus saat user ganti gambar.
  if (p.image && p.image.includes(`/${STORAGE_BUCKET}/`)) {
    const match = p.image.split(`/${STORAGE_BUCKET}/`)[1];
    state.removingImagePath = match ? `${STORAGE_BUCKET}/${match}` : null;
  } else {
    state.removingImagePath = null;
  }

  document.getElementById('projectTitle').value = p.title || '';
  document.getElementById('projectCategory').value = p.category || '';
  document.getElementById('projectDescription').value = p.description || '';
  document.getElementById('projectTechStack').value = Array.isArray(p.tech_stack) ? p.tech_stack.join(', ') : '';
  document.getElementById('projectClient').value = p.client || '';
  document.getElementById('projectPeriod').value = p.period || '';

  const btn = document.getElementById('projectSubmitBtn');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Perubahan';
  const title = document.getElementById('projectFormTitle');
  if (title) title.textContent = 'Edit Proyek';

  updateImagePreview(p.image || '');
  updateImageClearButton();
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
    if (p.image && p.image.includes(`/${STORAGE_BUCKET}/`)) {
      await removeStoredImage(p.image.split(`/${STORAGE_BUCKET}/`)[1]);
    }
    state.selection.projects.delete(id);
    await loadProjects();
    updateStats();
  }
}

async function bulkDeleteProjects() {
  const ids = [...state.selection.projects];
  if (ids.length === 0) return;
  if (!confirm(`Hapus ${ids.length} proyek sekaligus? Tindakan ini tidak bisa dibatalkan.`)) return;

  const { data, error } = await fetchByIds('projects', ids);
  if (error) {
    showToast('Gagal menghapus proyek: ' + friendlyError(error), true);
    return;
  }

  const { error: delError } = await window.supabase.from('projects').delete().in('id', ids);
  if (delError) {
    showToast('Gagal menghapus proyek: ' + friendlyError(delError), true);
    return;
  }

  for (const p of data || []) {
    if (p.image && p.image.includes(`/${STORAGE_BUCKET}/`)) {
      await removeStoredImage(p.image.split(`/${STORAGE_BUCKET}/`)[1]);
    }
  }

  clearSelection('projects');
  showToast(`${ids.length} proyek berhasil dihapus.`);
  await loadProjects();
  updateStats();
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

  const info = getPaginated('messages');
  updateBulkBar('messages', 'messageBulkBar', 'messageSelectedCount');
  renderPagination('messagePagination', info, 'pesan');

  if (info.total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-inbox" style="font-size: 2rem; display:block; margin-bottom:12px;"></i>
          ${state.messages.length === 0
            ? 'Belum ada pesan masuk.'
            : 'Tidak ada pesan yang cocok dengan filter.'}
        </td>
      </tr>`;
    return;
  }

  const selected = state.selection.messages;

  tbody.innerHTML = info.slice.map(m => `
    <tr class="${selected.has(m.id) ? 'admin-row-selected' : ''}">
      <td class="admin-col-check">
        <input type="checkbox" data-message-check="${escapeHtml(m.id)}"
          ${selected.has(m.id) ? 'checked' : ''} aria-label="Pilih pesan dari ${escapeHtml(m.name)}">
      </td>
      <td>
        ${m.is_read
          ? '<span class="admin-read-badge read"><i class="fa-solid fa-envelope-open"></i> Dibaca</span>'
          : '<span class="admin-read-badge unread"><i class="fa-solid fa-envelope"></i> Baru</span>'}
      </td>
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${escapeHtml(m.email)}</td>
      <td>${escapeHtml(m.subject || '-')}</td>
      <td style="max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(m.message)}</td>
      <td>${formatDate(m.created_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="window.adminViewMessage('${escapeHtml(m.id)}')" title="Lihat Detail">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="btn btn-outline btn-sm" onclick="window.adminToggleRead('${escapeHtml(m.id)}')"
          title="${m.is_read ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'}">
          <i class="fa-solid ${m.is_read ? 'fa-envelope' : 'fa-envelope-open'}"></i>
        </button>
        <button class="btn btn-outline btn-sm" style="color:var(--accent); border-color:rgba(244,63,94,.4);" onclick="window.adminDeleteMessage('${escapeHtml(m.id)}')" title="Hapus">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-message-check]').forEach(box => {
    box.addEventListener('change', () => {
      const id = box.getAttribute('data-message-check');
      if (box.checked) state.selection.messages.add(id);
      else state.selection.messages.delete(id);
      renderMessages();
    });
  });
}

function closeMessageModal() {
  const modal = document.getElementById('messageModal');
  if (modal) modal.classList.remove('active');
  state.viewingMessageId = null;
}

async function viewMessage(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;

  state.viewingMessageId = id;

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
    <div style="margin-bottom:16px;">
      <strong style="color:var(--text-muted);">Status:</strong>
      <div style="margin-top:4px;">
        ${m.is_read
          ? '<span class="admin-read-badge read"><i class="fa-solid fa-envelope-open"></i> Sudah dibaca</span>'
          : '<span class="admin-read-badge unread"><i class="fa-solid fa-envelope"></i> Belum dibaca</span>'}
      </div>
    </div>
    <div>
      <strong style="color:var(--text-muted);">Pesan:</strong>
      <div style="margin-top:8px; padding:16px; background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:var(--radius-md); white-space:pre-wrap; line-height:1.7;">${escapeHtml(m.message)}</div>
    </div>
  `;

  const toggleBtn = document.getElementById('toggleReadModalBtn');
  if (toggleBtn) {
    toggleBtn.innerHTML = m.is_read
      ? '<i class="fa-solid fa-envelope"></i> Tandai Belum Dibaca'
      : '<i class="fa-solid fa-envelope-open"></i> Tandai Sudah Dibaca';
  }

  modal.classList.add('active');
}

async function setMessageRead(id, isRead) {
  const { error } = await window.supabase
    .from('contact_messages')
    .update({ is_read: isRead })
    .eq('id', id);

  if (error) {
    showToast('Gagal mengubah status pesan: ' + friendlyError(error), true);
    return;
  }

  const local = state.messages.find(m => m.id === id);
  if (local) local.is_read = isRead;
  updateStats();
  await loadMessages();

  if (state.viewingMessageId === id) {
    viewMessage(id);
  }
}

async function toggleMessageRead(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;
  await setMessageRead(id, !m.is_read);
  showToast(m.is_read ? 'Pesan ditandai belum dibaca.' : 'Pesan ditandai sudah dibaca.');
}

async function bulkSetMessageRead(ids, isRead) {
  if (ids.length === 0) return;
  const { error } = await window.supabase
    .from('contact_messages')
    .update({ is_read: isRead })
    .in('id', ids);

  if (error) {
    showToast('Gagal memperbarui status pesan: ' + friendlyError(error), true);
    return;
  }

  ids.forEach(id => {
    const local = state.messages.find(m => m.id === id);
    if (local) local.is_read = isRead;
  });

  updateStats();
  await loadMessages();
  showToast(`${ids.length} pesan ditandai ${isRead ? 'sudah dibaca' : 'belum dibaca'}.`);
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
    if (state.viewingMessageId === id) closeMessageModal();
    state.selection.messages.delete(id);
    await loadMessages();
    updateStats();
  }
}

async function bulkDeleteMessages() {
  const ids = [...state.selection.messages];
  if (ids.length === 0) return;
  if (!confirm(`Hapus ${ids.length} pesan sekaligus?`)) return;

  const { error } = await window.supabase.from('contact_messages').delete().in('id', ids);
  if (error) {
    showToast('Gagal menghapus pesan: ' + friendlyError(error), true);
    return;
  }

  clearSelection('messages');
  showToast(`${ids.length} pesan berhasil dihapus.`);
  await loadMessages();
  updateStats();
}

function replyToMessage() {
  const m = state.messages.find(x => x.id === state.viewingMessageId);
  if (!m) return;
  const subject = m.subject ? `Re: ${m.subject}` : 'Re: Pesan Anda di PaulFolio';
  window.location.href = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(subject)}`;
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

  const info = getPaginated('users');
  updateBulkBar('users', 'userBulkBar', 'userSelectedCount');
  renderPagination('userPagination', info, 'user');

  if (info.total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-users" style="font-size: 2rem; display:block; margin-bottom:12px;"></i>
          ${state.users.length === 0
            ? 'Belum ada user terdaftar.'
            : 'Tidak ada user yang cocok dengan filter.'}
        </td>
      </tr>`;
    return;
  }

  const selected = state.selection.users;

  tbody.innerHTML = info.slice.map(u => {
    const roleClass = ROLE_CLASS[u.role] || '';
    return `
    <tr class="${selected.has(u.id) ? 'admin-row-selected' : ''}">
      <td class="admin-col-check">
        <input type="checkbox" data-user-check="${escapeHtml(u.id)}"
          ${selected.has(u.id) ? 'checked' : ''} aria-label="Pilih ${escapeHtml(u.name)}">
      </td>
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="${roleClass}" style="font-weight:600; text-transform:capitalize;">${escapeHtml(u.role)}</span></td>
      <td>${formatDate(u.created_at)}</td>
      <td>
        <select data-role-select="${escapeHtml(u.id)}"
          style="background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-glass); border-radius:8px; padding:6px 10px; font-size:0.85rem;">
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
          <option value="designer" ${u.role === 'designer' ? 'selected' : ''}>designer</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" style="color:var(--accent); border-color:rgba(244,63,94,.4);" onclick="window.adminDeleteUser('${escapeHtml(u.id)}')" title="Hapus User">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `;}).join('');

  tbody.querySelectorAll('[data-user-check]').forEach(box => {
    box.addEventListener('change', () => {
      const id = box.getAttribute('data-user-check');
      if (box.checked) state.selection.users.add(id);
      else state.selection.users.delete(id);
      renderUsers();
    });
  });

  // Select role di-bind via listener, bukan inline onchange, supaya
  // tag HTML tidak harus meng-escape nilai id.
  tbody.querySelectorAll('[data-role-select]').forEach(select => {
    select.addEventListener('change', () => {
      changeRole(select.getAttribute('data-role-select'), select.value);
    });
  });
}

async function changeRole(userId, newRole) {
  if (!['user', 'designer', 'admin'].includes(newRole)) return;

  const target = state.users.find(u => u.id === userId);
  if (!target) return;

  const currentUser = await window.getCurrentUser();
  if (currentUser && currentUser.id === userId && target.role === 'admin' && newRole !== 'admin') {
    showToast('Anda tidak dapat menurunkan role admin sendiri.', true);
    await loadUsers();
    return;
  }

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
    updateStats();
  }
}

async function bulkChangeRole(newRole) {
  const ids = [...state.selection.users];
  if (ids.length === 0) return;
  if (!['user', 'designer', 'admin'].includes(newRole)) {
    showToast('Pilih role tujuan terlebih dahulu.', true);
    return;
  }
  if (!confirm(`Ubah role ${ids.length} user menjadi "${newRole}"?`)) return;

  const currentUser = await window.getCurrentUser();
  if (currentUser && ids.includes(currentUser.id) && newRole !== 'admin') {
    showToast('Anda tidak dapat menurunkan role admin sendiri.', true);
    await loadUsers();
    return;
  }

  const { error } = await window.supabase
    .from('profiles')
    .update({ role: newRole })
    .in('id', ids);

  if (error) {
    showToast('Gagal mengubah role: ' + friendlyError(error), true);
    return;
  }

  showToast(`${ids.length} user berhasil diubah menjadi "${newRole}".`);
  await loadUsers();
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
    state.selection.users.delete(userId);
    await loadUsers();
    updateStats();
  }
}

async function bulkDeleteUsers() {
  const ids = [...state.selection.users];
  if (ids.length === 0) return;

  const currentUser = await window.getCurrentUser();
  const selfIds = currentUser ? ids.filter(id => id === currentUser.id) : [];
  if (selfIds.length > 0) {
    showToast('Anda tidak dapat menghapus akun sendiri. Deselect baris Anda lalu coba lagi.', true);
    return;
  }

  if (!confirm(`Hapus ${ids.length} user sekaligus? Data auth harus dihapus manual di dashboard Supabase.`)) return;

  const { error } = await window.supabase.from('profiles').delete().in('id', ids);
  if (error) {
    showToast('Gagal menghapus user: ' + friendlyError(error), true);
    return;
  }

  clearSelection('users');
  showToast(`${ids.length} user berhasil dihapus.`);
  await loadUsers();
  updateStats();
}

// ============================================================
// SELECT ALL HANDLER (umum untuk 3 tabel)
function bindSelectAll(key, renderFn) {
  const selectAll = document.getElementById(key + 'SelectAll');
  if (!selectAll) return;

  selectAll.addEventListener('change', () => {
    const visible = getVisibleIds(key);
    if (selectAll.checked) visible.forEach(id => state.selection[key].add(id));
    else visible.forEach(id => state.selection[key].delete(id));
    renderFn();
  });
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

  renderActiveTab();
}

// ============================================================
// BIND SEMUA EVENT
// ============================================================
function bindEvents() {
  // Logout (desktop + mobile)
  const doLogout = async () => {
    await window.signOut();
    window.location.href = 'index.html';
  };
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  const logoutBtnMobile = document.getElementById('adminLogoutBtnMobile');
  if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', doLogout);

  // Tab
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
  });

  // Stat card "belum dibaca" bisa diklik untuk lompat ke tab pesan
  const unreadCard = document.getElementById('statUnreadCard');
  if (unreadCard) {
    unreadCard.addEventListener('click', () => {
      state.filters.messages.read = 'unread';
      state.filters.messages.page = 1;
      const filterSelect = document.getElementById('messageReadFilter');
      if (filterSelect) filterSelect.value = 'unread';
      switchTab('messages');
    });
  }

  // --- Project form ---
  const projectForm = document.getElementById('projectForm');
  if (projectForm) projectForm.addEventListener('submit', handleProjectSubmit);

  const cancelProjectBtn = document.getElementById('projectCancelBtn');
  if (cancelProjectBtn) cancelProjectBtn.addEventListener('click', resetProjectForm);

  const imageFileInput = document.getElementById('projectImageFile');
  if (imageFileInput) {
    imageFileInput.addEventListener('change', () => {
      const file = imageFileInput.files && imageFileInput.files[0];
      state.pendingImageFile = file || null;
      if (file) {
        if (file.size > MAX_IMAGE_BYTES) {
          showToast('Ukuran gambar melebihi 5 MB.', true);
          imageFileInput.value = '';
          state.pendingImageFile = null;
          updateImagePreview(document.getElementById('projectImage').value.trim());
          updateImageClearButton();
          return;
        }
        updateImagePreview(URL.createObjectURL(file));
      }
      updateImageClearButton();
    });
  }

  const imageUrlInput = document.getElementById('projectImage');
  if (imageUrlInput) {
    imageUrlInput.addEventListener('input', () => {
      // URL manual menimpa preview file yang dipilih.
      if (imageUrlInput.value.trim()) {
        state.pendingImageFile = null;
        if (imageFileInput) imageFileInput.value = '';
      }
      updateImagePreview(imageUrlInput.value.trim());
      updateImageClearButton();
    });
  }

  const imageClearBtn = document.getElementById('projectImageClearBtn');
  if (imageClearBtn) {
    imageClearBtn.addEventListener('click', () => {
      state.pendingImageFile = null;
      if (imageUrlInput) imageUrlInput.value = '';
      if (imageFileInput) imageFileInput.value = '';
      updateImagePreview('');
      updateImageClearButton();
    });
  }

  // --- Projects toolbar ---
  const projectSearch = document.getElementById('projectSearch');
  if (projectSearch) {
    let t;
    projectSearch.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.filters.projects.search = projectSearch.value;
        state.filters.projects.page = 1;
        renderProjects();
      }, 200);
    });
  }

  const projectCategoryFilter = document.getElementById('projectCategoryFilter');
  if (projectCategoryFilter) {
    projectCategoryFilter.addEventListener('change', () => {
      state.filters.projects.category = projectCategoryFilter.value;
      state.filters.projects.page = 1;
      renderProjects();
    });
  }

  const projectExportBtn = document.getElementById('projectExportBtn');
  if (projectExportBtn) projectExportBtn.addEventListener('click', exportProjects);

  const projectBulkDeleteBtn = document.getElementById('projectBulkDeleteBtn');
  if (projectBulkDeleteBtn) projectBulkDeleteBtn.addEventListener('click', bulkDeleteProjects);

  const projectBulkClearBtn = document.getElementById('projectBulkClearBtn');
  if (projectBulkClearBtn) {
    projectBulkClearBtn.addEventListener('click', () => clearSelection('projects'));
  }

  bindSelectAll('projects', renderProjects);

  // --- Messages toolbar ---
  const messageSearch = document.getElementById('messageSearch');
  if (messageSearch) {
    let t;
    messageSearch.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.filters.messages.search = messageSearch.value;
        state.filters.messages.page = 1;
        renderMessages();
      }, 200);
    });
  }

  const messageReadFilter = document.getElementById('messageReadFilter');
  if (messageReadFilter) {
    messageReadFilter.addEventListener('change', () => {
      state.filters.messages.read = messageReadFilter.value;
      state.filters.messages.page = 1;
      renderMessages();
    });
  }

  const messageExportBtn = document.getElementById('messageExportBtn');
  if (messageExportBtn) messageExportBtn.addEventListener('click', exportMessages);

  const messageBulkReadBtn = document.getElementById('messageBulkReadBtn');
  if (messageBulkReadBtn) {
    messageBulkReadBtn.addEventListener('click', () => bulkSetMessageRead([...state.selection.messages], true));
  }

  const messageBulkUnreadBtn = document.getElementById('messageBulkUnreadBtn');
  if (messageBulkUnreadBtn) {
    messageBulkUnreadBtn.addEventListener('click', () => bulkSetMessageRead([...state.selection.messages], false));
  }

  const messageBulkDeleteBtn = document.getElementById('messageBulkDeleteBtn');
  if (messageBulkDeleteBtn) messageBulkDeleteBtn.addEventListener('click', bulkDeleteMessages);

  const messageBulkClearBtn = document.getElementById('messageBulkClearBtn');
  if (messageBulkClearBtn) {
    messageBulkClearBtn.addEventListener('click', () => clearSelection('messages'));
  }

  bindSelectAll('messages', renderMessages);

  // --- Users toolbar ---
  const userSearch = document.getElementById('userSearch');
  if (userSearch) {
    let t;
    userSearch.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.filters.users.search = userSearch.value;
        state.filters.users.page = 1;
        renderUsers();
      }, 200);
    });
  }

  const userRoleFilter = document.getElementById('userRoleFilter');
  if (userRoleFilter) {
    userRoleFilter.addEventListener('change', () => {
      state.filters.users.role = userRoleFilter.value;
      state.filters.users.page = 1;
      renderUsers();
    });
  }

  const userExportBtn = document.getElementById('userExportBtn');
  if (userExportBtn) userExportBtn.addEventListener('click', exportUsers);

  const userBulkRoleBtn = document.getElementById('userBulkRoleBtn');
  if (userBulkRoleBtn) {
    userBulkRoleBtn.addEventListener('click', () => {
      const select = document.getElementById('userBulkRoleSelect');
      if (select) bulkChangeRole(select.value);
    });
  }

  const userBulkDeleteBtn = document.getElementById('userBulkDeleteBtn');
  if (userBulkDeleteBtn) userBulkDeleteBtn.addEventListener('click', bulkDeleteUsers);

  const userBulkClearBtn = document.getElementById('userBulkClearBtn');
  if (userBulkClearBtn) {
    userBulkClearBtn.addEventListener('click', () => clearSelection('users'));
  }

  bindSelectAll('users', renderUsers);

  // --- Message modal ---
  const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
  if (closeMessageModalBtn) closeMessageModalBtn.addEventListener('click', closeMessageModal);

  const closeMessageModalFooterBtn = document.getElementById('closeMessageModalFooterBtn');
  if (closeMessageModalFooterBtn) closeMessageModalFooterBtn.addEventListener('click', closeMessageModal);

  const replyMessageModalBtn = document.getElementById('replyMessageModalBtn');
  if (replyMessageModalBtn) replyMessageModalBtn.addEventListener('click', replyToMessage);

  const toggleReadModalBtn = document.getElementById('toggleReadModalBtn');
  if (toggleReadModalBtn) {
    toggleReadModalBtn.addEventListener('click', () => {
      if (state.viewingMessageId) toggleMessageRead(state.viewingMessageId);
    });
  }

  const messageModal = document.getElementById('messageModal');
  if (messageModal) {
    messageModal.addEventListener('click', event => {
      if (event.target === messageModal) closeMessageModal();
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMessageModal();
      const drawer = document.getElementById('mobileDrawer');
      if (drawer) drawer.classList.remove('active');
    }
  });
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

  bindEvents();
  updateImageClearButton();

  // Expose functions ke global scope (untuk onclick di HTML)
  window.adminEditProject = editProject;
  window.adminDeleteProject = deleteProject;
  window.adminViewMessage = viewMessage;
  window.adminToggleRead = toggleMessageRead;
  window.adminDeleteMessage = deleteMessage;
  window.adminChangeRole = changeRole;
  window.adminDeleteUser = deleteUser;

  // Load data awal
  await Promise.all([loadProjects(), loadMessages(), loadUsers()]);
  updateStats();
}

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
