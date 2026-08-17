/**
 * pages/layout-editor/save.js - extracted from monolith
 */

async function autoSaveLayoutData() {
    if (window.__appSettings?.autoSaveLayout === true && currentProject) {
        
        // 1. UPDATE IN-MEMORY MASTER OBJECT SO IT DOESN'T GET STALE
        currentProject.pages[currentPageIndex].ocr_data = JSON.parse(JSON.stringify(ocrData));
        
        const btn = document.getElementById('btn-save');
        if (!btn) return;
        
        const originalText = window.AppI18n.t('layout.save');
        btn.textContent = window.AppI18n.t('layout.saving');
        
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
            btn.textContent = window.AppI18n.t('layout.saved');
        } catch (e) { 
            console.error('Layout auto-save failed:', e); 
            btn.textContent = window.AppI18n.t('layout.error');
        }
        
        setTimeout(() => { 
            if (btn.textContent === window.AppI18n.t('layout.saved') || btn.textContent === window.AppI18n.t('layout.error')) {
                btn.textContent = originalText; 
            }
        }, 1000);
    }
}

