/**
 * pages/review/save.js - saving logic
 * Extracted from review.js
 */

async function saveBlockSilently() {
    if (!currentProject) return;
    const page = currentProject.pages[currentPageIndex];
    if (!page) return;
    try { 
        await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, page.ocr_data || []); 
    } catch (err) { 
        console.error('Auto-save failed:', err); 
    }
}

let _autoSaveTimer = null;
async function autoSaveBlock() {
    if (window.__appSettings?.autoSaveReview) {
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(async () => {
            await saveBlockSilently();
        }, 400);
    }
}

window.saveBlockSilently = saveBlockSilently;
window.autoSaveBlock = autoSaveBlock;
