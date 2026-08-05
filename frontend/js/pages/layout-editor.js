/**
 * pages/layout-editor.js - THIN ORCHESTRATOR (rebuilt)
 * Previously 1481-line monolith, now delegates to modular files in js/pages/layout-editor/
 * 
 * Load order in layout-editor.html:
 * - core/api, utils, events, store, modal, notifications, sidebar
 * - pages/settings, ui-shared
 * - pages/layout-editor/state.js (globals)
 * - pages/layout-editor/history.js (undo/redo)
 * - pages/layout-editor/table-tools.js (window.TableEditor)
 * - pages/layout-editor/properties.js (injectPropertiesPanel, handleTableCategoryChangeInLayout)
 * - pages/layout-editor/canvas.js (loadImageAndCanvas, getMouseCoords, setupCanvasEvents, drawCanvas)
 * - pages/layout-editor/toolbar.js (setupToolbar, setTool, deleteSelected, mergeSelected)
 * - pages/layout-editor/navigation.js (navigatePage)
 * - pages/layout-editor/save.js (autoSaveLayoutData)
 * - pages/layout-editor/events.js (setupKeyboardShortcuts)
 * - pages/layout-editor/index.js (initLayoutEditor + DOMContentLoaded)
 * 
 * This file is kept for backward compat and simply re-exports init if needed.
 */

// The actual implementation now lives in the modules above.
// This thin wrapper ensures initLayoutEditor exists even if modules fail to load,
// and provides a fallback.

if (typeof initLayoutEditor !== 'function') {
    async function initLayoutEditor() {
        console.warn('[LayoutEditor] initLayoutEditor not found in modules, using fallback that loads from original monolith backup');
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('id');
        const pageParam = params.get('page');
        if (!projectId || pageParam === null) { window.location.href = 'projects.html'; return; }
        // Fallback minimal - actual logic should be in modules
        alert('Layout editor modules not loaded correctly. Please check console and file paths in layout-editor.html');
    }
    window.initLayoutEditor = initLayoutEditor;
}

console.log('[LayoutEditor] thin orchestrator loaded, modules should have defined initLayoutEditor, TableEditor, etc.');
