/**
 * pages/project-dashboard.js - THIN ORCHESTRATOR (rebuilt)
 * Previously 715-line monolith, now delegates to modular files in js/pages/project-dashboard/
 *
 * Load order in project-dashboard.html:
 * - core/api, utils, events, store, modal, notifications, sidebar
 * - pages/settings, ui-shared
 * - pages/project-dashboard/state.js
 * - pages/project-dashboard/table.js
 * - pages/project-dashboard/stats.js
 * - pages/project-dashboard/ocr-modal.js
 * - pages/project-dashboard/progress.js
 * - pages/project-dashboard/export.js
 * - pages/project-dashboard/collab.js
 * - pages/project-dashboard/llm.js
 * - pages/project-dashboard/index.js (initDashboard + DOMContentLoaded + setupEventBindings)
 *
 * This file is kept for backward compat and ensures init exists.
 */

if (typeof initDashboard !== 'function') {
    async function initDashboard() {
        console.warn('[Dashboard] initDashboard not found in modules, fallback');
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('id');
        if (!projectId) { window.location.href = 'projects.html'; return; }
        alert('Dashboard modules not loaded correctly. Check console.');
    }
    window.initDashboard = initDashboard;
}

console.log('[Dashboard] thin orchestrator loaded');
