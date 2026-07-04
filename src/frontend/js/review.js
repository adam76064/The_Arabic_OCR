// ===== STATE =====
let currentProject = null;
let currentPageIndex = 0;
let selectedBlockIndex = -1;
let activeEditingIndex = -1;
let cropZoom = 1.0;
const CROP_MIN = 0.4, CROP_MAX = 8.0;
const DOTS_OCR_DPI = 200, PDF_NATIVE_DPI = 72;
let scaleRatioX = 1, scaleRatioY = 1;

// Undo stack: each entry is a deep-clone of ocrData before a destructive action
const undoStack = [];
const MAX_UNDO = 20;

const CATEGORY_COLORS = {
    'Caption':'#f39c12','Footnote':'#8e44ad','Formula':'#e74c3c',
    'List-item':'#3498db','Page-footer':'#95a5a6','Page-header':'#7f8c8d',
    'Picture':'#2c3e50','Section-header':'#1abc9c','Table':'#d35400',
    'Text':'#2ecc71','Title':'#c0392b'
};
const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS);

// ===== INIT =====
async function initApp() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    if (!projectId) { window.location.href = 'projects.html'; return; }

    currentProject = await window.pywebview.api.load_project(projectId);
    if (!currentProject) { alert('تعذّر تحميل المشروع'); window.location.href = 'projects.html'; return; }

    // Show project info in sidebar
    document.getElementById('sidebar-proj-title').textContent = currentProject.metadata?.title || '—';
    document.getElementById('sidebar-proj-meta').textContent = currentProject.metadata?.author || '';

    setupSidebar();
    setupToolbar();
    setupCropControls();
    setupFullPageView();
    setupCategoryPicker();
    setupResizablePanels();
    setupUndo();

    updateReviewPanel();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.pywebview) {
        initApp();
    } else {
        window.addEventListener('pywebviewready', initApp);
    }
});

// ===== SIDEBAR =====
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const tab = document.getElementById('sidebar-collapsed-tab');

    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        tab.classList.remove('hidden');
    });

    tab.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        tab.classList.add('hidden');
    });
}

// ===== TOOLBAR =====
function setupToolbar() {
    document.getElementById('prev-page').addEventListener('click', () => navigatePage(-1));
    document.getElementById('next-page').addEventListener('click', () => navigatePage(1));
    document.getElementById('save-page').addEventListener('click', () => savePage(true));
    document.getElementById('undo-btn').addEventListener('click', performUndo);

    document.getElementById('add-ocr-json').addEventListener('click', async () => {
        const jsonPath = await window.pywebview.api.select_ocr_json();
        if (!jsonPath) return;
        try {
            const updated = await window.pywebview.api.add_ocr_data(currentProject.id, jsonPath, currentPageIndex);
            currentProject = updated;
            selectedBlockIndex = -1;
            updateReviewPanel();
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء تحميل الملف.');
        }
    });

    // Formatting toolbar
    document.querySelectorAll('#sticky-toolbar button[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (activeEditingIndex === -1) return;
            const el = document.querySelector(`.text-block[data-index="${activeEditingIndex}"] .block-content`);
            if (!el) return;
            el.focus();
            document.execCommand(btn.dataset.cmd, false, null);
        });
    });

    // Thumbnail popup canvas click
    document.getElementById('thumb-popup-canvas').addEventListener('click', (e) => {
        handleCanvasClick(e, document.getElementById('thumb-popup-canvas'));
    });

    // Thumbnail wrapper click opens full page view
    document.getElementById('toolbar-thumb-wrapper').addEventListener('click', (e) => {
        if (e.target === document.getElementById('thumb-popup-canvas')) return;
        openFullPageView();
    });
}

function navigatePage(dir) {
    const next = currentPageIndex + dir;
    if (next < 0 || next >= currentProject.pages.length) return;
    currentPageIndex = next;
    selectedBlockIndex = -1;
    activeEditingIndex = -1;
    undoStack.length = 0;
    updateReviewPanel();
}

async function savePage(showAlert) {
    if (!currentProject) return;
    const page = currentProject.pages[currentPageIndex];
    page.status = 'reviewed';
    try {
        await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, page.ocr_data || []);
        if (showAlert) alert('تم حفظ الصفحة بنجاح.');
    } catch (err) {
        if (showAlert) alert('خطأ أثناء الحفظ.');
    }
}

async function saveBlockSilently() {
    if (!currentProject) return;
    const page = currentProject.pages[currentPageIndex];
    try { await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, page.ocr_data || []); }
    catch (err) { console.error('Auto-save failed:', err); }
}

