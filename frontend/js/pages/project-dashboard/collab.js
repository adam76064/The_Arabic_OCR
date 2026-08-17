/**
 * pages/project-dashboard/collab.js - collaboration panel
 * Extracted from monolith
 */

const collaborationText = (key) => window.AppI18n?.t(key) || key;

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
            const icon = window.AppIcons ? window.AppIcons.get('network') : '';
            lanStatusEl.innerHTML = `${icon}<span>${lanState ? collaborationText('collab.lanOn') : collaborationText('collab.lanOff')}</span>`;
            lanStatusEl.classList.toggle('is-on', lanState);
            lanStatusEl.classList.toggle('is-off', !lanState);
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
                container.innerHTML = `<span style="color: #94a3b8; font-style: italic;">${collaborationText('collab.noMembers')}</span>`;
            } else {
                container.innerHTML = allUsers.map(u => {
                    const icon = window.AppIcons ? window.AppIcons.get(u.type === 'lan' ? 'lan' : 'user') : '';
                    const bg = u.type === 'lan' ? '#e0f2fe' : '#ffedd5';
                    const color = u.type === 'lan' ? '#0369a1' : '#c2410c';
                    return `<span style="background:${bg}; color:${color}; padding: 3px 10px; border-radius: 12px; font-weight: bold; font-size: 12px; display:inline-flex; align-items:center; gap:5px;">${icon}<span>${u.name}</span></span>`;
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

