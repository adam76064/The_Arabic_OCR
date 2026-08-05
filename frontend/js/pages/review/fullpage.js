/**
 * pages/review/fullpage.js - full page overlay
 * Extracted from review.js
 */

function setupFullPageView() {
    const closeBtn = document.getElementById('close-fullpage-btn');
    const canvas = document.getElementById('fullpage-canvas');
    if (closeBtn) closeBtn.addEventListener('click', closeFullPageView);
    if (canvas) canvas.addEventListener('click', (e) => {
        if (typeof handleCanvasClick === 'function') handleCanvasClick(e, canvas);
        const ocrData = currentProject?.pages[currentPageIndex]?.ocr_data || [];
        if (typeof renderThumbCanvas === 'function') renderThumbCanvas('fullpage-canvas', 'fullpage-image', ocrData, selectedBlockIndex);
    });
}

function openFullPageView() {
    if (!currentProject) return;
    const overlay = document.getElementById('fullpage-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    const fullImg = document.getElementById('fullpage-image');
    if (!fullImg) return;
    const drawWhenReady = () => {
        const c = document.getElementById('fullpage-canvas');
        if (!c || !fullImg.naturalWidth) return;
        c.width = fullImg.naturalWidth; c.height = fullImg.naturalHeight;
        if (typeof drawBoxes === 'function') drawBoxes(c, currentProject.pages[currentPageIndex].ocr_data || [], selectedBlockIndex);
    };
    fullImg.complete && fullImg.naturalWidth ? drawWhenReady() : (fullImg.onload = drawWhenReady);
}

function closeFullPageView() {
    const overlay = document.getElementById('fullpage-overlay');
    if (overlay) overlay.classList.add('hidden');
}

window.setupFullPageView = setupFullPageView;
window.openFullPageView = openFullPageView;
window.closeFullPageView = closeFullPageView;