// ===== REVIEW PANEL =====
function updateReviewPanel() {
    if (!currentProject?.pages?.length) return;
    document.getElementById('total-pages').textContent = currentProject.pages.length;
    document.getElementById('current-page-num').value = currentPageIndex + 1;

    const page = currentProject.pages[currentPageIndex];
    if (!page) return;

    const logicalStart = currentProject.metadata?.logical_start || 1;
    document.getElementById('logical-page-display').textContent = currentPageIndex + logicalStart;

    const imgPath = `../projects/${currentProject.id}/images/${page.image_path}`;
    const img = document.getElementById('page-image');
    const thumbImg = document.getElementById('thumb-image');
    const thumbPopup = document.getElementById('thumb-popup-image');
    const fullImg = document.getElementById('fullpage-image');

    [thumbImg, thumbPopup, fullImg].forEach(el => el.src = imgPath);
    img.src = imgPath;

    img.onload = () => {
        const canvas = document.getElementById('bbox-canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const w_ocr = (page.native_width / PDF_NATIVE_DPI) * DOTS_OCR_DPI;
        const h_ocr = (page.native_height / PDF_NATIVE_DPI) * DOTS_OCR_DPI;
        scaleRatioX = page.width / w_ocr;
        scaleRatioY = page.height / h_ocr;

        renderBboxes(page.ocr_data || [], selectedBlockIndex);
        renderThumbCanvas('thumb-canvas', 'thumb-image', page.ocr_data || [], selectedBlockIndex);
        renderThumbCanvas('thumb-popup-canvas', 'thumb-popup-image', page.ocr_data || [], selectedBlockIndex);
    };

    renderBlocksList(page.ocr_data || []);
    showCroppedView(null);
}

// ===== CANVAS RENDERING =====
function drawBoxes(canvas, ocrData, selectedIndex) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ocrData.forEach((el, i) => {
        const [x1,y1,x2,y2] = el.bbox;
        const bx = x1*scaleRatioX, by = y1*scaleRatioY;
        const bw = (x2-x1)*scaleRatioX, bh = (y2-y1)*scaleRatioY;
        const color = CATEGORY_COLORS[el.category||'Text'] || '#3498db';
        const scale = canvas.clientWidth ? canvas.clientWidth/canvas.width : 1;
        ctx.beginPath();
        ctx.rect(bx, by, bw, bh);
        if (i === selectedIndex) {
            ctx.lineWidth = 4/scale; ctx.strokeStyle='#f1c40f'; ctx.fillStyle='rgba(241,196,15,0.35)';
        } else if (el.reviewed) {
            ctx.lineWidth = 2/scale; ctx.strokeStyle='#27ae60'; ctx.fillStyle='rgba(39,174,96,0.12)';
        } else {
            ctx.lineWidth = 2/scale; ctx.strokeStyle=color; ctx.fillStyle=color+'22';
        }
        ctx.stroke(); ctx.fill();
    });
}

function renderBboxes(ocrData, sel) {
    const c = document.getElementById('bbox-canvas');
    if (c) drawBoxes(c, ocrData, sel);
}

function renderThumbCanvas(canvasId, imgId, ocrData, sel) {
    const canvas = document.getElementById(canvasId);
    const img = document.getElementById(imgId);
    if (!canvas || !img?.naturalWidth) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    drawBoxes(canvas, ocrData, sel);
}

function handleCanvasClick(e, canvas) {
    if (!currentProject?.pages[currentPageIndex]) return;
    const ocrData = currentProject.pages[currentPageIndex].ocr_data || [];
    const clickX = e.offsetX * (canvas.width / canvas.clientWidth);
    const clickY = e.offsetY * (canvas.height / canvas.clientHeight);
    let hit = -1;
    for (let i = ocrData.length-1; i >= 0; i--) {
        const [x1,y1,x2,y2] = ocrData[i].bbox;
        if (clickX >= x1*scaleRatioX && clickX <= x2*scaleRatioX &&
            clickY >= y1*scaleRatioY && clickY <= y2*scaleRatioY) { hit = i; break; }
    }
    selectBlock(hit);
    if (hit !== -1) closeFullPageView();
}

document.addEventListener('click', (e) => {
    const canvas = document.getElementById('bbox-canvas');
    if (canvas && e.target === canvas) handleCanvasClick(e, canvas);
});

// ===== BLOCK SELECTION =====
function selectBlock(index) {
    if (!currentProject) return;
    const ocrData = currentProject.pages[currentPageIndex].ocr_data || [];
    selectedBlockIndex = index;

    renderBboxes(ocrData, index);
    renderThumbCanvas('thumb-canvas','thumb-image', ocrData, index);
    renderThumbCanvas('thumb-popup-canvas','thumb-popup-image', ocrData, index);

    document.querySelectorAll('.text-block').forEach(el => el.classList.remove('active-block'));
    if (index !== -1) {
        const el = document.querySelector(`.text-block[data-index="${index}"]`);
        if (el) { el.classList.add('active-block'); el.scrollIntoView({behavior:'smooth',block:'nearest'}); }
        showCroppedView(ocrData[index].bbox);
    } else {
        showCroppedView(null);
    }
}

// ===== CROP VIEWER =====
function showCroppedView(bbox) {
    const viewer = document.getElementById('crop-viewer');
    const cropImg = document.getElementById('crop-image');
    const placeholder = document.getElementById('crop-placeholder');
    const img = document.getElementById('page-image');

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
    applyCropZoom();
}

