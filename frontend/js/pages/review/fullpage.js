/**
 * pages/review/fullpage.js - Full page interactive overlay
 * Clicking the toolbar thumbnail opens this temporary lightbox overlay.
 * Clicking on any bounding box selects it in the editor and closes the overlay.
 */

function setupFullPageView() {
    const thumbWrapper = document.getElementById('toolbar-thumb-wrapper');
    const thumbPopupCanvas = document.getElementById('thumb-popup-canvas');
    const closeBtn = document.getElementById('close-fullpage-btn');
    const fullCanvas = document.getElementById('fullpage-canvas');
    const fullOverlay = document.getElementById('fullpage-overlay');

    if (thumbWrapper && !thumbWrapper._fullpageBound) {
        thumbWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            openFullPageView();
        });
        thumbWrapper._fullpageBound = true;
    }

    if (thumbPopupCanvas && !thumbPopupCanvas._clickBound) {
        thumbPopupCanvas.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof handleCanvasClick === 'function') handleCanvasClick(e, thumbPopupCanvas);
        });
        thumbPopupCanvas._clickBound = true;
    }

    if (closeBtn && !closeBtn._closeBound) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFullPageView();
        });
        closeBtn._closeBound = true;
    }

    if (fullOverlay && !fullOverlay._backdropBound) {
        fullOverlay.addEventListener('click', (e) => {
            if (e.target === fullOverlay || e.target.id === 'fullpage-body') {
                closeFullPageView();
            }
        });
        fullOverlay._backdropBound = true;
    }

    if (fullCanvas && !fullCanvas._clickBound) {
        fullCanvas.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof handleCanvasClick === 'function') handleCanvasClick(e, fullCanvas);
        });
        fullCanvas._clickBound = true;
    }

    // Escape key closes full page overlay
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFullPageView();
        }
    });
}

function openFullPageView() {
    if (!currentProject?.pages?.[currentPageIndex]) return;
    const overlay = document.getElementById('fullpage-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');

    const fullImg = document.getElementById('fullpage-image');
    const page = currentProject.pages[currentPageIndex];
    if (!fullImg || !page) return;

    const imgPath = `file:///${window.__appDataPath}/projects/${currentProject.id}/images/${page.image_path}`;
    fullImg.src = imgPath;

    const drawWhenReady = () => {
        const c = document.getElementById('fullpage-canvas');
        if (!c || !fullImg.naturalWidth) return;
        c.width = fullImg.naturalWidth;
        c.height = fullImg.naturalHeight;
        if (typeof drawBoxes === 'function') {
            drawBoxes(c, page.ocr_data || [], selectedBlockIndex);
        }
    };

    if (fullImg.complete && fullImg.naturalWidth > 0) {
        drawWhenReady();
    } else {
        fullImg.onload = drawWhenReady;
    }
}

function closeFullPageView() {
    const overlay = document.getElementById('fullpage-overlay');
    if (overlay) overlay.classList.add('hidden');
}

window.setupFullPageView = setupFullPageView;
window.openFullPageView = openFullPageView;
window.closeFullPageView = closeFullPageView;
