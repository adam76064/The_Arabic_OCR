// ===== STATE =====
let currentProject = null;
let currentPageIndex = 0;
let selectedBlockIndex = -1;
let multiSelectedBlocks = new Set(); // Track multi-selected blocks
let activeEditingIndex = -1;
let cropZoom = 1.0;
const CROP_MIN = 0.4, CROP_MAX = 8.0;
let scaleRatioX = 1, scaleRatioY = 1;

try { document.execCommand('styleWithCSS', false, true); } catch (e) { /* ignore */ }

// history state + historyLimit() now live in undo-redo.js

const BASE_CATEGORIES = {
    'Caption':'#f39c12','Footnote':'#8e44ad','Formula':'#e74c3c',
    'List-item':'#3498db','Page-footer':'#95a5a6','Page-header':'#7f8c8d',
    'Picture':'#2c3e50','Section-header':'#1abc9c','Table':'#d35400',
    'Text':'#2ecc71','Title':'#c0392b'
};

// توليد الألوان والتصنيفات ديناميكياً بدمج الأساسية مع المخصصة
function getCategoryColors() {
    return { ...BASE_CATEGORIES, ...(window.__appSettings?.customCategories || {}) };
}

// Visual Mask for Arabic UI
const CATEGORY_ARABIC_MAP = {
    'Text': 'نص عادي',
    'Table': 'جدول',
    'Title': 'عنوان رئيسي',
    'Section-header': 'عنوان فرعي',
    'Picture': 'صورة / رسم',
    'Caption': 'تسمية توضيحية',
    'List-item': 'عنصر قائمة',
    'Footnote': 'حاشية سفلية',
    'Page-header': 'رأس الصفحة',
    'Page-footer': 'تذييل الصفحة',
    'Formula': 'معادلة رياضية'
};

// Helper function that translates standard categories, but leaves custom Arabic categories (like شعر عمودي) as they are.
function getCategoryNameAR(catName) {
    return CATEGORY_ARABIC_MAP[catName] || catName;
}

function getAllCategories() {
    return Object.keys(getCategoryColors());
}

// دالة مساعدة سحرية لمعاملة الشعر العمودي كجدول
function isTableLike(category) {
    return category === 'Table' || category === 'شعر عمودي';
}

// ══════════════════════════════════════════════════════════════════════
// DYNAMIC UI INJECTION (Context Menu & Split Modal)
// ══════════════════════════════════════════════════════════════════════
// ===== INIT =====
async function initApp() {
    document.body.insertAdjacentHTML('beforeend', BLOCK_CONTEXT_MODALS_HTML);

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    const targetPage = params.get('page'); 

    if (!projectId) { window.location.href = 'projects.html'; return; }

    window.__appDataPath = await window.pywebview.api.get_app_data_path();
    window.__appDataPath = window.__appDataPath.replace(/\\/g, '/');

    currentProject = await window.pywebview.api.load_project(projectId);
    if (!currentProject) { alert('تعذّر تحميل المشروع'); window.location.href = 'projects.html'; return; }

    if (targetPage !== null) {
        let p = parseInt(targetPage);
        if (!isNaN(p) && p >= 0 && p < currentProject.pages.length) {
            currentPageIndex = p;
        }
    }

    injectToolbar('sticky-toolbar', true);
    injectToolbar('text-preview-toolbar', false);

    // Guarded - sidebar may be injected async, so check existence
    const titleEl = document.getElementById('sidebar-proj-title');
    if (titleEl) titleEl.textContent = currentProject.metadata?.title || '—';
    const metaEl = document.getElementById('sidebar-proj-meta');
    if (metaEl) metaEl.textContent = currentProject.metadata?.author || '';
    // Also try after a short delay in case sidebar injection is still pending
    setTimeout(() => {
        const t = document.getElementById('sidebar-proj-title');
        if (t) t.textContent = currentProject.metadata?.title || '—';
        const m = document.getElementById('sidebar-proj-meta');
        if (m) m.textContent = currentProject.metadata?.author || '';
    }, 300);

    setupToolbar();
    setupCropControls();
    setupFullPageView();
    setupCategoryPicker();
    setupResizablePanels();
    setupUndo();
    setupBlockFontZoom();
    setupKeyboardShortcuts();
    setupBlockContextMenu(); // NEW
    setupBlocksListDelegation(); // NEW: one-time delegated listener, replaces per-block listeners

    // ── STEP 4: NETWORK BADGE (PASTE HERE) ──
    const navDiv = document.querySelector('.page-nav');
    const netBadge = document.createElement('div');
    netBadge.id = 'network-status-badge';
    netBadge.style.cssText = 'font-size:12px; padding:4px 10px; border-radius:20px; font-weight:bold; display:none; align-items:center; gap:5px; margin-right: 10px;';
    navDiv.parentNode.insertBefore(netBadge, document.getElementById('save-page'));

    setInterval(async () => {
        if (!window.pywebview) return;
        const status = await window.pywebview.api.get_network_status();
        netBadge.style.display = 'none';
    }, 5000); 
    // ─────────────────────────────────────────

    updateReviewPanel();
}

document.addEventListener('DOMContentLoaded', () => {
    // التحقق الصارم من وجود الـ api والدالة تحديداً
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_projects === 'function') {
        initApp();
    } else {
        // الانتظار حتى يكتمل حقن جميع الدوال
        window.addEventListener('pywebviewready', initApp);
    }
});