function applyCropZoom() {
    const cropImg = document.getElementById('crop-image');
    const viewport = document.getElementById('crop-viewport');
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

function setupCropControls() {
    document.getElementById('crop-zoom-in').addEventListener('click', () => { cropZoom=Math.min(CROP_MAX,cropZoom+0.25); applyCropZoom(); });
    document.getElementById('crop-zoom-out').addEventListener('click', () => { cropZoom=Math.max(CROP_MIN,cropZoom-0.25); applyCropZoom(); });
    document.getElementById('crop-zoom-reset').addEventListener('click', () => { cropZoom=1.0; applyCropZoom(); });
}

// ===== FULL PAGE VIEW =====
function setupFullPageView() {
    document.getElementById('open-fullpage-btn').addEventListener('click', openFullPageView);
    document.getElementById('close-fullpage-btn').addEventListener('click', closeFullPageView);
    document.getElementById('fullpage-canvas').addEventListener('click', (e) => {
        handleCanvasClick(e, document.getElementById('fullpage-canvas'));
        const ocrData = currentProject?.pages[currentPageIndex]?.ocr_data || [];
        const c = document.getElementById('fullpage-canvas');
        renderThumbCanvas('fullpage-canvas', 'fullpage-image', ocrData, selectedBlockIndex);
    });
}

function openFullPageView() {
    if (!currentProject) return;
    const overlay = document.getElementById('fullpage-overlay');
    overlay.classList.remove('hidden');
    const fullImg = document.getElementById('fullpage-image');
    const drawWhenReady = () => {
        const c = document.getElementById('fullpage-canvas');
        c.width = fullImg.naturalWidth; c.height = fullImg.naturalHeight;
        drawBoxes(c, currentProject.pages[currentPageIndex].ocr_data || [], selectedBlockIndex);
    };
    fullImg.complete && fullImg.naturalWidth ? drawWhenReady() : (fullImg.onload = drawWhenReady);
}

function closeFullPageView() {
    document.getElementById('fullpage-overlay').classList.add('hidden');
}

// ===== BLOCKS LIST =====
function renderBlocksList(ocrData) {
    const container = document.getElementById('blocks-list');
    container.innerHTML = '';

    ocrData.forEach((element, index) => {
        if (element.category === 'Picture') return;

        const wrapper = document.createElement('div');
        wrapper.className = 'text-block' + (element.reviewed ? ' block-reviewed' : '');
        wrapper.dataset.index = index;
        wrapper.draggable = true;

        const color = CATEGORY_COLORS[element.category||'Text'] || '#3498db';

        // Drag handle
        const handle = document.createElement('span');
        handle.className = 'block-drag-handle';
        handle.title = 'اسحب لإعادة الترتيب';
        handle.innerHTML = '⋮⋮';
        handle.dataset.handle = '1';

        // Header
        const header = document.createElement('div');
        header.className = 'block-header';

        const label = document.createElement('span');
        label.className = 'block-label';
        label.style.color = color;
        label.textContent = element.category || 'Text';
        label.title = 'انقر لتغيير النوع';
        label.addEventListener('click', (e) => { e.stopPropagation(); openCategoryPicker(e, index); });

        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'block-review-btn' + (element.reviewed ? ' reviewed' : '');
        reviewBtn.textContent = element.reviewed ? '✔ تمت' : 'مراجَع';
        reviewBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            element.reviewed = !element.reviewed;
            reviewBtn.textContent = element.reviewed ? '✔ تمت' : 'مراجَع';
            reviewBtn.classList.toggle('reviewed', element.reviewed);
            wrapper.classList.toggle('block-reviewed', element.reviewed);
            renderBboxes(currentProject.pages[currentPageIndex].ocr_data, selectedBlockIndex);
            renderThumbCanvas('thumb-canvas','thumb-image', currentProject.pages[currentPageIndex].ocr_data, selectedBlockIndex);
            if (window.__appSettings?.autoSaveEnabled) await saveBlockSilently();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'block-delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.title = 'حذف (يمكن التراجع)';
        deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteBlock(index); });

        header.appendChild(handle);
        header.appendChild(label);
        header.appendChild(reviewBtn);
        header.appendChild(deleteBtn);

        // Content — render markdown to HTML for display
        const content = document.createElement('div');
        content.className = 'block-content';
        content.contentEditable = 'true';
        content.dir = 'rtl';
        // Use marked.js to render markdown if available
        const rawText = element.text || '';
        try {
            content.innerHTML = window.marked ? window.marked.parse(rawText) : rawText;
        } catch { content.innerHTML = rawText; }

        content.addEventListener('focus', () => {
            activeEditingIndex = index;
            selectBlock(index);
            document.getElementById('sticky-toolbar').classList.remove('disabled');
        });
        content.addEventListener('blur', async () => {
            element.text = content.innerHTML;
            if (window.__appSettings?.autoSaveEnabled) await saveBlockSilently();
        });

        wrapper.addEventListener('click', (e) => {
            if (!e.target.closest('[data-handle]') && e.target !== content &&
                !e.target.closest('button')) {
                selectBlock(index);
            }
        });

        wrapper.appendChild(header);
        wrapper.appendChild(content);

        setupBlockDrag(wrapper, index);

        container.appendChild(wrapper);
    });
}

// ===== DRAG TO REORDER =====
let dragSrcIndex = null;

