/**
 * review.js - THIN ORCHESTRATOR (rebuilt)
 * Previously 1400-line monolith, now delegates to modular files in js/pages/review/
 * 
 * Load order in review.html:
 * - core/api.js, utils.js, events.js, store.js
 * - components/* (sidebar, modal, notifications, toolbar)
 * - table-model, text-formatting, etc.
 * - canvas-rendering, undo-redo, keyboard-shortcuts, block-context-menu, text-tracking-engine
 * - pages/review/state.js (defines globals)
 * - pages/review/navigation.js, crop.js, fullpage.js, save.js, fontzoom.js, panels.js, editor.js, toolbar.js, category.js, tracking.js, preview.js, canvas.js, etc.
 * - THIS FILE (initApp)
 * - pages/review/index.js (final hooks)
 * 
 * State globals are defined in state.js: currentProject, currentPageIndex, selectedBlockIndex, multiSelectedBlocks, activeEditingIndex, cropZoom, scaleRatioX/Y, BASE_CATEGORIES, etc.
 * All other functions are defined in their respective modules and exposed as window.* for backward compat.
 */

async function initApp() {
    // Inject block context modals HTML (from block-context-menu.js)
    if (typeof BLOCK_CONTEXT_MODALS_HTML !== 'undefined') {
        document.body.insertAdjacentHTML('beforeend', BLOCK_CONTEXT_MODALS_HTML);
    }

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    const targetPage = params.get('page'); 

    if (!projectId) { window.location.href = 'projects.html'; return; }

    // Get app data path for file:// image URLs
    try {
        window.__appDataPath = await window.pywebview.api.get_app_data_path();
        window.__appDataPath = window.__appDataPath.replace(/\\/g, '/');
    } catch (e) {
        console.warn('[Review] get_app_data_path failed', e);
        window.__appDataPath = '';
    }

    try {
        currentProject = await window.pywebview.api.load_project(projectId);
    } catch (e) {
        console.error('[Review] load_project failed', e);
        currentProject = null;
    }

    if (!currentProject) { 
        alert(window.AppI18n.t('review.loadFailed')); 
        window.location.href = 'projects.html'; 
        return; 
    }

    if (targetPage !== null) {
        let p = parseInt(targetPage);
        if (!isNaN(p) && p >= 0 && p < currentProject.pages.length) {
            currentPageIndex = p;
        }
    }

    // Toolbar injection (from text-formatting.js)
    if (typeof injectToolbar === 'function') {
        injectToolbar('sticky-toolbar', true);
        injectToolbar('text-preview-toolbar', false);
    }

    // Sidebar title/meta (guarded, sidebar may be injected async)
    const titleEl = document.getElementById('sidebar-proj-title');
    if (titleEl) titleEl.textContent = currentProject.metadata?.title || '—';
    const metaEl = document.getElementById('sidebar-proj-meta');
    if (metaEl) metaEl.textContent = currentProject.metadata?.author || '';
    setTimeout(() => {
        const t = document.getElementById('sidebar-proj-title');
        if (t) t.textContent = currentProject.metadata?.title || '—';
        const m = document.getElementById('sidebar-proj-meta');
        if (m) m.textContent = currentProject.metadata?.author || '';
    }, 300);

    // Setup all modules (each checks existence of its DOM elements)
    if (typeof setupToolbar === 'function') setupToolbar();
    if (typeof setupCropControls === 'function') setupCropControls();
    if (typeof setupFullPageView === 'function') setupFullPageView();
    if (typeof setupCategoryPicker === 'function') setupCategoryPicker();
    if (typeof setupResizablePanels === 'function') setupResizablePanels();
    else if (typeof setupPanels === 'function') setupPanels(); // new name
    if (typeof setupUndo === 'function') setupUndo();
    if (typeof setupBlockFontZoom === 'function') setupBlockFontZoom();
    if (typeof setupKeyboardShortcuts === 'function') setupKeyboardShortcuts();
    if (typeof setupBlockContextMenu === 'function') setupBlockContextMenu();
    if (typeof setupBlocksListDelegation === 'function') setupBlocksListDelegation();

    // Network badge
    const navDiv = document.querySelector('.page-nav');
    if (navDiv) {
        const netBadge = document.createElement('div');
        netBadge.id = 'network-status-badge';
        netBadge.style.cssText = 'font-size:12px; padding:4px 10px; border-radius:20px; font-weight:bold; display:none; align-items:center; gap:5px; margin-right: 10px;';
        const saveBtn = document.getElementById('save-page');
        if (saveBtn) navDiv.parentNode.insertBefore(netBadge, saveBtn);

        const netInterval = setInterval(async () => {
            if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.get_network_status) return;
            try {
                const status = await window.pywebview.api.get_network_status();
                netBadge.style.display = 'none';
            } catch (e) {}
        }, 5000);
        window.addEventListener('beforeunload', () => {
            clearInterval(netInterval);
        });
    }

    if (typeof updateReviewPanel === 'function') updateReviewPanel();
    console.log('[Review] initApp completed, project loaded', currentProject?.metadata?.title);
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.AppApi && typeof window.AppApi.ready === 'function') {
        window.AppApi.ready().then(initApp);
    } else if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_projects === 'function') {
        initApp();
    } else {
        window.addEventListener('pywebviewready', initApp);
    }
});
