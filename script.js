/**
 * PaulFolio — Main JavaScript Logic & Dynamic Interactions
 */

function initApp() {
  try {

  // ==========================================
  // 1. TYPEWRITER EFFECT IN HERO SECTION
  // ==========================================
  const typewriterElement = document.getElementById('typewriter');
  const roles = [
    "Creative Designer",
    "IT Specialist",
    "Web Developer",
    "Multimedia Designer",
    "CCTV Specialist"
  ];
  let roleIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typingSpeed = 100;

  function typeWriter() {
    const currentRole = roles[roleIndex];

    if (isDeleting) {
      typewriterElement.textContent = currentRole.substring(0, charIndex - 1);
      charIndex--;
      typingSpeed = 40;
    } else {
      typewriterElement.textContent = currentRole.substring(0, charIndex + 1);
      charIndex++;
      typingSpeed = 90;
    }

    if (!isDeleting && charIndex === currentRole.length) {
      isDeleting = true;
      typingSpeed = 2000; // Pause at full word
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
      typingSpeed = 500;
    }

    setTimeout(typeWriter, typingSpeed);
  }

  if (typewriterElement) {
    typeWriter();
  }

  // ==========================================
  // 2. STICKY NAVBAR & ACTIVE PAGE HIGHLIGHT
  // ==========================================
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      const backToTopBtn = document.getElementById('backToTopBtn');
      if (backToTopBtn) {
        if (window.scrollY > 400) {
          backToTopBtn.style.opacity = '1';
          backToTopBtn.style.pointerEvents = 'auto';
        } else {
          backToTopBtn.style.opacity = '0';
          backToTopBtn.style.pointerEvents = 'none';
        }
      }
    });
  }

  // Highlight active menu link based on current page URL
  const currentPath = window.location.pathname;
  let pageName = currentPath.substring(currentPath.lastIndexOf('/') + 1);
  if (!pageName || pageName === '') pageName = 'index.html';

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      if (href === pageName || (pageName === 'index.html' && (href === '/' || href === 'index.html'))) {
        link.classList.add('active');
      }
    }
  });

  // ==========================================
  // 3. MOBILE DRAWER NAVIGATION TOGGLE
  // ==========================================
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  if (mobileMenuBtn && mobileDrawer) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileDrawer.classList.toggle('open');
      const icon = mobileMenuBtn.querySelector('i');
      if (mobileDrawer.classList.contains('open')) {
        icon.className = 'fa-solid fa-xmark';
      } else {
        icon.className = 'fa-solid fa-bars';
      }
    });

    mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
      });
    });
  }

  // ==========================================
  // 4. ANIMATED STAT COUNTERS
  // ==========================================
  const statNumbers = document.querySelectorAll('.stat-number');
  let hasAnimatedStats = false;

  function animateCounters() {
    if (hasAnimatedStats) return;
    const heroStats = document.querySelector('.hero-stats');
    if (!heroStats) return;

    const rect = heroStats.getBoundingClientRect();
    if (rect.top <= window.innerHeight && rect.bottom >= 0) {
      hasAnimatedStats = true;
      statNumbers.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const duration = 1500; // ms
        const increment = target / (duration / 16);

        let current = 0;
        const updateCounter = () => {
          current += increment;
          if (current < target) {
            counter.textContent = Math.ceil(current);
            requestAnimationFrame(updateCounter);
          } else {
            counter.textContent = target;
          }
        };
        updateCounter();
      });
    }
  }

  window.addEventListener('scroll', animateCounters);
  animateCounters(); // Trigger on load if in view

  // ==========================================
  // 5. PROJECT CATEGORY FILTERING
  // ==========================================
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filterValue === 'all' || category === filterValue) {
          card.classList.remove('hide');
          card.style.animation = 'fadeIn 0.5s ease forward';
        } else {
          card.classList.add('hide');
        }
      });
    });
  });

  // ==========================================
  // 6. PROJECT DETAIL MODAL DATA & HANDLERS
  // ==========================================
  const projectDetailsMap = {
    "1": {
      title: "SaaS Analytics & Cloud Dashboard",
      badge: "Web Application",
      image: "./assets/images/project1.png",
      client: "CloudPulse Enterprise",
      period: "3 Bulan (2025)",
      description: "Platform analytics SaaS tingkat tinggi yang mampu mengolah jutaan baris data setiap detik. Dilengkapi dengan visualisasi grafik interaktif, statistik pendapatan real-time, ekspor laporan otomatis, serta otentikasi peran pengguna ganda.",
      challenges: "Mengoptimalkan performa rendering chart dan kueri database besar tanpa menghambat antarmuka pengguna.",
      solutions: "Menggunakan WebSockets untuk data streaming, Redis untuk caching data, dan arsitektur komponen React yang modular.",
      techStack: ["Laravel 10", "React.js", "Tailwind CSS", "Chart.js", "Redis", "MySQL"]
    },
    "2": {
      title: "CryptoPay FinTech Companion App",
      badge: "Mobile App",
      image: "./assets/images/project2.png",
      client: "CryptoPay Global",
      period: "4 Bulan (2025)",
      description: "Aplikasi dompet digital serbaguna untuk bertransaksi dan memantau portofolio aset kripto secara cepat dan aman. Memiliki fitur keamanan biometrik (FaceID/Fingerprint), notifikasi perubahan harga, dan swap token instan.",
      challenges: "Menjamin keamanan transaksi Web3 dan sinkronisasi real-time harga aset dari berbagai pertukaran crypto.",
      solutions: "Implementasi protokol enkripsi bertingkat tinggi dan API WebSocket berkecepatan tinggi.",
      techStack: ["React Native", "TypeScript", "Node.js", "Web3.js", "Firebase", "Redux Toolkit"]
    },
    "3": {
      title: "Luxe Commerce Luxury Storefront",
      badge: "UI/UX Design",
      image: "./assets/images/project3.png",
      client: "Luxe Group Indonesia",
      period: "2 Bulan (2024)",
      description: "Desain sistem antarmuka antarmuka eksklusif untuk toko ritel mewah. Mengusung konsep visual dark glassmorphism modern dengan micro-animations yang mulus untuk meningkatkan angka konversi belanja.",
      challenges: "Menciptakan kesan mewah yang eksklusif tanpa mengorbankan kecepatan navigasi dan kemudahan akses di layar seluler.",
      solutions: "Merancang Design System Figma yang komprehensif lengkap dengan aturan tipografi, komponen reusable, dan skenario pengujian pengguna.",
      techStack: ["Figma", "UI/UX Research", "Interactive Prototype", "Design System"]
    },
    "4": {
      title: "AI Content Generator Suite",
      badge: "Web Application",
      image: "./assets/images/project1.png",
      client: "MediaCraft AI",
      period: "2.5 Bulan (2025)",
      description: "Platform pembuatan konten otomatis yang memanfaatkan model bahasa LLM OpenAI. Pengguna dapat menghasilkan artikel blog, postingan sosial media, dan desain gambar dalam hitungan detik.",
      challenges: "Menangani batas kecepatan API (rate-limiting) dan pemrosesan latar belakang untuk generasi konten panjang.",
      solutions: "Sistem antrean tugas (Queue system) berbasis BullMQ dan pemicu respons berbasis Server-Sent Events (SSE).",
      techStack: ["Next.js 14", "OpenAI API", "PostgreSQL", "Prisma ORM", "Tailwind CSS"]
    },
    "5": {
      title: "HealthPulse Smart Fitness Tracker",
      badge: "Mobile App",
      image: "./assets/images/project2.png",
      client: "HealthPulse Tech",
      period: "3 Bulan (2024)",
      description: "Aplikasi seluler yang terintegrasi dengan perangkat jam tangan pintar untuk memantau detak jantung, pola tidur, jumlah langkah harian, serta analisis kalori yang terbakar.",
      challenges: "Konektivitas Bluetooth Low Energy (BLE) yang stabil di berbagai perangkat Android dan iOS.",
      solutions: "Penggunaan pustaka BLE kustom dengan mekanisme auto-reconnect cerdas.",
      techStack: ["Flutter", "Dart", "Firebase Firestore", "Bluetooth LE API"]
    },
    "6": {
      title: "Quantum Server & Hosting Console",
      badge: "Web Application",
      image: "./assets/images/project3.png",
      client: "Quantum Networks",
      period: "5 Bulan (2024)",
      description: "Konsol manajemen server cloud terpusat yang memudahkan pengembang menyebarkan (deploy) kontainer Docker, mengelola sertifikat SSL, dan mengawasi kesehatan infrastruktur.",
      challenges: "Eksekusi perintah terminal jarak jauh secara aman dan pemantauan beban server.",
      solutions: "Koneksi SSH terenkripsi dan agen pemantauan berbasis Golang yang ringan.",
      techStack: ["Vue.js 3", "Golang", "Docker API", "Tailwind CSS", "Linux CLI"]
    }
  };

  const projectModal = document.getElementById('projectModal');
  const modalProjectTitle = document.getElementById('modalProjectTitle');
  const modalProjectBody = document.getElementById('modalProjectBody');
  const viewProjectBtns = document.querySelectorAll('.view-project-btn');
  const closeProjectModalBtn = document.getElementById('closeProjectModalBtn');
  const closeProjectModalFooterBtn = document.getElementById('closeProjectModalFooterBtn');

  function openProjectModal(id) {
    const data = projectDetailsMap[id];
    if (!data) return;

    modalProjectTitle.textContent = data.title;
    
    let techTagsHtml = data.techStack.map(tech => `<span class="tag">${tech}</span>`).join(' ');

    modalProjectBody.innerHTML = `
      <div style="margin-bottom: 20px;">
        <img src="${data.image}" alt="${data.title}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px; margin-bottom: 20px;">
        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px;">
          <div><strong style="color: var(--text-muted);">Kategori:</strong> <span class="text-white">${data.badge}</span></div>
          <div><strong style="color: var(--text-muted);">Klien:</strong> <span class="text-white">${data.client}</span></div>
          <div><strong style="color: var(--text-muted);">Pengerjaan:</strong> <span class="text-white">${data.period}</span></div>
        </div>
        
        <h4 style="color: var(--primary); margin-bottom: 8px;">Deskripsi Proyek:</h4>
        <p style="color: var(--text-muted); line-height: 1.7; margin-bottom: 16px;">${data.description}</p>
        
        <h4 style="color: var(--secondary); margin-bottom: 8px;">Tantangan Utama:</h4>
        <p style="color: var(--text-muted); line-height: 1.7; margin-bottom: 16px;">${data.challenges}</p>
        
        <h4 style="color: var(--emerald); margin-bottom: 8px;">Solusi Diterapkan:</h4>
        <p style="color: var(--text-muted); line-height: 1.7; margin-bottom: 20px;">${data.solutions}</p>
        
        <h4 style="margin-bottom: 10px;">Teknologi Digunakan:</h4>
        <div class="project-tags">${techTagsHtml}</div>
      </div>
    `;

    projectModal.classList.add('active');
  }

  viewProjectBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openProjectModal(id);
    });
  });

  if (closeProjectModalBtn) {
    closeProjectModalBtn.addEventListener('click', () => projectModal.classList.remove('active'));
  }
  if (closeProjectModalFooterBtn) {
    closeProjectModalFooterBtn.addEventListener('click', () => projectModal.classList.remove('active'));
  }

  // Click card body to open modal
  projectCards.forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-project-id');
      openProjectModal(id);
    });
  });

  // ==========================================
  // 7. CV MODAL HANDLERS & SIMULATED DOWNLOAD
  // ==========================================
  const cvModal = document.getElementById('cvModal');
  const cvHeaderBtn = document.getElementById('cvHeaderBtn');
  const cvMobileBtn = document.getElementById('cvMobileBtn');
  const openCvModalBtn = document.getElementById('openCvModalBtn');
  const closeCvModalBtn = document.getElementById('closeCvModalBtn');
  const closeCvModalFooterBtn = document.getElementById('closeCvModalFooterBtn');
  const downloadCvPdfBtn = document.getElementById('downloadCvPdfBtn');

  function openCvModal() {
    if (cvModal) cvModal.classList.add('active');
  }

  if (cvHeaderBtn) cvHeaderBtn.addEventListener('click', openCvModal);
  if (cvMobileBtn) cvMobileBtn.addEventListener('click', openCvModal);
  if (openCvModalBtn) openCvModalBtn.addEventListener('click', openCvModal);
  if (cvModal) cvModal.querySelector('.modal-close').addEventListener('click', () => cvModal.classList.remove('active'));
  if (closeCvModalFooterBtn) closeCvModalFooterBtn.addEventListener('click', () => cvModal.classList.remove('active'));

  if (downloadCvPdfBtn) {
    downloadCvPdfBtn.addEventListener('click', () => {
      showToast('⚡ Mengunduh file CV_Paul_FullStack_Engineer.pdf...');
    });
  }

  // Header "Hubungi Saya" button smooth scroll
  const hireHeaderBtn = document.getElementById('hireHeaderBtn');
  if (hireHeaderBtn) {
    hireHeaderBtn.addEventListener('click', () => {
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // ==========================================
  // 8. CONTACT FORM SUBMISSION & TOPIC SELECTION
  // ==========================================
  const topicChips = document.querySelectorAll('.topic-chip');
  const subjectInput = document.getElementById('subject');

  if (topicChips.length > 0 && subjectInput) {
    topicChips.forEach(chip => {
      chip.addEventListener('click', () => {
        topicChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const topic = chip.getAttribute('data-topic');
        if (topic) {
          subjectInput.value = topic;
        }
      });
    });
  }

  // ==========================================
  // NOTIFICATION BELL BUTTON IN NAVBAR
  // ==========================================
  const notifBellBtn = document.getElementById('notifBellBtn');
  const notifDot = document.getElementById('notifDot');
  const notifBellIcon = document.getElementById('notifBellIcon');

  function updateBellState() {
    if (!notifBellBtn) return;
    if (!('Notification' in window)) {
      notifBellBtn.title = 'Browser tidak mendukung notifikasi';
      notifBellBtn.classList.remove('active');
      if (notifDot) notifDot.classList.remove('show');
      return;
    }
    if (Notification.permission === 'granted') {
      notifBellBtn.classList.add('active');
      notifBellBtn.title = 'Notifikasi aktif — klik untuk tes';
      if (notifDot) notifDot.classList.remove('show');
      if (notifBellIcon) notifBellIcon.className = 'fa-solid fa-bell';
    } else if (Notification.permission === 'default') {
      notifBellBtn.classList.remove('active');
      if (notifDot) notifDot.classList.add('show');
      notifBellBtn.title = 'Klik untuk aktifkan notifikasi';
      if (notifBellIcon) notifBellIcon.className = 'fa-regular fa-bell';
    } else {
      notifBellBtn.classList.remove('active');
      notifBellBtn.title = 'Notifikasi diblokir — aktifkan di pengaturan browser';
      if (notifDot) notifDot.classList.remove('show');
      if (notifBellIcon) notifBellIcon.className = 'fa-solid fa-bell-slash';
    }
  }

  if (notifBellBtn) {
    updateBellState();
    notifBellBtn.addEventListener('click', async () => {
      // Animasi getar
      notifBellBtn.classList.add('ring');
      setTimeout(() => notifBellBtn.classList.remove('ring'), 600);

      if (!('Notification' in window)) {
        showToast('⚠️ Browser Anda tidak mendukung notifikasi.');
        return;
      }

      if (Notification.permission === 'granted') {
        // Kirim notifikasi tes
        try {
          new Notification('✅ PaulFolio — Notifikasi Aktif', {
            body: 'Notifikasi berfungsi dengan baik!',
            icon: './assets/images/favicon.png',
            tag: 'paulfolio-test',
          });
          showToast('🔔 Notifikasi tes berhasil dikirim!');
        } catch (e) {
          showToast('⚠️ Notifikasi sudah aktif.');
        }
        updateBellState();
        return;
      }

      if (Notification.permission === 'denied') {
        showToast('⚠️ Notifikasi diblokir. Aktifkan manual di pengaturan browser.');
        return;
      }

      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          notifBellBtn.classList.add('active');
          if (notifDot) notifDot.classList.remove('show');
          showToast('🔔 Notifikasi browser berhasil diaktifkan!');
          // Tampilkan notifikasi test
          new Notification('✅ PaulFolio — Notifikasi Aktif', {
            body: 'Anda akan menerima pemberitahuan saat ada pesan masuk.',
            icon: './assets/images/favicon.png',
            tag: 'paulfolio-activation',
          });
          updateBellState();
        } else {
          showToast('⚠️ Izin notifikasi ditolak.');
        }
      } catch (e) {
        showToast('⚠️ Gagal meminta izin notifikasi.');
        console.error('[PaulFolio] Notification permission error:', e);
      }
    });
  }

  window.handleFormSubmit = function(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const subjectInput = document.getElementById('subject');
    const messageInput = document.getElementById('message');

    if (submitBtn) {
      const originalText = submitBtn.innerHTML;
      const formData = {
        name: nameInput ? nameInput.value : 'Seseorang',
        email: emailInput ? emailInput.value : '-',
        subject: subjectInput ? subjectInput.value : '-',
        message: messageInput ? messageInput.value : '-',
      };

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim Pesan...`;

      // Simpan ke Supabase
      (async () => {
        try {
          if (typeof window.supabase !== 'undefined' && window.supabase) {
            const { error } = await window.supabase
              .from('contact_messages')
              .insert({
                name: formData.name,
                email: formData.email,
                subject: formData.subject,
                message: formData.message,
              });
            if (error) {
              console.warn('[Contact] Gagal menyimpan ke Supabase:', error.message);
            } else {
              console.log('[Contact] Pesan tersimpan ke Supabase');
            }
          }
        } catch (e) {
          console.warn('[Contact] Error saat menyimpan ke Supabase:', e);
        } finally {
          // Selalu tampilkan sukses ke user (optimistic UI)
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          document.getElementById('contactForm').reset();
          showToast(`🎉 Terima kasih ${formData.name}, pesan berhasil dikirim! Paul akan membalas segera.`);

          // Kirim notifikasi browser + WhatsApp
          if (typeof window.sendContactNotifications === 'function') {
            window.sendContactNotifications(formData);
          }
        }
      })();
    }
  };

  function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (toast && toastMessage) {
      toastMessage.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 4000);
    }
  }

  // Close modals when clicking outside content
  window.addEventListener('click', (e) => {
    if (projectModal && e.target === projectModal) projectModal.classList.remove('active');
    if (cvModal && e.target === cvModal) cvModal.classList.remove('active');
  });

  // Back to Top button action
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ==========================================
  // 9. AUTH STATE HANDLING (Navbar)
  // ==========================================
  updateAuthUI();

  async function updateAuthUI() {
    try {
      const authNavGroup = document.getElementById('authNavGroup');
      const authUserGroup = document.getElementById('authUserGroup');
      const authNavGroupMobile = document.getElementById('authNavGroupMobile');
      const authUserGroupMobile = document.getElementById('authUserGroupMobile');

      if (typeof window.getCurrentUser !== 'function') return;

      const user = await window.getCurrentUser();
      if (user) {
        // Logged in - show user name + logout
        let userName = user.email ? user.email.split('@')[0] : 'User';
        try {
          if (typeof window.getCurrentProfile === 'function') {
            const { data: profile } = await window.getCurrentProfile(user);
            if (profile && profile.name) userName = profile.name;
          }
        } catch (_) { /* ignore */ }

        const nameText = document.getElementById('navUserNameText');
        const nameTextMobile = document.getElementById('navUserNameTextMobile');
        if (nameText) nameText.textContent = userName;
        if (nameTextMobile) nameTextMobile.textContent = userName;

        if (authNavGroup) authNavGroup.style.display = 'none';
        if (authUserGroup) authUserGroup.style.display = 'flex';
        if (authNavGroupMobile) authNavGroupMobile.style.display = 'none';
        if (authUserGroupMobile) authUserGroupMobile.style.display = 'flex';

        // Bind logout buttons
        const logoutBtn = document.getElementById('navLogoutBtn');
        const logoutBtnMobile = document.getElementById('navLogoutBtnMobile');
        if (logoutBtn) {
          logoutBtn.onclick = async () => {
            if (typeof window.signOut === 'function') await window.signOut();
            window.location.href = 'index.html';
          };
        }
        if (logoutBtnMobile) {
          logoutBtnMobile.onclick = async () => {
            if (typeof window.signOut === 'function') await window.signOut();
            window.location.href = 'index.html';
          };
        }
      } else {
        // Logged out - show login/register buttons
        if (authNavGroup) authNavGroup.style.display = 'flex';
        if (authUserGroup) authUserGroup.style.display = 'none';
        if (authNavGroupMobile) authNavGroupMobile.style.display = 'flex';
        if (authUserGroupMobile) authUserGroupMobile.style.display = 'none';
      }
    } catch (e) {
      console.error('[Auth] Error updating auth UI:', e);
    }
  }

  // Listen for auth state changes
  if (typeof window.onAuthStateChange === 'function') {
    window.onAuthStateChange(() => {
      updateAuthUI();
    });
  }

  // ==========================================
  // 10. LOAD PROJECTS FROM SUPABASE (Projects Page)
  // ==========================================
  const projectsGrid = document.getElementById('projectsGrid');
  if (projectsGrid && typeof window.supabase !== 'undefined' && window.supabase) {
    (async () => {
      try {
        const { data: projects, error } = await window.supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[Projects] Gagal memuat dari Supabase:', error.message);
          return; // Keep hardcoded fallback
        }

        if (!projects || projects.length === 0) {
          console.log('[Projects] Tidak ada data di Supabase, menggunakan fallback.');
          return;
        }

        // Clear and rebuild grid from Supabase data
        projectsGrid.innerHTML = '';
        projects.forEach((p, index) => {
          const card = document.createElement('article');
          card.className = 'glass-card project-card';
          card.setAttribute('data-category', p.category.toLowerCase().replace(/\s+/g, '-'));
          card.setAttribute('data-project-id', p.id);

          const techTags = Array.isArray(p.tech_stack)
            ? p.tech_stack.map(t => `<span class="tag">${t}</span>`).join('')
            : '';

          card.innerHTML = `
            <div class="project-img-box">
              <img src="${p.image || './assets/images/project1.png'}" alt="${p.title}">
              <span class="project-badge">${p.category}</span>
              <div class="project-overlay">
                <button class="btn btn-primary btn-sm view-project-btn" data-id="${p.id}">
                  <i class="fa-solid fa-expand"></i> Detail Proyek
                </button>
              </div>
            </div>
            <div class="project-body">
              <h3 class="project-title">${p.title}</h3>
              <p class="project-snippet">${p.description || ''}</p>
              <div class="project-tags">${techTags}</div>
            </div>
          `;
          projectsGrid.appendChild(card);
        });

        // Re-initialize project modal handlers
        initProjectModals();
        console.log(`[Projects] ${projects.length} proyek dimuat dari Supabase.`);
      } catch (e) {
        console.warn('[Projects] Error memuat dari Supabase:', e);
      }
    })();
  }

  function initProjectModals() {
    const projectModal = document.getElementById('projectModal');
    const modalProjectTitle = document.getElementById('modalProjectTitle');
    const modalProjectBody = document.getElementById('modalProjectBody');
    const viewProjectBtns = document.querySelectorAll('.view-project-btn');
    const projectCards = document.querySelectorAll('.project-card');

    // Build details map from current grid cards
    const detailsMap = {};
    projectCards.forEach(card => {
      const id = card.getAttribute('data-project-id');
      const title = card.querySelector('.project-title')?.textContent || '';
      const snippet = card.querySelector('.project-snippet')?.textContent || '';
      const badge = card.querySelector('.project-badge')?.textContent || '';
      const img = card.querySelector('img')?.src || '';
      const tags = Array.from(card.querySelectorAll('.tag')).map(t => t.textContent);
      detailsMap[id] = {
        title,
        badge,
        image: img,
        description: snippet,
        techStack: tags,
      };
    });

    function openProjectModal(id) {
      const data = detailsMap[id];
      if (!data) return;

      modalProjectTitle.textContent = data.title;
      const techTagsHtml = data.techStack.map(tech => `<span class="tag">${tech}</span>`).join(' ');
      modalProjectBody.innerHTML = `
        <div style="margin-bottom: 20px;">
          <img src="${data.image}" alt="${data.title}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px; margin-bottom: 20px;">
          <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px;">
            <div><strong style="color: var(--text-muted);">Kategori:</strong> <span class="text-white">${data.badge}</span></div>
          </div>
          <h4 style="color: var(--primary); margin-bottom: 8px;">Deskripsi Proyek:</h4>
          <p style="color: var(--text-muted); line-height: 1.7; margin-bottom: 20px;">${data.description}</p>
          <h4 style="margin-bottom: 10px;">Teknologi Digunakan:</h4>
          <div class="project-tags">${techTagsHtml}</div>
        </div>
      `;
      projectModal.classList.add('active');
    }

    viewProjectBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openProjectModal(id);
      });
    });

    projectCards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-project-id');
        openProjectModal(id);
      });
    });
  }

  // ==========================================
  // 11. AUTH FORM HANDLERS (Login & Register)
  // ==========================================

  // Switch between login and register panels
  const switchLinks = document.querySelectorAll('.auth-switch-link');
  switchLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('data-switch');
      const loginPanel = document.getElementById('loginPanel');
      const registerPanel = document.getElementById('registerPanel');
      if (target === 'register') {
        if (loginPanel) loginPanel.style.display = 'none';
        if (registerPanel) registerPanel.style.display = 'block';
      } else {
        if (registerPanel) registerPanel.style.display = 'none';
        if (loginPanel) loginPanel.style.display = 'block';
      }
    });
  });


  window.handleLoginSubmit = async function (event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = document.getElementById('loginSubmitBtn');
    const alertBox = document.getElementById('authAlert');
    const alertMsg = document.getElementById('authAlertMessage');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      showAuthAlert('Email dan password wajib diisi.', true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    }

    try {
      const { success, message, error } = await window.signIn(email, password);
      if (success) {
        showAuthAlert(message || 'Login berhasil! Mengalihkan...', false);
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
      } else {
        showAuthAlert(error || 'Login gagal. Silakan coba lagi.', true);
      }
    } catch (e) {
      showAuthAlert('Terjadi kesalahan. Silakan coba lagi.', true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
      }
    }
  };

  window.handleRegisterSubmit = async function (event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = document.getElementById('registerSubmitBtn');
    const alertBox = document.getElementById('authAlert');
    const alertMsg = document.getElementById('authAlertMessage');

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!name || !email || !password) {
      showAuthAlert('Semua field wajib diisi.', true);
      return;
    }
    if (password.length < 6) {
      showAuthAlert('Password minimal 6 karakter.', true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    }

    try {
      // Role always 'user' — admin can change it later via admin panel
      const { success, needsEmailConfirm, message, error } = await window.signUp(email, password, 'user', name);
      if (success) {
        if (needsEmailConfirm) {
          showAuthAlert(message || 'Cek email Anda untuk konfirmasi akun.', false);
        } else {
          showAuthAlert(message || 'Pendaftaran berhasil! Silakan login.', false);
          setTimeout(() => {
            // Switch to login panel after successful registration
            const loginPanel = document.getElementById('loginPanel');
            const registerPanel = document.getElementById('registerPanel');
            if (loginPanel) loginPanel.classList.add('active');
            if (registerPanel) registerPanel.classList.remove('active');
          }, 1500);
        }
      } else {
        showAuthAlert(error || 'Pendaftaran gagal. Silakan coba lagi.', true);
      }
    } catch (e) {
      showAuthAlert('Terjadi kesalahan. Silakan coba lagi.', true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Daftar';
      }
    }
  };

  function showAuthAlert(message, isError) {
    const alertBox = document.getElementById('authAlert');
    const alertMsg = document.getElementById('authAlertMessage');
    const alertIcon = document.getElementById('authAlertIcon');
    if (!alertBox || !alertMsg) return;
    alertMsg.textContent = message;
    alertBox.style.display = 'flex';
    alertBox.className = 'auth-alert ' + (isError ? 'alert-error' : 'alert-success');
    if (alertIcon) {
      alertIcon.className = isError
        ? 'fa-solid fa-circle-exclamation'
        : 'fa-solid fa-circle-check';
    }
  }

} catch (err) {
  console.error('[PaulFolio] Script initialization error:', err);
}
}

// Safe bootstrap: works whether DOMContentLoaded has already fired or not
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