// ===== TOOLBAR =====
function setupToolbar() {
    document.getElementById('prev-page').addEventListener('click', () => navigatePage(-1));
    document.getElementById('next-page').addEventListener('click', () => navigatePage(1));
    document.getElementById('undo-btn').addEventListener('click', performUndo);
    document.getElementById('redo-btn').addEventListener('click', performRedo);

    // 1. السطر السحري: منع فقدان التركيز عند النقر على أي زر في شريط الأدوات
    document.querySelectorAll('.formatting-toolbar-group button').forEach(btn => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
    });

    // 2. أزرار المحاذاة (Alignment)
    document.querySelectorAll('.formatting-toolbar-group button[data-align]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetIndex = activeEditingIndex !== -1 ? activeEditingIndex : selectedBlockIndex;
            if (targetIndex === -1) return;
            
            const el = currentProject?.pages[currentPageIndex]?.ocr_data[targetIndex];
            const contentEl = document.querySelector(`.text-block[data-index="${targetIndex}"] .block-content`);
            if (!el || !contentEl) return;
            if (typeof pushHistory === 'function') pushHistory(currentPageIndex);

            if (isTableLike(el.category) && el.table_structure) {
                let selectedCells = [];
                const sel = window.getSelection();
                
                // الطريقة الأسهل والأكثر ضماناً: اللف (Looping) على كل الخلايا وفحص ما إذا كانت مظللة!
                if (sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    const table = contentEl.querySelector('table');
                    if (table) {
                        table.querySelectorAll('td').forEach(td => {
                            // intersectsNode تعني: هل يمر التظليل فوق هذه الخلية؟
                            if (range.intersectsNode(td)) {
                                selectedCells.push(td);
                            }
                        });
                    }
                }

                if (selectedCells.length === 0) {
                    let activeTd = document.activeElement?.closest('td');
                    if (activeTd && contentEl.contains(activeTd)) selectedCells.push(activeTd);
                }

                if (selectedCells.length > 0) {
                    selectedCells.forEach(td => td.style.textAlign = btn.dataset.align);
                    document.querySelectorAll('#sticky-toolbar button[data-align]').forEach(b => b.classList.toggle('active', b.dataset.align === btn.dataset.align));
                    if (typeof syncElementFromContent === 'function') syncElementFromContent(el, contentEl);
                    if (typeof autoSaveBlock === 'function') autoSaveBlock();
                    return; 
                }
            }

            el.align = btn.dataset.align;
            contentEl.style.textAlign = el.align;
            document.querySelectorAll('#sticky-toolbar button[data-align]').forEach(b => b.classList.toggle('active', b.dataset.align === el.align));
            if (typeof autoSaveBlock === 'function') autoSaveBlock();
        });
    });

    // 3. أزرار الاتجاه (Direction)
    document.querySelectorAll('.formatting-toolbar-group button[data-dir]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetIndex = activeEditingIndex !== -1 ? activeEditingIndex : selectedBlockIndex;
            if (targetIndex === -1) return;
            
            const el = currentProject?.pages[currentPageIndex]?.ocr_data[targetIndex];
            const contentEl = document.querySelector(`.text-block[data-index="${targetIndex}"] .block-content`);
            if (!el || !contentEl) return;
            if (typeof pushHistory === 'function') pushHistory(currentPageIndex);

            if (isTableLike(el.category) && el.table_structure) {
                let selectedCells = [];
                const sel = window.getSelection();
                
                // اللف (Looping) على كل الخلايا لجلب أي خلية يمر عليها التظليل
                if (sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    const table = contentEl.querySelector('table');
                    if (table) {
                        table.querySelectorAll('td').forEach(td => {
                            if (range.intersectsNode(td)) {
                                selectedCells.push(td);
                            }
                        });
                    }
                }

                if (selectedCells.length === 0) {
                    let activeTd = document.activeElement?.closest('td');
                    if (activeTd && contentEl.contains(activeTd)) selectedCells.push(activeTd);
                }

                if (selectedCells.length > 0) {
                    selectedCells.forEach(td => td.dir = btn.dataset.dir);
                    document.querySelectorAll('#sticky-toolbar button[data-dir]').forEach(b => b.classList.toggle('active', b.dataset.dir === btn.dataset.dir));
                    if (typeof syncElementFromContent === 'function') syncElementFromContent(el, contentEl);
                    if (typeof autoSaveBlock === 'function') autoSaveBlock();
                    return;
                }
            }

            el.dir = btn.dataset.dir;
            contentEl.dir = el.dir;
            document.querySelectorAll('#sticky-toolbar button[data-dir]').forEach(b => b.classList.toggle('active', b.dataset.dir === el.dir));
            if (typeof autoSaveBlock === 'function') autoSaveBlock();
        });
    });

    document.getElementById('thumb-popup-canvas').addEventListener('click', (e) => {
        handleCanvasClick(e, document.getElementById('thumb-popup-canvas'));
    });

    document.getElementById('toolbar-thumb-wrapper').addEventListener('click', (e) => {
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
        if (typeof showNotif === 'function') showNotif('تم حفظ الصفحة بنجاح', 'success');
        setTimeout(() => btn.disabled = false, 500);
    });
}

// ===== BLOCK DISPLAY FONT-SIZE ZOOM =====
const BLOCK_FONT_MIN = 10, BLOCK_FONT_MAX = 32, BLOCK_FONT_STEP = 2, BLOCK_FONT_DEFAULT = 14;
let resetBlockFontSize = () => {}; 

function setupBlockFontZoom() {
    const stored = window.__appSettings?.blockFontSize;
    let size = (typeof stored === 'number' && stored >= BLOCK_FONT_MIN && stored <= BLOCK_FONT_MAX)
        ? stored : BLOCK_FONT_DEFAULT;
    applyBlockFontSize(size);

    document.getElementById('block-font-decrease').addEventListener('click', () => {
        size = Math.max(BLOCK_FONT_MIN, size - BLOCK_FONT_STEP);
        applyBlockFontSize(size);
    });
    document.getElementById('block-font-increase').addEventListener('click', () => {
        size = Math.min(BLOCK_FONT_MAX, size + BLOCK_FONT_STEP);
        applyBlockFontSize(size);
    });
    resetBlockFontSize = () => {
        size = BLOCK_FONT_DEFAULT;
        applyBlockFontSize(size);
    };

    function applyBlockFontSize(px) {
        document.documentElement.style.setProperty('--block-font-size', px + 'px');
        const pct = Math.round((px / BLOCK_FONT_DEFAULT) * 100);
        const label = document.getElementById('block-font-value');
        if (label) label.textContent = pct + '%';
        if (window.__appSettings) window.__appSettings.blockFontSize = px;
    }
}

function navigatePage(dir) {
    const next = currentPageIndex + dir;
    if (next < 0 || next >= currentProject.pages.length) return;
    currentPageIndex = next;
    selectBlock(-1);
    activeEditingIndex = -1;
    updateReviewPanel();
}



async function saveBlockSilently() {
    if (!currentProject) return;
    const page = currentProject.pages[currentPageIndex];
    try { await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, page.ocr_data || []); }
    catch (err) { console.error('Auto-save failed:', err); }
}

async function autoSaveBlock() {
    if (window.__appSettings?.autoSaveReview) {
        // الخطأ كان هنا: قمنا بتغييرها لتستدعي العضلة الحقيقية
        await saveBlockSilently(); 
    }
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

    const imgPath = `file:///${window.__appDataPath}/projects/${currentProject.id}/images/${page.image_path}`;
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

        // حساب معدل التكبير بناءً على حجم المستند الأصلي بدلاً من الـ 200 DPI الثابتة
        // (تم إضافة fallback في حال كانت الأبعاد القديمة غير متوفرة)
        const nativeW = page.native_width || (img.naturalWidth / 200 * 72);
        const nativeH = page.native_height || (img.naturalHeight / 200 * 72);
        scaleRatioX = img.naturalWidth / nativeW;
        scaleRatioY = img.naturalHeight / nativeH;

        renderBboxes(page.ocr_data || [], selectedBlockIndex);
        renderThumbCanvas('thumb-canvas', 'thumb-image', page.ocr_data || [], selectedBlockIndex);
        renderThumbCanvas('thumb-popup-canvas', 'thumb-popup-image', page.ocr_data || [], selectedBlockIndex);
    };

    renderBlocksList(page.ocr_data || []);
    showCroppedView(null);
}

