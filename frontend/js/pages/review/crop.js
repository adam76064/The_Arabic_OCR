/**
 * pages/review/crop.js - crop viewer logic
 * Extracted from review.js
 */

function getPageImageSrc() {
    const page = currentProject?.pages?.[currentPageIndex];
    if (!page) return { src: '', naturalW: 0, naturalH: 0 };
    
    const fullImg = document.getElementById('fullpage-image');
    if (fullImg && fullImg.src && fullImg.naturalWidth > 0) {
        return { src: fullImg.src, naturalW: fullImg.naturalWidth, naturalH: fullImg.naturalHeight };
    }

    const thumbImg = document.getElementById('thumb-image');
    if (thumbImg && thumbImg.src && thumbImg.naturalWidth > 0) {
        return { src: thumbImg.src, naturalW: thumbImg.naturalWidth, naturalH: thumbImg.naturalHeight };
    }

    const baseSrc = `file:///${window.__appDataPath}/projects/${currentProject.id}/images/${page.image_path}`;
    return { src: baseSrc, naturalW: 0, naturalH: 0 };
}

function showCroppedView(bbox) {
    const viewer = document.getElementById('crop-viewer');
    const cropImg = document.getElementById('crop-image');
    const placeholder = document.getElementById('crop-placeholder');
    const page = currentProject?.pages?.[currentPageIndex];

    if (!viewer || !cropImg || !placeholder || !page) return;

    if (!bbox) {
        viewer.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    const renderCrop = (imgSrc, naturalW, naturalH) => {
        if (!naturalW || !naturalH) return;

        placeholder.classList.add('hidden');
        viewer.classList.remove('hidden');

        const nativeW = page.native_width || (naturalW / 200 * 72);
        const nativeH = page.native_height || (naturalH / 200 * 72);
        const ratioX = naturalW / (nativeW || 1);
        const ratioY = naturalH / (nativeH || 1);

        const [x1, y1, x2, y2] = bbox;
        const px = x1 * ratioX;
        const py = y1 * ratioY;
        const pw = Math.max(1, (x2 - x1) * ratioX);
        const ph = Math.max(1, (y2 - y1) * ratioY);

        cropImg.style.backgroundImage = `url('${imgSrc}')`;
        cropImg.dataset.boxX = px;
        cropImg.dataset.boxY = py;
        cropImg.dataset.boxW = pw;
        cropImg.dataset.boxH = ph;
        cropImg.dataset.naturalW = naturalW;
        cropImg.dataset.naturalH = naturalH;

        cropZoom = 1.0;
        cropPanX = 0;
        cropPanY = 0;
        applyCropZoom();
    };

    const imgInfo = getPageImageSrc();
    if (imgInfo.naturalW > 0) {
        renderCrop(imgInfo.src, imgInfo.naturalW, imgInfo.naturalH);
    } else {
        const offscreen = new Image();
        offscreen.onload = () => {
            renderCrop(offscreen.src, offscreen.naturalWidth, offscreen.naturalHeight);
        };
        offscreen.src = imgInfo.src;
    }
}

function applyCropZoom() {
    const cropImg = document.getElementById('crop-image');
    const viewport = document.getElementById('crop-viewport');
    if (!cropImg || !viewport) return;
    if (!cropImg.dataset.boxW) return;

    const bx = +cropImg.dataset.boxX;
    const by = +cropImg.dataset.boxY;
    const bw = +cropImg.dataset.boxW;
    const bh = +cropImg.dataset.boxH;
    const nw = +cropImg.dataset.naturalW;
    const nh = +cropImg.dataset.naturalH;
    const vw = viewport.clientWidth || 300;
    const vh = viewport.clientHeight || 150;

    const fit = Math.min((vw - 24) / Math.max(bw, 1), (vh - 24) / Math.max(bh, 1));
    const fs = fit * cropZoom;
    const bgW = nw * fs;
    const bgH = nh * fs;
    const ox = (vw / 2) - (bx + bw / 2) * fs;
    const oy = (vh / 2) - (by + bh / 2) * fs;

    cropImg.style.width = bgW + 'px';
    cropImg.style.height = bgH + 'px';
    cropImg.style.backgroundSize = `${bgW}px ${bgH}px`;
    cropImg.style.transform = `translate(${ox}px, ${oy}px)`;
}

function panCropViewTo(bbox) {
    const cropImg = document.getElementById('crop-image');
    if (!cropImg || !cropImg.dataset.naturalW || !bbox) return;
    const page = currentProject?.pages?.[currentPageIndex];
    const naturalW = +cropImg.dataset.naturalW;
    const naturalH = +cropImg.dataset.naturalH;
    const nativeW = page?.native_width || (naturalW / 200 * 72);
    const nativeH = page?.native_height || (naturalH / 200 * 72);
    const ratioX = naturalW / (nativeW || 1);
    const ratioY = naturalH / (nativeH || 1);

    const [x1, y1, x2, y2] = bbox;
    cropImg.dataset.boxX = x1 * ratioX;
    cropImg.dataset.boxY = y1 * ratioY;
    cropImg.dataset.boxW = (x2 - x1) * ratioX;
    cropImg.dataset.boxH = (y2 - y1) * ratioY;
    applyCropZoom();
}

function setupCropControls() {
    const zoomIn = document.getElementById('crop-zoom-in');
    const zoomOut = document.getElementById('crop-zoom-out');
    const zoomReset = document.getElementById('crop-zoom-reset');
    if (zoomIn) zoomIn.addEventListener('click', () => { cropZoom = Math.min(CROP_MAX, cropZoom + 0.25); applyCropZoom(); });
    if (zoomOut) zoomOut.addEventListener('click', () => { cropZoom = Math.max(CROP_MIN, cropZoom - 0.25); applyCropZoom(); });
    if (zoomReset) zoomReset.addEventListener('click', () => { cropZoom = 1.0; applyCropZoom(); });

    window.addEventListener('resize', () => {
        if (!document.getElementById('crop-viewer')?.classList.contains('hidden')) {
            applyCropZoom();
        }
    });
}

window.showCroppedView = showCroppedView;
window.applyCropZoom = applyCropZoom;
window.panCropViewTo = panCropViewTo;
window.setupCropControls = setupCropControls;