function setupBlockDrag(wrapper, index) {
    const handle = wrapper.querySelector('.block-drag-handle');

    handle.addEventListener('mousedown', () => { wrapper.draggable = true; });
    wrapper.addEventListener('dragstart', (e) => {
        if (!e.target.querySelector('[data-handle]') && !e.target.dataset.handle) {
            e.preventDefault(); return;
        }
        dragSrcIndex = index;
        wrapper.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    wrapper.addEventListener('dragend', () => { wrapper.classList.remove('dragging'); });
    wrapper.addEventListener('dragover', (e) => { e.preventDefault(); wrapper.classList.add('drag-over'); });
    wrapper.addEventListener('dragleave', () => { wrapper.classList.remove('drag-over'); });
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('drag-over');
        if (dragSrcIndex === null || dragSrcIndex === index) return;
        reorderBlocks(dragSrcIndex, index);
        dragSrcIndex = null;
    });
}

function reorderBlocks(fromIndex, toIndex) {
    const page = currentProject.pages[currentPageIndex];
    pushUndo(page.ocr_data);
    const arr = page.ocr_data;
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    selectedBlockIndex = toIndex;
    renderBlocksList(arr);
    renderBboxes(arr, toIndex);
    renderThumbCanvas('thumb-canvas','thumb-image', arr, toIndex);
}

// ===== DELETE BLOCK =====
function deleteBlock(index) {
    const page = currentProject.pages[currentPageIndex];
    pushUndo(page.ocr_data);
    page.ocr_data.splice(index, 1);
    selectedBlockIndex = -1;
    renderBlocksList(page.ocr_data);
    renderBboxes(page.ocr_data, -1);
    renderThumbCanvas('thumb-canvas','thumb-image', page.ocr_data, -1);
    showCroppedView(null);
}

// ===== UNDO =====
function pushUndo(ocrData) {
    undoStack.push(JSON.parse(JSON.stringify(ocrData)));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    document.getElementById('undo-btn').disabled = false;
}

function performUndo() {
    if (!undoStack.length) return;
    const page = currentProject.pages[currentPageIndex];
    page.ocr_data = undoStack.pop();
    selectedBlockIndex = -1;
    renderBlocksList(page.ocr_data);
    renderBboxes(page.ocr_data, -1);
    renderThumbCanvas('thumb-canvas','thumb-image', page.ocr_data, -1);
    showCroppedView(null);
    if (!undoStack.length) document.getElementById('undo-btn').disabled = true;
}

function setupUndo() {
    document.getElementById('undo-btn').disabled = true;
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); performUndo(); }
    });
}

// ===== CATEGORY PICKER =====
function setupCategoryPicker() {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#category-picker')) {
            document.getElementById('category-picker').classList.add('hidden');
        }
    });
}

function openCategoryPicker(e, blockIndex) {
    const picker = document.getElementById('category-picker');
    const list = document.getElementById('category-picker-list');
    list.innerHTML = '';

    const page = currentProject.pages[currentPageIndex];
    const current = page.ocr_data[blockIndex]?.category;

    ALL_CATEGORIES.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'category-picker-item' + (cat === current ? ' active' : '');
        const dot = document.createElement('span');
        dot.className = 'category-color-dot';
        dot.style.background = CATEGORY_COLORS[cat];
        item.appendChild(dot);
        item.appendChild(document.createTextNode(cat));
        item.addEventListener('click', () => {
            page.ocr_data[blockIndex].category = cat;
            picker.classList.add('hidden');
            renderBlocksList(page.ocr_data);
            renderBboxes(page.ocr_data, selectedBlockIndex);
            renderThumbCanvas('thumb-canvas','thumb-image', page.ocr_data, selectedBlockIndex);
        });
        list.appendChild(item);
    });

    // Position near the label
    const rect = e.target.getBoundingClientRect();
    picker.style.top = (rect.bottom + 4) + 'px';
    picker.style.right = (window.innerWidth - rect.right) + 'px';
    picker.classList.remove('hidden');
}

// ===== RESIZABLE PANELS =====
function setupResizablePanels() {
    setupResize('crop-resize-handle', 'crop-section', 80, 400);
    setupResize('blocks-resize-handle', 'blocks-list-wrapper', 80, 800);
}

function setupResize(handleId, panelId, minH, maxH) {
    const handle = document.getElementById(handleId);
    const panel = document.getElementById(panelId);
    if (!handle || !panel) return;

    let startY, startH;
    handle.addEventListener('mousedown', (e) => {
        startY = e.clientY;
        startH = panel.offsetHeight;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
    });
    function onMove(e) {
        const delta = startY - e.clientY; // drag up = bigger
        const newH = Math.max(minH, Math.min(maxH, startH + delta));
        panel.style.height = newH + 'px';
        if (panelId === 'crop-section') applyCropZoom();
    }
    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }
}