// Canvas bbox rendering (drawBoxes, renderBboxes, renderThumbCanvas) and the
// bbox-canvas click handler now live in canvas-rendering.js.

// ===== BLOCK SELECTION =====
function updateBlockSelectionUI() {
    document.querySelectorAll('.text-block').forEach(el => {
        const idx = parseInt(el.dataset.index);
        if (idx === selectedBlockIndex || multiSelectedBlocks.has(idx)) {
            el.classList.add('active-block');
        } else {
            el.classList.remove('active-block');
        }
    });
    
    const ocrData = currentProject.pages[currentPageIndex].ocr_data || [];
    renderBboxes(ocrData, selectedBlockIndex);
    renderThumbCanvas('thumb-canvas','thumb-image', ocrData, selectedBlockIndex);
    renderThumbCanvas('thumb-popup-canvas','thumb-popup-image', ocrData, selectedBlockIndex);

    if (selectedBlockIndex !== -1 && ocrData[selectedBlockIndex]) {
        showCroppedView(ocrData[selectedBlockIndex].bbox);
    } else {
        showCroppedView(null);
    }
}

function selectBlock(index) {
    if (!currentProject) return;
    selectedBlockIndex = index;
    multiSelectedBlocks.clear();
    if (index !== -1) multiSelectedBlocks.add(index);
    
    updateBlockSelectionUI();
    
    if (index !== -1) {
        const el = document.querySelector(`.text-block[data-index="${index}"]`);
        if (el) el.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
}

// ===== CROP VIEWER =====
let cropPanX = 0, cropPanY = 0;
let isDraggingCrop = false;
let cropDragStartX = 0, cropDragStartY = 0;

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
    cropPanX = 0; // 👉 NEW: Reset panning on new selection
    cropPanY = 0; // 👉 NEW: Reset panning on new selection
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

// Re-centers the crop viewer on a tracked word/line/cell bbox WITHOUT
// resetting cropZoom — unlike showCroppedView(), which is for the initial
// "block selected" case and intentionally resets to a fresh 1.0 zoom.
// Tracking should feel like the viewport following the caret at whatever
// zoom level the person already set, not jumping back to fit-block every
// keystroke.
function panCropViewTo(bbox) {
    const cropImg = document.getElementById('crop-image');
    if (!cropImg.dataset.naturalW) return; // crop viewer not initialized yet
    const [x1, y1, x2, y2] = bbox;
    cropImg.dataset.boxX = x1 * scaleRatioX;
    cropImg.dataset.boxY = y1 * scaleRatioY;
    cropImg.dataset.boxW = (x2 - x1) * scaleRatioX;
    cropImg.dataset.boxH = (y2 - y1) * scaleRatioY;
    applyCropZoom();
}

function setupCropControls() {
    document.getElementById('crop-zoom-in').addEventListener('click', () => { cropZoom=Math.min(CROP_MAX,cropZoom+0.25); applyCropZoom(); });
    document.getElementById('crop-zoom-out').addEventListener('click', () => { cropZoom=Math.max(CROP_MIN,cropZoom-0.25); applyCropZoom(); });
    document.getElementById('crop-zoom-reset').addEventListener('click', () => { cropZoom=1.0; applyCropZoom(); });
}


// ===== FULL PAGE VIEW =====
// ===== FULL PAGE VIEW =====
function setupFullPageView() {
    document.getElementById('close-fullpage-btn').addEventListener('click', closeFullPageView);
    document.getElementById('fullpage-canvas').addEventListener('click', (e) => {
        // نكتفي باستدعاء الدالة الموحدة التي أصبحت ذكية الآن!
        handleCanvasClick(e, document.getElementById('fullpage-canvas'));
        const ocrData = currentProject?.pages[currentPageIndex]?.ocr_data || [];
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
// ===== BLOCKS LIST =====

// Reads an edited block's DOM content back into its OCR element.
// Handles both table blocks (via TableModel) and plain text blocks.
// Returns true if the element's text actually changed.
function syncElementFromContent(el, contentEl) {
    if (isTableLike(el.category) && el.table_structure) {
        const table = contentEl.querySelector('table');
        if (!table) return false;
        const model = window.TableModel.toModel(table);
        const oldCells = el.table_structure.cells;
        el.table_structure.rows = model.numRows;
        el.table_structure.cols = model.numCols;
        
        el.table_structure.cells = model.cells.map(c => {
            const oldMatch = oldCells.find(oc => oc.row === c.r && oc.col === c.c) || { bbox: [0, 0, 0, 0] };
            return { 
                row: c.r, 
                col: c.c, 
                row_span: c.rowSpan, 
                col_span: c.colSpan, 
                bbox: oldMatch.bbox, 
                text: c.dom.innerHTML,
                align: c.dom.style.textAlign || '',
                dir: c.dom.dir || '',
                // Save border, background color, and vertical alignment
                border: c.dom.style.border || '',
                bg_color: c.dom.style.backgroundColor || '',
                valign: c.dom.style.verticalAlign || ''
            };
        });

        // Compute fingerprint so background/border changes trigger auto-save even if text didn't change
        const syncFingerprint = JSON.stringify(el.table_structure.cells);
        const changed = el._lastTableFingerprint !== syncFingerprint;
        el._lastTableFingerprint = syncFingerprint;

        el.text = el.table_structure.cells.map(c => c.text).join('<br>');
        return changed;
    }
    const newHtml = contentEl.innerHTML;
    const changed = newHtml !== el.text;
    el.text = newHtml;
    return changed;
}

// Cheap post-edit refresh: updates the reviewed indicator on one block plus
// the bbox/thumbnail canvases, WITHOUT rebuilding the entire blocks list.
// Use this instead of updateReviewPanel() after in-place text edits, since
// the edited block's DOM is already correct and no other block changed.
function refreshIndicatorsFor(wrapperEl, element) {
    if (wrapperEl) wrapperEl.classList.toggle('block-reviewed', !!element.reviewed);
    const page = currentProject?.pages[currentPageIndex];
    if (!page) return;
    renderBboxes(page.ocr_data || [], selectedBlockIndex);
    renderThumbCanvas('thumb-canvas', 'thumb-image', page.ocr_data || [], selectedBlockIndex);
    renderThumbCanvas('thumb-popup-canvas', 'thumb-popup-image', page.ocr_data || [], selectedBlockIndex);
}

// ===== WORD/LINE TRACKING =====
// 'word' (default) | 'line' | 'off'. Exposed on window so a settings toggle
// can flip it later without needing to know about this file's internals.

// ===== WORD/LINE TRACKING =====

// 1. تحميل الإعدادات من الذاكرة المحلية أو استخدام الإعدادات الافتراضية
const defaultTrackingConfig = { cells: true, words: false, lines: false, block: false };
const savedTrackingConfig = localStorage.getItem('trackingConfig');
window.__trackingConfig = savedTrackingConfig ? JSON.parse(savedTrackingConfig) : defaultTrackingConfig;

document.getElementById('track-settings-btn')?.addEventListener('click', () => {
    document.getElementById('track-settings-menu').classList.toggle('hidden');
});

// 2. تطبيق الإعدادات المحفوظة على الواجهة ومراقبة أي تغييرات لحفظها فوراً
['cells', 'words', 'lines', 'block'].forEach(key => {
    const checkbox = document.getElementById('cfg-track-' + key);
    if (checkbox) {
        // تطبيق الحالة المحفوظة على زر الاختيار (Checkbox)
        checkbox.checked = window.__trackingConfig[key];
        
        checkbox.addEventListener('change', (e) => {
            // تحديث الإعدادات في الذاكرة الحية
            window.__trackingConfig[key] = e.target.checked;
            
            // حفظ الإعدادات فوراً في الذاكرة المحلية (localStorage)
            localStorage.setItem('trackingConfig', JSON.stringify(window.__trackingConfig));
            
            // تطبيق التتبع مباشرة إذا كان المستخدم يقف على كتلة نصية حالياً
            if (activeEditingIndex !== -1 && currentProject?.pages[currentPageIndex]) {
                const contentEl = document.querySelector(`.text-block[data-index="${activeEditingIndex}"] .block-content`);
                const element = currentProject.pages[currentPageIndex].ocr_data[activeEditingIndex];
                if (contentEl && element) updateTrackingHighlight(contentEl, element);
            }
        });
    }
});

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function updateTrackingHighlight(contentEl, element) {
    if (!window.TextTrackingEngine) return;
    
    // THIS is the line that was failing. It now correctly passes __trackingConfig
    const highlight = window.TextTrackingEngine.getHighlightBBox(contentEl, element, window.__trackingConfig);
    
    setTrackingHighlight(highlight);
    if (highlight?.bbox) panCropViewTo(highlight.bbox);
}
const debouncedTrackingUpdate = debounce(updateTrackingHighlight, 120);

function renderBlocksList(ocrData) {
    const container = document.getElementById('blocks-list');
    container.innerHTML = '';

    ocrData.forEach((element, index) => {
        if (element.category === 'Picture') return;

        const wrapper = document.createElement('div');
        const isActive = (index === selectedBlockIndex || multiSelectedBlocks.has(index));
        wrapper.className = 'text-block' + (element.reviewed ? ' block-reviewed' : '') + (isActive ? ' active-block' : '');
        wrapper.dataset.index = index;
        wrapper.draggable = false;

        const color = getCategoryColors()[element.category||'Text'] || '#3498db';

        const handle = document.createElement('span');
        handle.className = 'block-drag-handle';
        handle.title = 'اسحب لإعادة الترتيب';
        handle.innerHTML = '⋮⋮';
        handle.dataset.handle = '1';

        const header = document.createElement('div');
        header.className = 'block-header';

        const label = document.createElement('span');
        label.className = 'block-label';
        label.style.color = color;
        label.textContent = getCategoryNameAR(element.category || 'Text');
        label.title = 'انقر لتغيير النوع';

        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'block-review-btn' + (element.reviewed ? ' reviewed' : '');
        reviewBtn.textContent = element.reviewed ? '✔ تمت' : 'مراجَع';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'block-delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.title = 'حذف (يمكن التراجع)';

        header.appendChild(handle);
        header.appendChild(label);
        header.appendChild(reviewBtn);
        header.appendChild(deleteBtn);

        const content = document.createElement('div');
        content.className = 'block-content';
        content.contentEditable = 'true';
        content.dir = element.dir || 'rtl';
        content.style.textAlign = element.align || '';

        // Apply Category Default Formatting (bold, italic, underline, font size, family, color, bg, dir, align)
        const catFmt = currentProject?.metadata?.category_formatting?.[element.category || 'Text'];
        if (catFmt) {
            if (catFmt.dir) content.dir = catFmt.dir;
            if (catFmt.align) content.style.textAlign = catFmt.align;
            if (catFmt.fontFamily) content.style.fontFamily = catFmt.fontFamily;
            if (catFmt.fontSize) content.style.fontSize = catFmt.fontSize;
            if (catFmt.lineSpacing) content.style.setProperty('--block-line-height', catFmt.lineSpacing);
            if (catFmt.spaceBefore) content.style.setProperty('--block-space-before', catFmt.spaceBefore);
            if (catFmt.spaceAfter) content.style.setProperty('--block-space-after', catFmt.spaceAfter);
            if (catFmt.color) content.style.color = catFmt.color;
            if (catFmt.bgColor) content.style.backgroundColor = catFmt.bgColor;
            if (catFmt.bold) content.style.fontWeight = 'bold';
            if (catFmt.italic) content.style.fontStyle = 'italic';
            if (catFmt.underline) content.style.textDecoration = 'underline';
        }

        // 👉 1. RENDER TABLE OR TEXT (Cleaned up - no duplicates)
        // 👉 NEW: RENDER HTML TABLE IF APPLICABLE
        if (isTableLike(element.category) && element.table_structure) {
            const table = document.createElement('table');
            table.className = 'review-table layout-table-overlay'; 
            table.dir = 'ltr';
            table.style.width = '100%'; 
            table.style.borderCollapse = 'collapse';
            table.style.marginTop = '8px';
            table.style.background = 'white';
            
            const model = { numRows: element.table_structure.rows, numCols: element.table_structure.cols, cells: [] };
            element.table_structure.cells.forEach((c, cIdx) => {
                const td = document.createElement('td');
                td.dataset.cidx = cIdx;
                td.innerHTML = c.text || '<br>';
                
                // Apply saved styles or fall back to defaults
                td.style.border = c.border || '2px solid #d35400';
                if (c.bg_color) td.style.backgroundColor = c.bg_color;
                if (c.valign) td.style.verticalAlign = c.valign;
                td.style.padding = '8px';
                
                td.dir = c.dir || element.dir || 'rtl';
                td.style.textAlign = c.align || element.align || (td.dir === 'rtl' ? 'right' : 'left');

                model.cells.push({ dom: td, r: c.row, c: c.col, rowSpan: c.row_span, colSpan: c.col_span });
            });

            window.TableModel.fromModel(table, model);
            content.appendChild(table);
        } else {
            const rawText = element.text || '';
            try { content.innerHTML = window.marked ? window.marked.parse(rawText) : rawText; } 
            catch { content.innerHTML = rawText; }
        }

        // 👉 2. FOCUS & BLUR EVENTS (Cleaned up - no duplicates)
        let preEditSnapshot = null;
        content.addEventListener('focus', () => {
            activeEditingIndex = index;
            selectBlock(index); 
            document.getElementById('sticky-toolbar').classList.remove('disabled');
            
            // Re-added the toolbar toggle logic that was in your old code
            document.querySelectorAll('#sticky-toolbar button[data-align]').forEach(b =>
                b.classList.toggle('active', b.dataset.align === (element.align || '')));
            document.querySelectorAll('#sticky-toolbar button[data-dir]').forEach(b =>
                b.classList.toggle('active', b.dataset.dir === (element.dir || 'rtl')));
                
            preEditSnapshot = JSON.parse(JSON.stringify(currentProject.pages[currentPageIndex].ocr_data));
            updateTrackingHighlight(content, element); // show tracking immediately on focus, no debounce
        });

        // Word/line tracking: caret can move via typing (input), arrow keys
        // (keyup), or a mouse click inside the already-focused block (click).
        // Debounced since these can fire rapidly while typing.
        content.addEventListener('input', () => debouncedTrackingUpdate(content, element));
        content.addEventListener('keyup', (e) => {
            if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') {
                debouncedTrackingUpdate(content, element);
            }
        });
        content.addEventListener('click', () => debouncedTrackingUpdate(content, element));
        
        content.addEventListener('blur', async () => {
            setTrackingHighlight(null);
            let changed = syncElementFromContent(element, content);

            if (!element.reviewed && window.__appSettings?.autoMarkReviewed !== false) {
                element.reviewed = true;
                changed = true; 
            }

            if (changed) {
                pushHistory(currentPageIndex, preEditSnapshot);
                await autoSaveBlock();
                reviewBtn.textContent = element.reviewed ? '✔ تمت' : 'مراجَع';
                reviewBtn.classList.toggle('reviewed', element.reviewed);
                refreshIndicatorsFor(wrapper, element);
            }
        }, true);

        wrapper.appendChild(header);
        wrapper.appendChild(content);

        setupBlockDrag(wrapper, index);
        container.appendChild(wrapper);
    });
}

// Single delegated listener for the whole blocks list — set up once, not per block/render.
// Handles: review toggle, delete, category label, and click-to-select / multi-select.
function setupBlocksListDelegation() {
    const container = document.getElementById('blocks-list');
    if (!container) return;

    container.addEventListener('click', async (e) => {
        const wrapper = e.target.closest('.text-block');
        if (!wrapper) return;
        const index = parseInt(wrapper.dataset.index);
        const page = currentProject?.pages[currentPageIndex];
        const element = page?.ocr_data[index];
        if (!element) return;

        const reviewBtn = e.target.closest('.block-review-btn');
        if (reviewBtn) {
            e.stopPropagation();
            pushHistory(currentPageIndex);
            element.reviewed = !element.reviewed;
            reviewBtn.textContent = element.reviewed ? '✔ تمت' : 'مراجَع';
            reviewBtn.classList.toggle('reviewed', element.reviewed);
            refreshIndicatorsFor(wrapper, element);
            await autoSaveBlock();
            return;
        }

        if (e.target.closest('.block-delete-btn')) {
            e.stopPropagation();
            deleteBlock(index);
            return;
        }

        if (e.target.closest('.block-label')) {
            e.stopPropagation();
            openCategoryPicker(e, index);
            return;
        }

        // Ignore clicks on the drag handle or inside the editable content —
        // those have their own handlers (setupBlockDrag / focus-blur above).
        if (e.target.closest('[data-handle]') || e.target.closest('.block-content')) return;

        if (e.ctrlKey || e.metaKey) {
            if (multiSelectedBlocks.has(index)) {
                multiSelectedBlocks.delete(index);
                if (selectedBlockIndex === index) {
                    selectedBlockIndex = multiSelectedBlocks.size > 0 ? Array.from(multiSelectedBlocks)[0] : -1;
                }
            } else {
                multiSelectedBlocks.add(index);
                selectedBlockIndex = index;
            }
            updateBlockSelectionUI();
        } else if (e.shiftKey && selectedBlockIndex !== -1) {
            const start = Math.min(selectedBlockIndex, index);
            const end = Math.max(selectedBlockIndex, index);
            multiSelectedBlocks.clear();
            for (let i = start; i <= end; i++) multiSelectedBlocks.add(i);
            selectedBlockIndex = index;
            updateBlockSelectionUI();
        } else {
            selectBlock(index);
        }
    });
}

// ===== DRAG TO REORDER =====
let dragSrcIndex = null;

function setupBlockDrag(wrapper, index) {
    const handle = wrapper.querySelector('.block-drag-handle');

    handle.addEventListener('mousedown', () => { wrapper.setAttribute('draggable', 'true'); });
    handle.addEventListener('mouseup', () => { wrapper.setAttribute('draggable', 'false'); });

    wrapper.addEventListener('dragstart', (e) => {
        dragSrcIndex = index;
        wrapper.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    
    wrapper.addEventListener('dragend', () => { 
        wrapper.classList.remove('dragging'); 
        wrapper.setAttribute('draggable', 'false'); 
    });
    
    wrapper.addEventListener('dragover', (e) => { e.preventDefault(); wrapper.classList.add('drag-over'); });
    wrapper.addEventListener('dragleave', () => { wrapper.classList.remove('drag-over'); });
    
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('drag-over');
        wrapper.setAttribute('draggable', 'false');
        if (dragSrcIndex === null || dragSrcIndex === index) return;
        reorderBlocks(dragSrcIndex, index);
        dragSrcIndex = null;
    });
}

function reorderBlocks(fromIndex, toIndex) {
    const page = currentProject.pages[currentPageIndex];
    pushHistory(currentPageIndex);
    const arr = page.ocr_data;
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    selectBlock(toIndex);
    updateReviewPanel();
}

// ===== SMART DELETE =====
function deleteBlock(index) {
    const page = currentProject.pages[currentPageIndex];
    pushHistory(currentPageIndex);
    
    if (index !== undefined && index !== -1) {
        page.ocr_data.splice(index, 1);
    } else if (multiSelectedBlocks.size > 0) {
        // Delete all selected blocks, starting from highest index so array doesn't shift
        const indices = Array.from(multiSelectedBlocks).sort((a,b) => b - a);
        indices.forEach(idx => page.ocr_data.splice(idx, 1));
    } else { return; }
    
    selectBlock(-1);
    updateReviewPanel();
    autoSaveBlock();
}

// pushHistory, applyHistoryEntry, performUndo/performRedo, updateUndoRedoButtons,
// and setupUndo now live in undo-redo.js.

function moveFocusAndReview(dir) {
    let currentIndex = activeEditingIndex !== -1 ? activeEditingIndex : selectedBlockIndex;
    
    // 1. Auto-Review Current Block Before Leaving
    if (currentIndex !== -1 && currentProject && currentProject.pages[currentPageIndex]) {
        const page = currentProject.pages[currentPageIndex];
        const currentData = page.ocr_data[currentIndex];

        if (currentData && !currentData.reviewed && window.__appSettings?.autoMarkReviewed !== false) {
            currentData.reviewed = true;
            autoSaveBlock(); 
        }
    }

    // 2. Intra-Table Navigation (Move cell-by-cell inside a table)
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === 'TD' && activeEl.closest('.review-table')) {
        const table = activeEl.closest('.review-table');
        const tds = Array.from(table.querySelectorAll('td'));
        const tdIndex = tds.indexOf(activeEl);
        const nextTdIndex = tdIndex + dir;
        
        if (nextTdIndex >= 0 && nextTdIndex < tds.length) {
            tds[nextTdIndex].focus();
            return; // Stay inside table block!
        }
    }

    // 3. Block-to-Block Navigation
    if (!currentProject || !currentProject.pages[currentPageIndex]) return;
    const page = currentProject.pages[currentPageIndex];
    
    let nextIdx = currentIndex === -1 ? (dir === 1 ? 0 : page.ocr_data.length - 1) : currentIndex + dir;

    // Skip pictures
    while (nextIdx >= 0 && nextIdx < page.ocr_data.length) {
        if (page.ocr_data[nextIdx].category !== 'Picture') break;
        nextIdx += dir;
    }

    if (nextIdx >= 0 && nextIdx < page.ocr_data.length) {
        selectBlock(nextIdx);
        activeEditingIndex = nextIdx;
        
        // Re-render to apply the green reviewed styles
        updateReviewPanel();

        // Slight delay to allow DOM to render before focusing
        setTimeout(() => {
            const nextWrapper = document.querySelector(`.text-block[data-index="${nextIdx}"]`);
            if (nextWrapper) {
                nextWrapper.scrollIntoView({behavior: 'smooth', block: 'center'});
                const content = nextWrapper.querySelector('.block-content');
                if (content) {
                    const firstTd = dir === 1 
                        ? content.querySelector('td') 
                        : Array.from(content.querySelectorAll('td')).pop(); 
                    
                    if (firstTd) {
                        firstTd.focus();
                    } else {
                        content.focus();
                    }
                }
            }
        }, 50); 
    }
}

// COMMAND_HANDLERS, NATIVE_CONTENTEDITABLE_KEYS, isTypingInPlainFormField,
// and setupKeyboardShortcuts() now live in keyboard-shortcuts.js.

// ===== CATEGORY PICKER =====
// ===== CATEGORY PICKER =====
async function handleTableCategoryChange(blockIndex, newCat, oldCat) {
    const page = currentProject.pages[currentPageIndex];
    const block = page.ocr_data[blockIndex];

    const remember = localStorage.getItem('autoTableParse_remember') === 'true';
    const savedAction = localStorage.getItem('autoTableParse_action');

    const executeAutoParse = async () => {
        try {
            if (window.pywebview?.api?.auto_layout_table_block) {
                await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, page.ocr_data);
                const res = await window.pywebview.api.auto_layout_table_block(currentProject.id, currentPageIndex, blockIndex, "smear");
                const updatedProj = await window.pywebview.api.load_project(currentProject.id);
                if (updatedProj && updatedProj.pages[currentPageIndex]) {
                    currentProject = updatedProj;
                }
            }
        } catch (err) {
            console.error("Auto table layout failed:", err);
        } finally {
            updateReviewPanel();
            autoSaveBlock();
        }
    };

    if (remember) {
        if (savedAction === 'yes') {
            await executeAutoParse();
        } else {
            updateReviewPanel();
            autoSaveBlock();
        }
        return;
    }

    const catNameAR = getCategoryNameAR(newCat);
    const modalContent = `
        <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
            هل ترغب في الكشف التلقائي عن تخطيط الهيكل (الصفوف والأعمدة) للكتلة المحددة كـ <strong>"${catNameAR}"</strong> باستخدام التعرف الضوئي؟
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; cursor: pointer; user-select: none;">
            <input type="checkbox" id="chk-remember-table-parse-review" style="accent-color: #2563eb;">
            <span>تذكر اختياري وعدم السؤال مرة أخرى</span>
        </label>
    `;

    if (window.AestheticDialog?.show) {
        window.AestheticDialog.show('الكشف التلقائي عن التخطيط 📊', modalContent, async (overlay) => {
            const chk = overlay.querySelector('#chk-remember-table-parse-review');
            if (chk && chk.checked) {
                localStorage.setItem('autoTableParse_remember', 'true');
                localStorage.setItem('autoTableParse_action', 'yes');
            }
            await executeAutoParse();
        });

        setTimeout(() => {
            const overlay = document.querySelector('.aes-overlay');
            if (overlay) {
                const cancelBtn = overlay.querySelector('.aes-btn-cancel');
                if (cancelBtn) {
                    cancelBtn.onclick = () => {
                        const chk = overlay.querySelector('#chk-remember-table-parse-review');
                        if (chk && chk.checked) {
                            localStorage.setItem('autoTableParse_remember', 'true');
                            localStorage.setItem('autoTableParse_action', 'no');
                        }
                        overlay.remove();
                        updateReviewPanel();
                        autoSaveBlock();
                    };
                }
            }
        }, 10);
    } else {
        updateReviewPanel();
        autoSaveBlock();
    }
}

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

    getAllCategories().forEach(cat => {
        const item = document.createElement('div');
        item.className = 'category-picker-item' + (cat === current ? ' active' : '');
        const dot = document.createElement('span');
        dot.className = 'category-color-dot';
        dot.style.background = getCategoryColors()[cat];
        item.appendChild(dot);
        item.appendChild(document.createTextNode(getCategoryNameAR(cat)));
        item.addEventListener('click', async () => {
            pushHistory(currentPageIndex);
            const oldCat = page.ocr_data[blockIndex].category;
            page.ocr_data[blockIndex].category = cat;
            picker.classList.add('hidden');
            if (isTableLike(cat)) {
                await handleTableCategoryChange(blockIndex, cat, oldCat);
            } else {
                updateReviewPanel();
                autoSaveBlock();
            }
        });
        list.appendChild(item);
    });

    // Remove 'hidden' FIRST so we can accurately measure the menu's height
    picker.classList.remove('hidden');

    const rect = e.target.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();

    // Check if it goes off the bottom of the screen
    if (rect.bottom + pickerRect.height > window.innerHeight) {
        // Open UP (above the label)
        picker.style.top = (rect.top - pickerRect.height - 4) + 'px';
    } else {
        // Open DOWN (below the label)
        picker.style.top = (rect.bottom + 4) + 'px';
    }
    
    picker.style.right = (window.innerWidth - rect.right) + 'px';
} // <-- Correctly ends here! No floating code after this.

