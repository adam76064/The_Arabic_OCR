async function initApp() {
    // 1. Safe data fetching (fallback to empty array if null/undefined)
    const projects = (await window.pywebview.api.get_projects()) || [];

    // Projects count badge
    const badge = document.getElementById('projects-count');
    if (badge) badge.textContent = projects.length;

    // Recent projects (last 4)
    const recent = document.getElementById('recent-projects');
    if (recent) {
        // 2. Mathematically safe Date sorting
        const sorted = projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);
        
        if (sorted.length === 0) {
            recent.innerHTML = '<p style="color:#aaa; font-size:14px;">لا توجد مشاريع بعد.</p>';
        } else {
            sorted.forEach(p => {
                const total = p.page_count || 0;
                const reviewed = p.reviewed_count || 0;
                const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

                const card = document.createElement('a');
                card.className = 'recent-card';
                // تم التعديل هنا: التوجيه إلى لوحة التحكم بدلاً من صفحة المراجعة
                card.href = `project-dashboard.html?id=${p.id}`;
                card.innerHTML = `
                    <div>
                        <div class="recent-card-title">${p.title}</div>
                        <div class="recent-card-meta">${p.author} · ${new Date(p.created_at).toLocaleDateString('ar-EG')}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="recent-progress">
                            <div class="recent-progress-fill" style="width:${pct}%"></div>
                        </div>
                        <span style="font-size:12px; color:#888;">${pct}%</span>
                    </div>
                `;
                recent.appendChild(card);
            });
        }
    }

    // 3. Settings Modal Event Listeners
    const settingsBtn = document.getElementById('home-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsOverlay = document.getElementById('settings-overlay');

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
        });
    }
    
    // Close modal via X button or clicking the dark overlay
    const closeModal = () => settingsModal?.classList.add('hidden');
    if (settingsClose) settingsClose.addEventListener('click', closeModal);
    if (settingsOverlay) settingsOverlay.addEventListener('click', closeModal);
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) {
        initApp();
    } else {
        window.addEventListener('pywebviewready', initApp);
    }
});