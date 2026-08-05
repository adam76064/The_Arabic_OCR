/**
 * pages/review/crop.js - crop viewer logic
 * Extracted from review.js
 */

function showCroppedView(bbox) {
    const viewer = document.getElementById('crop-viewer');
    const cropImg = document.getElementById('crop-image');
    const placeholder = document.getElementById('crop-placeholder');
    const img = document.getElementById('page-image');

    if (!viewer || !cropImg || !placeholder || !img) return;

    if (!bbox || !img.naturalWidth) {
        viewer.classList.add('hidden'); placeholder.classList.remove('hidden'); return;
    }
    placeholder.classList.add('hidden'); viewer.classList.remove('hidden');

    const [x1,y1,x2,y2] = bbox;
    const px = x1*scaleRatioX, py = y1*scaleRatioY;
    const pw = (x2-x1)*scaleRatioX, ph = (y2-y1)*scaleRatioY;

    cropImg.style.backgroundImage = `url('${img.src}')`;
    cropImg.dataset.boxX=px; cropImg.dataset.boxY=py;
    cropImg.dataset.boxW=pw; cropImg.dataset.boxH=ph;
    cropImg.dataset.naturalW=img.naturalWidth; cropImg.dataset.naturalH=img.naturalHeight;
    
    cropZoom = 1.0;
    cropPanX = 0;
    cropPanY = 0;
    applyCropZoom();
}

function applyCropZoom() {
    const cropImg = document.getElementById('crop-image');
    const viewport = document.getElementById('crop-viewport');
    if (!cropImg || !viewport) return;
    if (!cropImg.dataset.boxW) return;
    const bx=+cropImg.dataset.boxX, by=+cropImg.dataset.boxY;
    const bw=+cropImg.dataset.boxW, bh=+cropImg.dataset.boxH;
    const nw=+cropImg.dataset.naturalW, nh=+cropImg.dataset.naturalH;
    const vw=viewport.clientWidth, vh=viewport.clientHeight;
    const fit = Math.min((vw-20)/bw, (vh-20)/bh);
    const fs = fit * cropZoom;
    const bgW=nw*fs, bgH=nh*fs;
    const ox = vw/2 - (bx+bw/2)*fs;
    const oy = vh/2 - (by+bh/2)*fs;
    cropImg.style.width=bgW+'px'; cropImg.style.height=bgH+'px';
    cropImg.style.backgroundSize=`${bgW}px ${bgH}px`;
    cropImg.style.transform=`translate(${ox}px,${oy}px)`;
}

function panCropViewTo(bbox) {
    const cropImg = document.getElementById('crop-image');
    if (!cropImg || !cropImg.dataset.naturalW) return;
    const [x1, y1, x2, y2] = bbox;
    cropImg.dataset.boxX = x1 * scaleRatioX;
    cropImg.dataset.boxY = y1 * scaleRatioY;
    cropImg.dataset.boxW = (x2 - x1) * scaleRatioX;
    cropImg.dataset.boxH = (y2 - y1) * scaleRatioY;
    applyCropZoom();
}

function setupCropControls() {
    const zoomIn = document.getElementById('crop-zoom-in');
    const zoomOut = document.getElementById('crop-zoom-out');
    const zoomReset = document.getElementById('crop-zoom-reset');
    if (zoomIn) zoomIn.addEventListener('click', () => { cropZoom=Math.min(CROP_MAX,cropZoom+0.25); applyCropZoom(); });
    if (zoomOut) zoomOut.addEventListener('click', () => { cropZoom=Math.max(CROP_MIN,cropZoom-0.25); applyCropZoom(); });
    if (zoomReset) zoomReset.addEventListener('click', () => { cropZoom=1.0; applyCropZoom(); });
}

window.showCroppedView = showCroppedView;
window.applyCropZoom = applyCropZoom;
window.panCropViewTo = panCropViewTo;
window.setupCropControls = setupCropControls;
