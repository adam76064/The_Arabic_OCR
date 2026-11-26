/**
 * pages/layout-editor/selection.js - selection UI for layout editor
 * Extracted and cleaned from original monolith
 */

function updateSelectionUI() {
    const btnDel = document.getElementById('btn-delete');
    const btnMerge = document.getElementById('btn-merge');
    if (btnDel) btnDel.disabled = selectedBoxes.size === 0;
    if (btnMerge) btnMerge.disabled = selectedBoxes.size < 2;

    // Multi-select count badge (UI-LE2)
    const selBadge = document.getElementById('layout-selection-badge');
    const selCount = document.getElementById('layout-selection-count');
    if (selBadge && selCount) {
        if (selectedBoxes.size > 1) {
            selCount.textContent = selectedBoxes.size;
            selBadge.classList.remove('hidden');
        } else {
            selBadge.classList.add('hidden');
        }
    }

    const panel = document.getElementById('block-props-panel');
    if (!panel) return;

    if (selectedBoxes.size === 1 && (currentTool === 'select' || currentTool === 'move')) {
        panel.style.display = 'block';
        const idx = Array.from(selectedBoxes)[0];
        if (ocrData[idx]) {
            const cat = ocrData[idx].category || 'Text';
            const catSelect = document.getElementById('prop-category');
            if (catSelect) catSelect.value = cat;
            const orderInput = document.getElementById('prop-order');
            if (orderInput) orderInput.value = idx + 1;
            const tableTools = document.getElementById('prop-table-tools');
            if (tableTools) tableTools.style.display = isTableLike(cat) ? 'block' : 'none';
        }
    } else {
        panel.style.display = 'none';
    }
}

window.updateSelectionUI = updateSelectionUI;
