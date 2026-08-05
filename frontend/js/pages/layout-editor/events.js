/**
 * pages/layout-editor/events.js - extracted from monolith
 */

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
        if (e.key === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doRedo(); }
        if (e.key === 'Escape') { isDrawing = false; setTool('select'); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedBoxes.size > 0) { saveHistoryState(); deleteSelected(); }
        }
    });
}

