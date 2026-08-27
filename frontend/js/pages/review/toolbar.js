/**
 * pages/review/toolbar.js - toolbar setup (navigation, thumbnail, save)
 * Extracted from review.js
 */

function setupToolbar() {
    document.getElementById('prev-page')?.addEventListener('click', () => navigatePage(-1));
    document.getElementById('next-page')?.addEventListener('click', () => navigatePage(1));
    document.getElementById('undo-btn')?.addEventListener('click', performUndo);
    document.getElementById('redo-btn')?.addEventListener('click', performRedo);

    // Prevent focus loss when clicking toolbar buttons
    document.querySelectorAll('#sticky-toolbar button, .formatting-toolbar-group button').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'SELECT' && e.target.type !== 'color') {
                e.preventDefault();
            }
        });
    });

    document.getElementById('thumb-popup-canvas')?.addEventListener('click', (e) => {
        handleCanvasClick(e, document.getElementById('thumb-popup-canvas'));
    });

    document.getElementById('toolbar-thumb-wrapper')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('thumb-popup-canvas')) return;
        openFullPageView();
    });

    document.getElementById('save-page')?.addEventListener('click', async (e) => {
        // 1. Force sync of the currently active block before saving
        if (activeEditingIndex !== -1 && currentProject?.pages[currentPageIndex]) {
            const el = currentProject.pages[currentPageIndex].ocr_data[activeEditingIndex];
            const contentEl = document.querySelector(`.text-block[data-index="${activeEditingIndex}"] .block-content`);
            if (el && contentEl && typeof syncElementFromContent === 'function') {
                syncElementFromContent(el, contentEl);
            }
        }
        
        // 2. Execute Save
        const btn = e.currentTarget;
        btn.disabled = true;
        await saveBlockSilently();
        if (typeof showNotif === 'function') showNotif(window.AppI18n.t('review.pageSaved'), 'success');
        setTimeout(() => btn.disabled = false, 500);
    });
}

window.setupToolbar = setupToolbar;
