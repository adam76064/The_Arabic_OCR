let pendingJoinTarget = null;

async function scan() {
    const status = document.getElementById('lan-status');
    const results = document.getElementById('lan-results');
    status.textContent = 'جارٍ البحث عن مشاريع على الشبكة...';
    results.innerHTML = '';

    const projects = await window.pywebview.api.scan_lan_projects();
    if (!projects.length) {
        status.textContent = 'لم يتم العثور على أي مشاريع مشتركة على الشبكة.';
        return;
    }
    status.textContent = `تم العثور على ${projects.length} مشروع(ات).`;

    projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'home-card card-primary';
        card.innerHTML = `
            <div class="card-icon">${proj.requires_password ? '🔒' : '🌐'}</div>
            <div class="card-title">${proj.name}</div>
            <div class="card-desc">المالك: ${proj.owner} — ${proj.page_count} صفحة</div>
        `;
        card.addEventListener('click', () => joinProject(proj));
        results.appendChild(card);
    });
}

function joinProject(proj) {
    if (proj.requires_password) {
        pendingJoinTarget = proj;
        document.getElementById('lan-join-modal').classList.remove('hidden');
    } else {
        doJoin(proj, null);
    }
}

async function doJoin(proj, password) {
    const result = await window.pywebview.api.join_lan_project(proj.host, proj.port, proj.project_id, password);
    if (result.ok) {
        window.location.href = `review.html?id=${proj.project_id}`;
    } else {
        alert('تعذّر الانضمام: ' + (result.error || 'خطأ غير معروف'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rescan-btn').addEventListener('click', scan);
    document.getElementById('lan-join-close').addEventListener('click', () => {
        document.getElementById('lan-join-modal').classList.add('hidden');
    });
    document.getElementById('lan-join-confirm').addEventListener('click', () => {
        const pw = document.getElementById('lan-join-password').value;
        document.getElementById('lan-join-modal').classList.add('hidden');
        if (pendingJoinTarget) doJoin(pendingJoinTarget, pw);
    });

    if (window.pywebview) {
        scan();
    } else {
        window.addEventListener('pywebviewready', scan);
    }
});