// ══════════════════════════════════════════════════════════════════════
// BATCH B — EXPORT
// ══════════════════════════════════════════════════════════════════════
(function setupExport() {
    const modal = () => document.getElementById('export-modal');
    document.getElementById('export-btn').addEventListener('click', () => {
        // sync "to" page defaults
        document.getElementById('exp-to').value = currentProject?.pages?.length || 1;
        document.getElementById('exp-from').value = 1;
        modal().classList.remove('hidden');
    });
    document.getElementById('export-close').addEventListener('click', () => modal().classList.add('hidden'));
    document.getElementById('export-overlay').addEventListener('click', () => modal().classList.add('hidden'));

    // show/hide range inputs
    document.querySelectorAll('input[name="exp-pages"]').forEach(r => {
        r.addEventListener('change', () => {
            document.getElementById('exp-range-inputs').classList.toggle('hidden', r.value !== 'range');
        });
    });
    // show/hide docx options
    document.querySelectorAll('input[name="exp-fmt"]').forEach(r => {
        r.addEventListener('change', () => {
            document.getElementById('docx-opts').style.display = r.value === 'docx' ? '' : 'none';
        });
    });

    document.getElementById('export-confirm').addEventListener('click', async () => {
        const fmt = document.querySelector('input[name="exp-fmt"]:checked').value;
        const pagesMode = document.querySelector('input[name="exp-pages"]:checked').value;
        const total = currentProject.pages.length;
        let indices;
        if (pagesMode === 'all') {
            indices = Array.from({length: total}, (_, i) => i);
        } else if (pagesMode === 'current') {
            indices = [currentPageIndex];
        } else {
            const from = Math.max(1, parseInt(document.getElementById('exp-from').value) || 1) - 1;
            const to   = Math.min(total, parseInt(document.getElementById('exp-to').value) || total) - 1;
            indices = Array.from({length: to - from + 1}, (_, i) => from + i);
        }

        const opts = {
            font_name:    document.getElementById('exp-font').value,
            font_size:    document.getElementById('exp-font-size').value,
            line_spacing: document.getElementById('exp-line-spacing').value,
            para_indent:  document.getElementById('exp-indent').value,
            space_after:  document.getElementById('exp-space-after').value,
            page_size:    document.getElementById('exp-page-size').value,
            landscape:    document.getElementById('exp-landscape').checked,
            page_break:   document.getElementById('exp-page-break').checked,
            rtl:          document.getElementById('exp-rtl').checked,
            page_numbering: document.querySelector('input[name="exp-pgnum"]:checked').value,
        };

        modal().classList.add('hidden');
        try {
            const result = await window.pywebview.api.export_project(currentProject.id, fmt, indices, opts);
            if (result) showNotif('تم التصدير بنجاح ✓', 'success');
        } catch (e) {
            showNotif('خطأ أثناء التصدير', 'error');
        }
    });
})();

// ══════════════════════════════════════════════════════════════════════
// BATCH C — FULL-TEXT PREVIEW / EDIT
// ══════════════════════════════════════════════════════════════════════
(function setupTextPreview() {
    document.getElementById('text-preview-btn').addEventListener('click', () => {
        // Build combined text from all pages
        const lines = [];
        const logicalStart = currentProject?.metadata?.logical_start || 1;
        currentProject.pages.forEach((page, i) => {
            lines.push(`\n\n─── صفحة ${i + logicalStart} ───\n`);
            (page.ocr_data || []).forEach(el => {
                if (el.category === 'Picture') return;
                lines.push(el.text || '');
            });
        });
        document.getElementById('text-preview-body').innerText = lines.join('\n').trim();
        document.getElementById('text-preview-overlay').classList.remove('hidden');
    });

    document.getElementById('text-preview-close').addEventListener('click', () => {
        document.getElementById('text-preview-overlay').classList.add('hidden');
    });

    document.getElementById('text-preview-save').addEventListener('click', () => {
        // Parse back: split by page separator lines, update ocr_data first Text block on each page
        // (lightweight: sets text of each page as a single merged block)
        const raw = document.getElementById('text-preview-body').innerText;
        const pageSep = /─── صفحة \d+ ───/g;
        const parts = raw.split(pageSep).slice(1);
        parts.forEach((part, i) => {
            if (!currentProject.pages[i]) return;
            const trimmed = part.trim();
            const page = currentProject.pages[i];
            // Find first non-Picture block or create one
            let target = (page.ocr_data || []).find(el => el.category !== 'Picture');
            if (target) {
                target.text = trimmed;
            }
        });
        savePage(false).then(() => showNotif('تم حفظ التعديلات ✓', 'success'));
        document.getElementById('text-preview-overlay').classList.add('hidden');
    });
})();

// ══════════════════════════════════════════════════════════════════════
// BATCH D — PROJECT SETTINGS + NIGHT MODE
// ══════════════════════════════════════════════════════════════════════
const _projSettings = {
    night_mode: false, autosave: false,
    notif_join: true, notif_page: true, notif_edit: false,
};

function applyNightMode(on) {
    document.body.classList.toggle('night-mode', on);
    _projSettings.night_mode = on;
}

