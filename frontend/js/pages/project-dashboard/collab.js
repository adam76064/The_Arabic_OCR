/**
 * pages/project-dashboard/collab.js - collaboration panel
 * Extracted from monolith
 */

let coopPollInterval = null;

async function setupCollaborationPanel() {
    const meta = currentProject.metadata || {};
    const lanStatusEl = document.getElementById('dash-lan-status');
    const cloudStatusEl = document.getElementById('dash-cloud-status');
    const syncBtn = document.getElementById('dash-sync-gdrive-btn');

    let lanState = meta.lan_broadcasting ?? false;
    let cloudState = meta.cloud_broadcasting ?? false;

    const renderBadges = () => {
        if (lanStatusEl) {
            lanStatusEl.textContent = lanState ? '📡 محلي: 🟢 مفعل' : '📡 محلي: 🔴 متوقف';
            lanStatusEl.style.background = lanState ? '#dcfce7' : '#fee2e2';
            lanStatusEl.style.color = lanState ? '#15803d' : '#b91c1c';
        }
    };
    renderBadges();

    // Interactive Badge Click Handlers
    if (lanStatusEl) {
        lanStatusEl.addEventListener('click', async () => {
            lanState = !lanState;
            currentProject.metadata.lan_broadcasting = lanState;
            renderBadges();
            await window.pywebview.api.toggle_broadcasting(currentProjectId, 'lan', lanState);
        });
    }

    // Active Collaborators Polling
    const pollActiveUsers = async () => {
        try {
            const collaborators = await window.pywebview.api.get_active_collaborators(currentProjectId);
            const container = document.getElementById('dash-active-collaborators');
            if (!container) return;

            const lanUsers = collaborators.lan || [];
            const allUsers = lanUsers.map(u => ({ name: u, type: 'lan' }));

            if (allUsers.length === 0) {
                container.innerHTML = `<span style="color: #94a3b8; font-style: italic;">لا يوجد أعضاء متصلون حالياً</span>`;
            } else {
                container.innerHTML = allUsers.map(u => {
                    const icon = u.type === 'lan' ? '💻' : '👤';
                    const bg = u.type === 'lan' ? '#e0f2fe' : '#ffedd5';
                    const color = u.type === 'lan' ? '#0369a1' : '#c2410c';
                    return `<span style="background:${bg}; color:${color}; padding: 3px 10px; border-radius: 12px; font-weight: bold; font-size: 12px;">${icon} ${u.name}</span>`;
                }).join('');
            }
        } catch(e) {
            console.error("Error polling collaborators:", e);
        }
    };

    pollActiveUsers();
    if (coopPollInterval) clearInterval(coopPollInterval);
    coopPollInterval = setInterval(pollActiveUsers, 4000);
}

