let pendingJoinTarget = null;

async function scan() {
    const status = document.getElementById('lan-status');
    const results = document.getElementById('lan-results');
    status.textContent = window.AppI18n.t('lan.searching');
    results.innerHTML = '';

    const projects = await window.pywebview.api.scan_lan_projects();
    if (!projects.length) {
        status.textContent = window.AppI18n.t('lan.none');
        return;
    }
    status.textContent = window.AppI18n.t('lan.found', { count: projects.length });

    projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'home-card card-primary';
        const icon = window.AppIcons ? window.AppIcons.get(proj.requires_password ? 'lock' : 'globe') : '';
        card.innerHTML = `
            <div class="card-icon" data-icon-applied="1">${icon}</div>
            <div class="card-title">${proj.name}</div>
            <div class="card-desc">${window.AppI18n.t('lan.owner', { owner: proj.owner, count: proj.page_count })}</div>
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
        alert(window.AppI18n.t('lan.joinError', { error: result.error || window.AppI18n.t('lan.unknownError') }));
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