(function setupProjSettings() {
    const modal = () => document.getElementById('proj-settings-modal');
    document.getElementById('proj-settings-btn').addEventListener('click', () => {
        const m = currentProject?.metadata || {};
        document.getElementById('ps-title').value       = m.title || '';
        document.getElementById('ps-author').value      = m.author || '';
        document.getElementById('ps-publisher').value   = m.publisher || '';
        document.getElementById('ps-logical-start').value = m.logical_start || 1;
        document.getElementById('ps-night-mode').checked = _projSettings.night_mode;
        document.getElementById('ps-autosave').checked  = window.__appSettings?.autoSaveEnabled || false;
        document.getElementById('ps-notif-join').checked = _projSettings.notif_join;
        document.getElementById('ps-notif-page').checked = _projSettings.notif_page;
        document.getElementById('ps-notif-edit').checked = _projSettings.notif_edit;
        modal().classList.remove('hidden');
    });
    document.getElementById('proj-settings-close').addEventListener('click', () => modal().classList.add('hidden'));

    document.getElementById('proj-settings-save').addEventListener('click', async () => {
        currentProject.metadata.title         = document.getElementById('ps-title').value;
        currentProject.metadata.author        = document.getElementById('ps-author').value;
        currentProject.metadata.publisher     = document.getElementById('ps-publisher').value;
        currentProject.metadata.logical_start = parseInt(document.getElementById('ps-logical-start').value) || 1;
        _projSettings.night_mode  = document.getElementById('ps-night-mode').checked;
        _projSettings.notif_join  = document.getElementById('ps-notif-join').checked;
        _projSettings.notif_page  = document.getElementById('ps-notif-page').checked;
        _projSettings.notif_edit  = document.getElementById('ps-notif-edit').checked;
        window.__appSettings = window.__appSettings || {};
        window.__appSettings.autoSaveEnabled = document.getElementById('ps-autosave').checked;
        applyNightMode(_projSettings.night_mode);
        await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex,
            currentProject.pages[currentPageIndex]?.ocr_data || []);
        modal().classList.add('hidden');
        showNotif('تم حفظ الإعدادات ✓', 'success');
        // Update sidebar title
        document.getElementById('sidebar-proj-title').textContent = currentProject.metadata.title || '—';
        document.getElementById('logical-page-display').textContent =
            currentPageIndex + (currentProject.metadata.logical_start || 1);
    });
})();

// ══════════════════════════════════════════════════════════════════════
// BATCH D — RANGED OCR JSON IMPORT
// ══════════════════════════════════════════════════════════════════════
(function setupOcrRange() {
    let selectedJsonPath = null;
    const modal = () => document.getElementById('ocr-range-modal');
    document.getElementById('ocr-range-btn').addEventListener('click', () => modal().classList.remove('hidden'));
    document.getElementById('ocr-range-close').addEventListener('click', () => modal().classList.add('hidden'));

    document.querySelectorAll('input[name="ocr-range-mode"]').forEach(r => {
        r.addEventListener('change', () => {
            document.getElementById('ocr-range-inputs').classList.toggle('hidden', r.value !== 'range');
        });
    });

    document.getElementById('ocr-range-pick-file').addEventListener('click', async () => {
        const path = await window.pywebview.api.select_ocr_json();
        if (path) {
            selectedJsonPath = path;
            document.getElementById('ocr-range-path').textContent = path;
        }
    });

    document.getElementById('ocr-range-confirm').addEventListener('click', async () => {
        if (!selectedJsonPath) { showNotif('اختر ملف JSON أولاً', 'error'); return; }
        const mode = document.querySelector('input[name="ocr-range-mode"]:checked').value;
        let indices;
        if (mode === 'current') {
            indices = [currentPageIndex];
        } else {
            const total = currentProject.pages.length;
            const from = Math.max(1, parseInt(document.getElementById('ocr-range-from').value) || 1) - 1;
            const to   = Math.min(total, parseInt(document.getElementById('ocr-range-to').value) || total) - 1;
            indices = Array.from({length: to - from + 1}, (_, i) => from + i);
        }
        modal().classList.add('hidden');
        for (const idx of indices) {
            try {
                const updated = await window.pywebview.api.add_ocr_data(currentProject.id, selectedJsonPath, idx);
                currentProject = updated;
            } catch (e) { console.error('OCR range error on page', idx, e); }
        }
        updateReviewPanel();
        showNotif(`تم تطبيق OCR على ${indices.length} صفحة ✓`, 'success');
    });
})();

// ══════════════════════════════════════════════════════════════════════
// BATCH E — TASHKEEL BRUSH + FORMAT PAINTER
// ══════════════════════════════════════════════════════════════════════
(function setupBrushTools() {
    const TASHKEEL_RE = /[\u064B-\u0652]/g;
    let tashkeelActive = false;
    let formatBrushActive = false;
    let copiedStyle = null; // {bold, italic, underline}

    const tBtn = document.getElementById('tashkeel-brush-btn');
    const fBtn = document.getElementById('format-brush-btn');

    function deactivateBrushes() {
        tashkeelActive = false;
        formatBrushActive = false;
        tBtn.style.background = '';
        fBtn.style.background = '';
        document.body.style.cursor = '';
    }

    tBtn.addEventListener('click', () => {
        tashkeelActive = !tashkeelActive;
        formatBrushActive = false;
        fBtn.style.background = '';
        tBtn.style.background = tashkeelActive ? '#f39c12' : '';
        document.body.style.cursor = tashkeelActive ? 'crosshair' : '';
    });

    fBtn.addEventListener('click', () => {
        if (!formatBrushActive && activeEditingIndex === -1) {
            showNotif('انقر أولاً داخل كتلة لنسخ تنسيقها', 'info'); return;
        }
        if (!formatBrushActive) {
            // capture
            copiedStyle = {
                bold:      document.queryCommandState('bold'),
                italic:    document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
            };
            formatBrushActive = true;
            fBtn.style.background = '#3498db';
            document.body.style.cursor = 'copy';
        } else {
            deactivateBrushes();
        }
    });

    // Apply on mouseup inside any block-content
    document.addEventListener('mouseup', (e) => {
        const contentEl = e.target.closest('.block-content');
        if (!contentEl) return;

        if (tashkeelActive) {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) return;
            const range = sel.getRangeAt(0);
            const text = range.toString();
            if (!text) return;
            const cleaned = text.replace(TASHKEEL_RE, '');
            const textNode = document.createTextNode(cleaned);
            range.deleteContents();
            range.insertNode(textNode);
            // persist
            const blockEl = contentEl.closest('.text-block');
            const idx = parseInt(blockEl?.dataset.index);
            if (!isNaN(idx) && currentProject?.pages[currentPageIndex]) {
                const el = currentProject.pages[currentPageIndex].ocr_data[idx];
                if (el) { el.text = contentEl.innerHTML; saveBlockSilently(); }
            }
            sel.removeAllRanges();
        }

        if (formatBrushActive && copiedStyle) {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) return;
            if (copiedStyle.bold)      document.execCommand('bold', false, null);
            if (copiedStyle.italic)    document.execCommand('italic', false, null);
            if (copiedStyle.underline) document.execCommand('underline', false, null);
            deactivateBrushes();
        }
    });

    // ESC cancels brush
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (tashkeelActive || formatBrushActive)) deactivateBrushes();
    });
})();

