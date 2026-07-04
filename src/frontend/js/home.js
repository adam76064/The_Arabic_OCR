async function initApp() {
    const projects = await window.pywebview.api.get_projects();

    // Projects count badge
    const badge = document.getElementById('projects-count');
    if (badge) badge.textContent = projects.length;

    // Recent projects (last 4)
    const recent = document.getElementById('recent-projects');
    if (!recent) return;

    const sorted = projects.sort((a, b) => b.created_at > a.created_at ? 1 : -1).slice(0, 4);
    if (sorted.length === 0) {
        recent.innerHTML = '<p style="color:#aaa; font-size:14px;">لا توجد مشاريع بعد.</p>';
        return;
    }

    sorted.forEach(p => {
        const total = p.page_count || 0;
        const reviewed = p.reviewed_count || 0;
        const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

        const card = document.createElement('a');
        card.className = 'recent-card';
        card.href = `review.html?id=${p.id}`;
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

document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) {
        initApp();
    } else {
        window.addEventListener('pywebviewready', initApp);
    }
});
