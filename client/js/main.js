/* ============================================
   MINEATLAS — MAIN JAVASCRIPT
   ============================================ */

// Mobile Menu Toggle
(function() {
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileOverlay = document.getElementById('mobileOverlay');

    if (!mobileToggle || !mobileMenu || !mobileOverlay) return;

    mobileToggle.addEventListener('click', function() {
        mobileToggle.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    mobileOverlay.addEventListener('click', function() {
        mobileToggle.classList.remove('active');
        mobileMenu.classList.remove('active');
        mobileOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });
})();

// Search Filter (untuk Browse)
(function() {
    const searchInput = document.getElementById('browseSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
        const keyword = this.value.toLowerCase();
        const cards = document.querySelectorAll('.project-card');
        
        cards.forEach(function(card) {
            const title = card.querySelector('h4');
            if (!title) return;
            
            const text = title.textContent.toLowerCase();
            const parent = card.closest('a') || card;
            
            if (text.includes(keyword)) {
                parent.style.display = '';
            } else {
                parent.style.display = 'none';
            }
        });
    });
})();

// Filter Kategori (untuk Browse)
(function() {
    const filterSelect = document.getElementById('filterKategori');
    if (!filterSelect) return;

    filterSelect.addEventListener('change', function() {
        const kategori = this.value.toLowerCase();
        const cards = document.querySelectorAll('.project-card');
        
        cards.forEach(function(card) {
            const title = card.querySelector('h4');
            if (!title) return;
            
            const parent = card.closest('a') || card;
            const titleText = title.textContent.toLowerCase();
            
            let cardKategori = '';
            if (titleText.includes('shader') || titleText.includes('bsl')) cardKategori = 'shaders';
            else if (titleText.includes('add-on') || titleText.includes('addon') || titleText.includes('furniture') || titleText.includes('dynamic') || titleText.includes('survival') || titleText.includes('city')) cardKategori = 'addons';
            else if (titleText.includes('plugin') || titleText.includes('essentials')) cardKategori = 'plugins';
            else if (titleText.includes('map') || titleText.includes('skyblock') || titleText.includes('parkour')) cardKategori = 'maps';
            else if (titleText.includes('modpacks')) cardKategori = 'modpacks';
            else if (titleText.includes('texture') || titleText.includes('bare bones') || titleText.includes('faithful') || titleText.includes('resource')) cardKategori = 'resource-packs';
            else cardKategori = 'mods';
            
            if (kategori === '' || cardKategori === kategori) {
                parent.style.display = '';
            } else {
                parent.style.display = 'none';
            }
        });
    });
})();

// Pagination (untuk Browse)
(function() {
    const container = document.getElementById('paginationContainer');
    if (!container) return;

    const cards = document.querySelectorAll('.project-grid > a');
    if (cards.length === 0) return;

    const perPage = 3;
    const totalPages = Math.ceil(cards.length / perPage);
    let currentPage = 1;

    function showPage(page) {
        const start = (page - 1) * perPage;
        const end = start + perPage;

        cards.forEach(function(card, index) {
            if (index >= start && index < end) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });

        const allBtns = container.querySelectorAll('.page-btn');
        allBtns.forEach(function(btn) {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-ghost');
            if (btn.getAttribute('data-page') == page) {
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-ghost');
            }
        });

        const prevBtn = container.querySelector('[data-page="prev"]');
        if (page <= 1) {
            prevBtn.style.opacity = '0.4';
            prevBtn.style.pointerEvents = 'none';
        } else {
            prevBtn.style.opacity = '1';
            prevBtn.style.pointerEvents = 'auto';
        }

        const nextBtn = container.querySelector('[data-page="next"]');
        if (page >= totalPages) {
            nextBtn.style.opacity = '0.4';
            nextBtn.style.pointerEvents = 'none';
        } else {
            nextBtn.style.opacity = '1';
            nextBtn.style.pointerEvents = 'auto';
        }

        currentPage = page;
    }

    container.addEventListener('click', function(e) {
        const btn = e.target.closest('.page-btn');
        if (!btn) return;
        const page = btn.getAttribute('data-page');
        if (page === 'prev') {
            if (currentPage > 1) showPage(currentPage - 1);
        } else if (page === 'next') {
            if (currentPage < totalPages) showPage(currentPage + 1);
        } else {
            showPage(parseInt(page));
        }
    });

    showPage(1);
})();

// Validasi Form Contact
(function() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('contactName');
        const email = document.getElementById('contactEmail');
        const subject = document.getElementById('contactSubject');
        const message = document.getElementById('contactMessage');
        const errorDiv = document.getElementById('contactError');
        
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
        errorDiv.style.color = 'var(--error)';

        if (!name.value.trim()) { errorDiv.textContent = 'Nama harus diisi'; errorDiv.style.display = 'block'; return; }
        if (!email.value.trim()) { errorDiv.textContent = 'Email harus diisi'; errorDiv.style.display = 'block'; return; }
        if (!email.value.includes('@') || !email.value.includes('.')) { errorDiv.textContent = 'Format email tidak valid'; errorDiv.style.display = 'block'; return; }
        if (!subject.value.trim()) { errorDiv.textContent = 'Subjek harus diisi'; errorDiv.style.display = 'block'; return; }
        if (!message.value.trim()) { errorDiv.textContent = 'Pesan harus diisi'; errorDiv.style.display = 'block'; return; }

        errorDiv.style.color = 'var(--success)';
        errorDiv.textContent = 'Pesan terkirim! (simulasi)';
        errorDiv.style.display = 'block';
    });
})();

// Copy Project Link
function copyProjectLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(function() {
        const toast = document.getElementById('shareToast');
        if (toast) {
            toast.style.opacity = '1';
            setTimeout(function() { toast.style.opacity = '0'; }, 2000);
        }
    });
}