// ══════════════════════════════════════════════════════════════════════
// BATCH F — NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════
function showNotif(msg, type = 'info') {
    // type: 'info' | 'success' | 'error' | 'warning'
    const colors = { info:'#3498db', success:'#27ae60', error:'#e74c3c', warning:'#f39c12' };
    const tray = document.getElementById('notif-tray');
    const n = document.createElement('div');
    n.style.cssText = `background:${colors[type]||colors.info};color:white;padding:10px 16px;border-radius:8px;
        font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,0.2);max-width:280px;cursor:pointer;
        animation:slideIn 0.25s ease;`;
    n.textContent = msg;
    n.addEventListener('click', () => n.remove());
    tray.appendChild(n);
    setTimeout(() => { if (n.parentNode) n.remove(); }, 5000);
}

// LAN peer notifications
window.onLanUpdate = function(payload) {
    if (!_projSettings) return;
    const type = payload.type;
    if (type === 'presence' && _projSettings.notif_join) {
        const status = payload.status === 'join' ? 'انضم إلى المشروع' : 'غادر المشروع';
        showNotif(`👤 ${payload.username} ${status}`, 'info');
    }
    if (type === 'sync_update') {
        if (_projSettings.notif_edit) {
            showNotif(`✏ ${payload.username || 'مستخدم'} عدّل صفحة ${(payload.page_index||0)+1}`, 'info');
        }
        // apply remote update locally
        const pg = currentProject?.pages[payload.page_index];
        if (pg) {
            pg.ocr_data = payload.ocr_data;
            if (payload.page_index === currentPageIndex) updateReviewPanel();
        }
    }
};

// ══════════════════════════════════════════════════════════════════════
// BATCH F — DASHBOARD
// ══════════════════════════════════════════════════════════════════════
(function setupDashboard() {
    document.getElementById('dashboard-btn').addEventListener('click', () => {
        renderDashboard();
        document.getElementById('dashboard-overlay').classList.remove('hidden');
    });
    document.getElementById('dashboard-close').addEventListener('click', () => {
        document.getElementById('dashboard-overlay').classList.add('hidden');
    });
})();

