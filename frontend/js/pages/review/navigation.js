/**
 * pages/review/navigation.js - page navigation + focus movement
 * Extracted from review.js
 */

function navigatePage(dir) {
    if (!currentProject) return;
    const next = currentPageIndex + dir;
    if (next < 0 || next >= currentProject.pages.length) return;
    currentPageIndex = next;
    selectBlock(-1);
    activeEditingIndex = -1;
    updateReviewPanel();
}

function moveFocusAndReview(dir) {
    let currentIndex = activeEditingIndex !== -1 ? activeEditingIndex : selectedBlockIndex;
    
    if (currentIndex !== -1 && currentProject && currentProject.pages[currentPageIndex]) {
        const page = currentProject.pages[currentPageIndex];
        const currentData = page.ocr_data[currentIndex];
        if (currentData && !currentData.reviewed && window.__appSettings?.autoMarkReviewed !== false) {
            currentData.reviewed = true;
            if (typeof autoSaveBlock === 'function') autoSaveBlock();
        }
    }

    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === 'TD' && activeEl.closest('.review-table')) {
        const table = activeEl.closest('.review-table');
        const tds = Array.from(table.querySelectorAll('td'));
        const tdIndex = tds.indexOf(activeEl);
        const nextTdIndex = tdIndex + dir;
        if (nextTdIndex >= 0 && nextTdIndex < tds.length) {
            tds[nextTdIndex].focus();
            return;
        }
    }

    if (!currentProject || !currentProject.pages[currentPageIndex]) return;
    const page = currentProject.pages[currentPageIndex];
    
    let nextIdx = currentIndex === -1 ? (dir === 1 ? 0 : page.ocr_data.length - 1) : currentIndex + dir;
    while (nextIdx >= 0 && nextIdx < page.ocr_data.length) {
        if (page.ocr_data[nextIdx].category !== 'Picture') break;
        nextIdx += dir;
    }

    if (nextIdx >= 0 && nextIdx < page.ocr_data.length) {
        selectBlock(nextIdx);
        activeEditingIndex = nextIdx;
        updateReviewPanel();
        setTimeout(() => {
            const nextWrapper = document.querySelector(`.text-block[data-index="${nextIdx}"]`);
            if (nextWrapper) {
                nextWrapper.scrollIntoView({behavior:'smooth', block:'center'});
                const content = nextWrapper.querySelector('.block-content');
                if (content) {
                    const firstTd = dir === 1 
                        ? content.querySelector('td') 
                        : Array.from(content.querySelectorAll('td')).pop(); 
                    if (firstTd) firstTd.focus();
                    else content.focus();
                }
            }
        }, 50); 
    }
}

window.navigatePage = navigatePage;
window.moveFocusAndReview = moveFocusAndReview;