// ===== RESIZABLE PANELS & LAYOUT VIEW SWITCH =====
function setupResizablePanels() {
    setupResize('crop-resize-handle', 'crop-section', 80, 500);
    setupResize('blocks-resize-handle', 'blocks-list-wrapper', 80, 800);
    setupLayoutViewToggle();
}

function updateSwitchBtnPosition() {
    const btn = document.getElementById('toggle-layout-view-btn');
    const container = document.getElementById('editor-panels-container');
    const cropSection = document.getElementById('crop-section');
    if (!btn || !container || !cropSection) return;

    const isSideBySide = container.classList.contains('side-by-side-mode');

    if (isSideBySide) {
        // In Side-by-Side Mode (Crop viewer on left, Blocks list on right in RTL):
        // Position button at the vertical middle of container and at boundary of cropSection
        const cropW = cropSection.offsetWidth;
        btn.style.top = '50%';
        btn.style.left = cropW + 'px';
        btn.style.transform = 'translate(-50%, -50%)';
    } else {
        // In Normal Mode (Crop viewer at top, Blocks list at bottom):
        // Position button at horizontal middle of container and at bottom handle of cropSection
        const cropH = cropSection.offsetHeight;
        btn.style.top = cropH + 'px';
        btn.style.left = '50%';
        btn.style.transform = 'translate(-50%, -50%)';
    }
}