function renderDashboard() {
    const body = document.getElementById('dashboard-body');
    if (!currentProject) return;
    const pages = currentProject.pages || [];
    const total = pages.length;
    const reviewed = pages.filter(p => p.status === 'reviewed').length;
    const ocred = pages.filter(p => (p.ocr_data||[]).length > 0).length;
    const pct = total ? Math.round(reviewed / total * 100) : 0;

    // Per-user participation (counted from ocr_data.reviewed_by if present, else skip)
    const userStats = {};
    pages.forEach(page => {
        (page.ocr_data || []).forEach(el => {
            const u = el.reviewed_by || null;
            if (!u) return;
            userStats[u] = userStats[u] || { blocks: 0, pages: new Set() };
            userStats[u].blocks++;
            userStats[u].pages.add(page.pdf_index ?? 0);
        });
    });
    const totalBlocks = pages.reduce((s, p) => s + (p.ocr_data||[]).length, 0);

    // Bar chart via inline SVG
    const barData = [
        { label: 'الكل', val: total, color: '#95a5a6' },
        { label: 'OCR', val: ocred, color: '#3498db' },
        { label: 'مراجعة', val: reviewed, color: '#27ae60' },
    ];
    const maxVal = Math.max(total, 1);
    const bars = barData.map(d => {
        const h = Math.round((d.val / maxVal) * 120);
        return `<g>
            <rect x="0" y="${130-h}" width="50" height="${h}" fill="${d.color}" rx="4"/>
            <text x="25" y="${130-h-5}" text-anchor="middle" font-size="13" fill="#333">${d.val}</text>
            <text x="25" y="148" text-anchor="middle" font-size="11" fill="#888">${d.label}</text>
        </g>`;
    });

    // Page grid: color by status
    const gridCells = pages.map((pg, i) => {
        let fill = '#eee'; // pending
        if ((pg.ocr_data||[]).length > 0) fill = '#aed6f1';
        if (pg.status === 'reviewed') fill = '#a9dfbf';
        const title = `صفحة ${i+1}`;
        return `<div title="${title}" style="width:20px;height:20px;border-radius:3px;background:${fill};cursor:default;"></div>`;
    }).join('');

    // User table
    const userRows = Object.entries(userStats).map(([u, st]) => {
        const pct2 = totalBlocks ? Math.round(st.blocks / totalBlocks * 100) : 0;
        return `<tr>
            <td style="padding:8px 12px;">${u}</td>
            <td style="padding:8px 12px;">${st.blocks}</td>
            <td style="padding:8px 12px;">${st.pages.size}</td>
            <td style="padding:8px 12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden;">
                        <div style="width:${pct2}%;height:100%;background:#3498db;border-radius:4px;"></div>
                    </div>
                    <span style="font-size:12px;color:#888;">${pct2}%</span>
                </div>
            </td>
        </tr>`;
    }).join('');

    body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
            <div style="background:white;border-radius:10px;padding:20px;border:1px solid #e0e0e0;">
                <div style="font-size:13px;color:#888;margin-bottom:4px;">التقدم الكلي</div>
                <div style="font-size:36px;font-weight:800;color:#27ae60;">${pct}%</div>
                <div style="height:8px;background:#eee;border-radius:4px;margin-top:10px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:#27ae60;border-radius:4px;transition:width .5s;"></div>
                </div>
                <div style="font-size:12px;color:#888;margin-top:6px;">${reviewed} من ${total} صفحة مراجَعة</div>
            </div>
            <div style="background:white;border-radius:10px;padding:20px;border:1px solid #e0e0e0;">
                <div style="font-size:13px;color:#888;margin-bottom:10px;">إحصائيات</div>
                <svg viewBox="0 0 ${barData.length * 80} 160" width="100%" height="160">
                    ${bars.map((b, i) => `<g transform="translate(${i*80+15},0)">${b}</g>`).join('')}
                </svg>
            </div>
        </div>
        <div style="background:white;border-radius:10px;padding:20px;border:1px solid #e0e0e0;margin-bottom:24px;">
            <div style="font-size:13px;font-weight:700;color:#555;margin-bottom:12px;">خريطة الصفحات</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${gridCells}</div>
            <div style="display:flex;gap:14px;margin-top:10px;font-size:12px;color:#888;">
                <span><span style="display:inline-block;width:12px;height:12px;background:#eee;border-radius:2px;vertical-align:middle;margin-left:4px;"></span>بانتظار OCR</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#aed6f1;border-radius:2px;vertical-align:middle;margin-left:4px;"></span>OCR موجود</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#a9dfbf;border-radius:2px;vertical-align:middle;margin-left:4px;"></span>مراجَعة</span>
            </div>
        </div>
        ${userRows ? `
        <div style="background:white;border-radius:10px;border:1px solid #e0e0e0;overflow:hidden;">
            <div style="padding:14px 16px;font-size:13px;font-weight:700;color:#555;border-bottom:1px solid #eee;">مشاركة الأعضاء</div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f8f9fa;">
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">المستخدم</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">الكتل</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">الصفحات</th>
                    <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">المشاركة</th>
                </tr></thead>
                <tbody>${userRows}</tbody>
            </table>
        </div>` : ''}
    `;
}

// ══════════════════════════════════════════════════════════════════════
// NIGHT MODE CSS injected at runtime
// ══════════════════════════════════════════════════════════════════════
(function injectNightModeCss() {
    const style = document.createElement('style');
    style.textContent = `
    body.night-mode { background:#1a1a2e; color:#e0e0e0; }
    body.night-mode #main-content { background:#1a1a2e; }
    body.night-mode .toolbar { background:#16213e; box-shadow:0 2px 6px rgba(0,0,0,0.4); }
    body.night-mode #text-editor { background:#16213e; border-color:#2a2a4a; }
    body.night-mode #sticky-toolbar { background:#0f3460; border-color:#2a2a4a; }
    body.night-mode #sticky-toolbar button { background:#16213e; border-color:#2a2a4a; color:#e0e0e0; }
    body.night-mode .text-block { background:#16213e; border-color:#2a2a4a; }
    body.night-mode .text-block:hover { border-color:#3498db; }
    body.night-mode .block-content:focus { background:#0f3460; }
    body.night-mode #crop-section { background:#16213e; }
    body.night-mode #crop-viewport { background:#111; }
    body.night-mode #sidebar { background:#0f3460; }
    body.night-mode .modal-box { background:#16213e; color:#e0e0e0; }
    body.night-mode .modal-header { background:#0f3460; }
    body.night-mode input[type=text],
    body.night-mode input[type=number],
    body.night-mode input[type=password],
    body.night-mode select { background:#0f3460; border-color:#2a2a4a; color:#e0e0e0; }
    `;
    document.head.appendChild(style);
    // Also inject slide-in keyframe for notifs
    const ks = document.createElement('style');
    ks.textContent = `@keyframes slideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(ks);
})();
