/**
 * pages/layout-editor/history.js - undo/redo for layout editor
 */
let historyStack = { undo: [], redo: [] };
const HISTORY_LIMIT = 50;

function saveHistoryState() {
    historyStack.undo.push(JSON.stringify(ocrData));
    if (historyStack.undo.length > HISTORY_LIMIT) historyStack.undo.shift();
    historyStack.redo = [];
    updateHistoryButtons();
}

function doUndo() {
    if (historyStack.undo.length === 0) return;
    historyStack.redo.push(JSON.stringify(ocrData));
    ocrData = JSON.parse(historyStack.undo.pop());
    selectedBoxes.clear(); 
    selectedTableCells = { blockIdx: null, cellIndices: [] };
    updateSelectionUI(); drawCanvas(); updateHistoryButtons();
}

function doRedo() {
    if (historyStack.redo.length === 0) return;
    historyStack.undo.push(JSON.stringify(ocrData));
    ocrData = JSON.parse(historyStack.redo.pop());
    selectedBoxes.clear(); 
    selectedTableCells = { blockIdx: null, cellIndices: [] };
    updateSelectionUI(); drawCanvas(); updateHistoryButtons();
}

function updateHistoryButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if(btnUndo) btnUndo.disabled = historyStack.undo.length === 0;
    if(btnRedo) btnRedo.disabled = historyStack.redo.length === 0;
}

window.saveHistoryState = saveHistoryState;
window.doUndo = doUndo;
window.doRedo = doRedo;
window.updateHistoryButtons = updateHistoryButtons;
