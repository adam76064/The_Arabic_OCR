/**
 * pages/layout-editor/index.js - extracted from monolith
 */

async function initLayoutEditor() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    const pageParam = params.get('page');

    if (!projectId || pageParam === null) { window.location.href = 'projects.html'; return; }
    currentPageIndex = parseInt(pageParam);

    window.__appDataPath = await window.pywebview.api.get_app_data_path();
    window.__appDataPath = window.__appDataPath.replace(/\\/g, '/');

    currentProject = await window.pywebview.api.load_project(projectId);
    if (!currentProject || !currentProject.pages[currentPageIndex]) return;

    const page = currentProject.pages[currentPageIndex];
    document.getElementById('page-num-display').textContent = currentPageIndex + (currentProject.metadata?.logical_start || 1);
    
    ocrData = JSON.parse(JSON.stringify(page.ocr_data || []));

    injectPropertiesPanel();
    setupToolbar();
    loadImageAndCanvas(page);
    setupKeyboardShortcuts();
}



document.addEventListener('DOMContentLoaded', () => {
    if (window.AppApi && typeof window.AppApi.ready === 'function') {
        window.AppApi.ready().then(initLayoutEditor);
    } else if (window.pywebview && window.pywebview.api) {
        initLayoutEditor();
    } else {
        window.addEventListener('pywebviewready', initLayoutEditor);
    }
});
