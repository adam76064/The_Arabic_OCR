/**
 * pages/layout-editor/save.js - extracted from monolith
 */

async function autoSaveLayoutData() {
    if (window.__appSettings?.autoSaveLayout === true && currentProject) {
        
        // 1. UPDATE IN-MEMORY MASTER OBJECT SO IT DOESN'T GET STALE
        currentProject.pages[currentPageIndex].ocr_data = JSON.parse(JSON.stringify(ocrData));
        
        const btn = document.getElementById('btn-save');
        if (!btn) return;
        
        const originalText = '💾 حفظ التخطيط';
        btn.textContent = '⏳ جاري الحفظ...';
        
        try { 
            if (window.pywebview?.api?.repopulate_page_text_from_raw) {
                const res = await window.pywebview.api.repopulate_page_text_from_raw(currentProject.id, currentPageIndex, ocrData);
                if (res && res.ok && res.ocr_data) {
                    ocrData = res.ocr_data;
                    currentProject.pages[currentPageIndex].ocr_data = res.ocr_data;
                }
            } else {
                await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
            }
            btn.textContent = '✔ تم الحفظ';
        } catch (e) { 
            console.error('Layout auto-save failed:', e); 
            btn.textContent = '❌ خطأ';
        }
        
        setTimeout(() => { 
            if (btn.textContent === '✔ تم الحفظ' || btn.textContent === '❌ خطأ') {
                btn.textContent = originalText; 
            }
        }, 1000);
    }
}