function setupLayoutViewToggle() {
    const btn = document.getElementById('toggle-layout-view-btn');
    const container = document.getElementById('editor-panels-container');
    const cropSection = document.getElementById('crop-section');
    if (!btn || !container) return;

    // Load persisted view preference if set
    if (window.__appSettings?.reviewSideBySideMode) {
        container.classList.add('side-by-side-mode');
        if (cropSection) cropSection.style.height = '';
    }

    updateSwitchBtnPosition();
    window.addEventListener('resize', updateSwitchBtnPosition);

    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop handle drag event
        e.preventDefault();

        const isSideBySide = container.classList.toggle('side-by-side-mode');

        // Reset inline height/width so styles calculate cleanly
        if (cropSection) {
            cropSection.style.height = '';
            cropSection.style.width = '';
        }

        updateSwitchBtnPosition();

        // Persist preference
        if (window.__appSettings) {
            window.__appSettings.reviewSideBySideMode = isSideBySide;
            if (typeof saveAppSettings === 'function') saveAppSettings();
        }

        // Re-fit crop view
        if (typeof applyCropZoom === 'function') {
            setTimeout(() => {
                updateSwitchBtnPosition();
                applyCropZoom();
            }, 50);
        }
    });
}

function setupResize(handleId, panelId, minVal, maxVal) {
    const handle = document.getElementById(handleId);
    const panel = document.getElementById(panelId);
    if (!handle || !panel) return;
    
    let startY, startX, startH, startW;
    
    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('#toggle-layout-view-btn')) return; // Do not trigger drag when clicking switch button

        startY = e.clientY;
        startX = e.clientX;
        startH = panel.offsetHeight;
        startW = panel.offsetWidth;

        document.addEventListener('mousemove', onMove); 
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
    });
    
    function onMove(e) {
        const container = document.getElementById('editor-panels-container');
        const isSideBySide = container && container.classList.contains('side-by-side-mode');

        if (isSideBySide && panelId === 'crop-section') {
            // Horizontal resizing in side-by-side mode (crop section on left)
            const deltaX = e.clientX - startX; 
            const maxW = Math.round(container.offsetWidth * 0.8);
            const newW = Math.max(120, Math.min(maxW, startW + deltaX));
            panel.style.width = newW + 'px';
        } else {
            // Vertical resizing in normal mode
            const deltaY = e.clientY - startY; 
            const newH = Math.max(minVal, Math.min(maxVal, startH + deltaY));
            panel.style.height = newH + 'px';
        }

        updateSwitchBtnPosition();

        if (panelId === 'crop-section' && typeof applyCropZoom === 'function') {
            applyCropZoom();
        }
    }
    
    function onUp() {
        document.removeEventListener('mousemove', onMove); 
        document.removeEventListener('mouseup', onUp);
    }
}

