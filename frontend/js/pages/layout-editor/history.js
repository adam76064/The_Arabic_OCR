/**
 * pages/layout-editor/history.js - undo/redo for layout editor
 */
let historyStack = { undo: [], redo: [] };
const HISTORY_LIMIT = 50;

function saveHistoryState(actionLabel = 'تعديل') {
    historyStack.undo.push({ data: JSON.stringify(ocrData), label: actionLabel, time: new Date().toLocaleTimeString('ar-EG') });
    if (historyStack.undo.length > HISTORY_LIMIT) historyStack.undo.shift();
    historyStack.redo = [];
    updateHistoryButtons();
    renderHistoryPanel();
}

function doUndo() {
    if (historyStack.undo.length === 0) return;
    const entry = historyStack.undo.pop();
    historyStack.redo.push({ data: JSON.stringify(ocrData), label: entry.label, time: new Date().toLocaleTimeString('ar-EG') });
    ocrData = JSON.parse(entry.data);
    selectedBoxes.clear(); 
    selectedTableCells = { blockIdx: null, cellIndices: [] };
    updateSelectionUI(); drawCanvas(); updateHistoryButtons();
    renderHistoryPanel();
}

function doRedo() {
    if (historyStack.redo.length === 0) return;
    const entry = historyStack.redo.pop();
    historyStack.undo.push({ data: JSON.stringify(ocrData), label: entry.label, time: new Date().toLocaleTimeString('ar-EG') });
    ocrData = JSON.parse(entry.data);
    selectedBoxes.clear(); 
    selectedTableCells = { blockIdx: null, cellIndices: [] };
    updateSelectionUI(); drawCanvas(); updateHistoryButtons();
    renderHistoryPanel();
}

function updateHistoryButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if(btnUndo) btnUndo.disabled = historyStack.undo.length === 0;
    if(btnRedo) btnRedo.disabled = historyStack.redo.length === 0;
}

function renderHistoryPanel() {
    const listEl = document.getElementById('layout-history-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (historyStack.undo.length === 0) {
        listEl.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--color-text-muted); font-size: 12px;">لا توجد عمليات سابقة</div>';
        return;
    }

    [...historyStack.undo].reverse().forEach((entry, rIdx) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 8px 12px; font-size: 12px; cursor: pointer; border-bottom: 1px solid var(--color-border-subtle); display: flex; justify-content: space-between; align-items: center; color: var(--color-text);';
        item.innerHTML = `<span>● ${entry.label || 'إجراء'}</span><span style="font-size: 10px; color: var(--color-text-muted);">${entry.time || ''}</span>`;
        item.addEventListener('mouseenter', () => item.style.background = 'var(--color-surface-hover)');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent)');
        item.addEventListener('click', () => {
            // Jump to that state
            const targetIdx = historyStack.undo.length - 1 - rIdx;
            const targetEntry = historyStack.undo[targetIdx];
            if (targetEntry) {
                historyStack.redo.push({ data: JSON.stringify(ocrData), label: 'العودة', time: new Date().toLocaleTimeString('ar-EG') });
                ocrData = JSON.parse(targetEntry.data);
                historyStack.undo = historyStack.undo.slice(0, targetIdx);
                selectedBoxes.clear();
                updateSelectionUI();
                drawCanvas();
                updateHistoryButtons();
                renderHistoryPanel();
            }
        });
        listEl.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('layout-history-panel');
    const toggleBtn = document.getElementById('btn-toggle-history');
    const closeBtn = document.getElementById('close-history-btn');

    toggleBtn?.addEventListener('click', () => {
        panel?.classList.toggle('hidden');
        renderHistoryPanel();
    });
    closeBtn?.addEventListener('click', () => {
        panel?.classList.add('hidden');
    });
});

window.saveHistoryState = saveHistoryState;
window.doUndo = doUndo;
window.doRedo = doRedo;
window.updateHistoryButtons = updateHistoryButtons;
