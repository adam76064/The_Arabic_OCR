/**
 * pages/layout-editor/navigation.js - extracted from monolith
 */

async function navigatePage(direction) {
    const newIndex = currentPageIndex + direction;
    if (newIndex < 0 || newIndex >= currentProject.pages.length) return;
    
    // Only update memory and push to backend IF auto-save is actually ON
    if (window.__appSettings?.autoSaveLayout) {
        currentProject.pages[currentPageIndex].ocr_data = JSON.parse(JSON.stringify(ocrData));
        try { 
            if (window.pywebview?.api?.repopulate_page_text_from_raw) {
                await window.pywebview.api.repopulate_page_text_from_raw(currentProject.id, currentPageIndex, ocrData);
            } else {
                await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
            }
        } catch (e) { 
            console.error("Auto-save failed", e); 
        }
    }

    currentPageIndex = newIndex;
    selectedBoxes.clear();
    selectedTableCells = { blockIdx: null, cellIndices: [] };
    updateSelectionUI();
    loadPage(currentPageIndex);
}

function loadPage(index) {
    if (!currentProject || !currentProject.pages[index]) return;
    
    const page = currentProject.pages[index];
    document.getElementById('page-num-display').textContent = index + (currentProject.metadata?.logical_start || 1);
    
    ocrData = JSON.parse(JSON.stringify(page.ocr_data || []));
    
    if (typeof loadImageAndCanvas === 'function') {
        loadImageAndCanvas(page);
    }
}

