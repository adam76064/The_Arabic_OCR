// undo-redo.js
// Project-wide undo/redo: snapshot-based history stack over each page's
// ocr_data. Extracted from review.js. Load alongside review.js (order doesn't
// matter). Relies on globals from review.js: currentProject, currentPageIndex,
// activeEditingIndex, selectBlock, updateReviewPanel, saveBlockSilently, showNotif.

const history = { undo: [], redo: [] };
function historyLimit() {
    const v = window.__appSettings?.historyLimit;
    return (typeof v === 'number' && v > 0) ? v : 50;
}

// ===== UNDO / REDO =====
function pushHistory(pageIndex, explicitSnapshot) {
    const page = currentProject?.pages[pageIndex];
    if (!page) return;
    const snapshot = explicitSnapshot || JSON.parse(JSON.stringify(page.ocr_data || []));
    history.undo.push({ pageIndex, snapshot });
    if (history.undo.length > historyLimit()) history.undo.shift();
    history.redo.length = 0;
    updateUndoRedoButtons();
}

function applyHistoryEntry(fromStack, toStack) {
    if (!fromStack.length) return;
    const entry = fromStack.pop();
    const page = currentProject?.pages[entry.pageIndex];
    if (!page) { updateUndoRedoButtons(); return; }

    toStack.push({ pageIndex: entry.pageIndex, snapshot: JSON.parse(JSON.stringify(page.ocr_data || [])) });
    if (toStack.length > historyLimit()) toStack.shift();

    page.ocr_data = entry.snapshot;

    if (entry.pageIndex !== currentPageIndex) {
        currentPageIndex = entry.pageIndex;
        selectBlock(-1);
        activeEditingIndex = -1;
        updateReviewPanel();
        showNotif(window.AppI18n.t('review.navigateChange', { page: entry.pageIndex + (currentProject.metadata?.logical_start || 1) }), 'info');
    } else {
        selectBlock(-1);
        activeEditingIndex = -1;
        updateReviewPanel();
    }

    saveBlockSilently();
    updateUndoRedoButtons();
}

function performUndo() { applyHistoryEntry(history.undo, history.redo); }
function performRedo() { applyHistoryEntry(history.redo, history.undo); }
function updateUndoRedoButtons() {
    const uBtn = document.getElementById('undo-btn');
    const rBtn = document.getElementById('redo-btn');
    const uBadge = document.getElementById('undo-depth-badge');
    const rBadge = document.getElementById('redo-depth-badge');
    if (uBtn) uBtn.disabled = !history.undo.length;
    if (rBtn) rBtn.disabled = !history.redo.length;

    if (uBadge) {
        if (history.undo.length > 0) {
            uBadge.textContent = history.undo.length;
            uBadge.classList.remove('hidden');
        } else {
            uBadge.classList.add('hidden');
        }
    }
    if (rBadge) {
        if (history.redo.length > 0) {
            rBadge.textContent = history.redo.length;
            rBadge.classList.remove('hidden');
        } else {
            rBadge.classList.add('hidden');
        }
    }
}
function setupUndo() { updateUndoRedoButtons(); }