// Context menu (right-click merge/split UI) + split-block modal + merge/split
// engine now live in block-context-menu.js (see that file's header comment).
// BLOCK_CONTEXT_MODALS_HTML, setupBlockContextMenu(), and mergeSelectedBlocks()
// are defined there and used below / in initApp().

// ══════════════════════════════════════════════════════════════════════
// FULL TEXT PREVIEW / NOTIFS / SETTINGS
// ══════════════════════════════════════════════════════════════════════
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

(function setupTextPreview() {
    const rawToggle = document.getElementById('text-preview-raw-toggle');
    function buildPreviewHTML() {
        const logicalStart = currentProject?.metadata?.logical_start || 1;
        const raw = rawToggle.checked;
        return currentProject.pages.map((page, i) => {
            const blocksHtml = (page.ocr_data || []).map((el, bIndex) => {
                if (el.category === 'Picture') return '';
                
                // RENDER FULLY FUNCTIONAL TABLES IN PREVIEW
                if (isTableLike(el.category) && el.table_structure) {
                    let grid = Array.from({length: el.table_structure.rows || 1}, () => []);
                    el.table_structure.cells.forEach(c => {
                        if(grid[c.row]) grid[c.row][c.col] = c;
                    });
                    
                    let tableHtml = `<table class="review-table layout-table-overlay" dir="ltr" style="width:100%; border-collapse:collapse; margin-top:8px; background:white;"><tbody>`;
                    for(let r=0; r<(el.table_structure.rows || 1); r++) {
                        tableHtml += `<tr>`;
                        for(let c=0; c<(el.table_structure.cols || 1); c++) {
                            let cell = grid[r] && grid[r][c];
                            if (cell) {
                                let rs = cell.row_span > 1 ? ` rowspan="${cell.row_span}"` : '';
                                let cs = cell.col_span > 1 ? ` colspan="${cell.col_span}"` : '';
                                let align = cell.align || el.align || ( (cell.dir || el.dir || 'rtl') === 'rtl' ? 'right' : 'left' );
                                let dir = cell.dir || el.dir || 'rtl';
                                let border = cell.border || '2px solid #d35400';
                                let bg = cell.bg_color ? ` background-color:${cell.bg_color};` : '';
                                let valign = cell.valign ? ` vertical-align:${cell.valign};` : '';
                                tableHtml += `<td${rs}${cs} style="border:${border}; padding:8px; text-align:${align};${bg}${valign}" dir="${dir}">${cell.text || '<br>'}</td>`;
                            }
                        }
                        tableHtml += `</tr>`;
                    }
                    tableHtml += `</tbody></table>`;
                    return `<div class="preview-block-chunk" data-block-index="${bIndex}" style="margin-bottom: 6px;">${tableHtml}</div>`;
                }

                // Normal Text Rendering
                const t = el.text || '';
                let innerHTML = '';
                if (raw) innerHTML = `<p>${escapeHtml(t)}</p>`;
                else { try { innerHTML = window.marked ? window.marked.parse(t) : `<p>${escapeHtml(t)}</p>`; } catch { innerHTML = `<p>${escapeHtml(t)}</p>`; } }
                return `<div class="preview-block-chunk" data-block-index="${bIndex}" style="margin-bottom: 6px;">${innerHTML}</div>`;
            }).join('');
            return `<div class="preview-page" data-page-index="${i}">` +
                   `<div class="preview-page-sep" contenteditable="false" style="color:#999;font-size:13px;margin:18px 0 8px;user-select:none;">── صفحة ${i + logicalStart} ──</div>` +
                   blocksHtml + `</div>`;
        }).join('');
    }

    function renderPreview() { document.getElementById('text-preview-body').innerHTML = buildPreviewHTML(); }
    document.getElementById('text-preview-btn').addEventListener('click', () => { renderPreview(); document.getElementById('text-preview-overlay').classList.remove('hidden'); });
    rawToggle.addEventListener('change', () => { if (!document.getElementById('text-preview-overlay').classList.contains('hidden')) renderPreview(); });
    document.getElementById('text-preview-close').addEventListener('click', () => { document.getElementById('text-preview-overlay').classList.add('hidden'); });

    document.getElementById('text-preview-save').addEventListener('click', () => {
        const isRaw = rawToggle.checked;
        const touchedPages = new Set();
        document.querySelectorAll('#text-preview-body .preview-page').forEach(pageDiv => {
            const pIndex = parseInt(pageDiv.dataset.pageIndex);
            if (!currentProject.pages[pIndex]) return;
            const page = currentProject.pages[pIndex];
            
            pageDiv.querySelectorAll('.preview-block-chunk').forEach(chunkDiv => {
                const bIndex = parseInt(chunkDiv.dataset.blockIndex);
                const target = page.ocr_data[bIndex];
                if (!target) return;

                // HANDLE TABLE SAVING VS TEXT SAVING
                if (target.category === 'Table' && target.table_structure) {
                    const changed = syncElementFromContent(target, chunkDiv);
                    if (changed) {
                        if (!touchedPages.has(pIndex)) { pushHistory(pIndex); touchedPages.add(pIndex); }
                        if (window.__appSettings?.autoMarkReviewed !== false) target.reviewed = true;
                    }
                } else {
                    const newText = isRaw ? chunkDiv.textContent.trim() : chunkDiv.innerHTML.trim();
                    if (newText !== target.text) {
                        if (!touchedPages.has(pIndex)) { pushHistory(pIndex); touchedPages.add(pIndex); }
                        target.text = newText;
                        if (window.__appSettings?.autoMarkReviewed !== false) target.reviewed = true;
                    }
                }
            });
        });

        const touchedArr = Array.from(touchedPages);
        if (touchedArr.length > 0) {
            Promise.all(touchedArr.map(i => window.pywebview.api.update_page_ocr(currentProject.id, i, currentProject.pages[i].ocr_data || [])))
            .then(() => { showNotif('تم حفظ التعديلات في الكتل الخاصة بها ✓', 'success'); updateReviewPanel(); })
            .catch(() => showNotif('حدث خطأ أثناء الحفظ', 'error'));
        } else { showNotif('لم يتم إجراء أي تعديلات للحفظ', 'info'); }
        document.getElementById('text-preview-overlay').classList.add('hidden');
    });
})();


function showNotif(msg, type = 'info') {
    const colors = { info:'#3498db', success:'#27ae60', error:'#e74c3c', warning:'#f39c12' };
    const tray = document.getElementById('notif-tray');
    const n = document.createElement('div');
    n.style.cssText = `background:${colors[type]||colors.info};color:white;padding:10px 16px;border-radius:8px; font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,0.2);max-width:280px;cursor:pointer; animation:slideIn 0.25s ease;`;
    n.textContent = msg;
    n.addEventListener('click', () => n.remove());
    tray.appendChild(n);
    setTimeout(() => { if (n.parentNode) n.remove(); }, 5000);
}

window.onLanUpdate = function(payload) {
    if (!currentProject?.metadata) return;
    const meta = currentProject.metadata;
    const type = payload.type;
    if ((type === 'presence' || type === 'user_joining' || type === 'user_leaving') && (meta.notif_join !== false)) {
        if (type === 'user_joining' || (type === 'presence' && payload.status === 'join')) {
            showNotif(`👤 ${payload.username || 'عضو جديد'} انضم إلى المجموعة السحابية`, 'info');
        } else if (type === 'user_leaving' || (type === 'presence' && payload.status === 'leave')) {
            showNotif(`👤 ${payload.username || 'عضو'} غادر المجموعة السحابية`, 'info');
        }
    }
    if (type === 'sync_update') {
        if (meta.notif_edit !== false) showNotif(`✏️ ${payload.username || 'مستخدم سحابي'} عدّل صفحة ${(payload.page_index||0)+1}`, 'info');
        const pg = currentProject?.pages[payload.page_index];
        if (pg) { 
            pg.ocr_data = payload.ocr_data; 
            if (payload.page_index === currentPageIndex && typeof updateReviewPanel === 'function') {
                updateReviewPanel(); 
            }
        }
    }
};

(function setupDashboard() {
    document.getElementById('dashboard-btn')?.addEventListener('click', () => {
        if (currentProject) window.location.href = `project-dashboard.html?id=${currentProject.id}`;
    });
})();

window.persistBrushEdit = async function(contentEl) {
    if (contentEl.id === 'text-preview-body') return;
    const blockEl = contentEl.closest('.text-block');
    const idx = parseInt(blockEl?.dataset.index);
    if (!isNaN(idx) && currentProject?.pages[currentPageIndex]) {
        const el = currentProject.pages[currentPageIndex].ocr_data[idx];
        if (el) {
            pushHistory(currentPageIndex);
            syncElementFromContent(el, contentEl);
            
            if (window.__appSettings?.autoMarkReviewed !== false) {
                el.reviewed = true; 
                const reviewBtn = blockEl?.querySelector('.block-review-btn');
                if (reviewBtn) { reviewBtn.textContent = '✔ تمت'; reviewBtn.classList.add('reviewed'); }
            }

            await autoSaveBlock();
            refreshIndicatorsFor(blockEl, el);
        }
    }
};