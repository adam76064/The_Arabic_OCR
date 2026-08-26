const editorText = (key) => window.AppI18n?.t(key) || key;

/**
 * pages/review/editor.js - blocks list, selection, drag, sync, review panel
 * Extracted from review.js monolith
 */

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

function refreshIndicatorsFor(wrapperEl, element) {
    if (wrapperEl) wrapperEl.classList.toggle('block-reviewed', !!element.reviewed);
    const page = currentProject?.pages[currentPageIndex];
    if (!page) return;
    renderBboxes(page.ocr_data || [], selectedBlockIndex);
    renderThumbCanvas('thumb-canvas', 'thumb-image', page.ocr_data || [], selectedBlockIndex);
    renderThumbCanvas('thumb-popup-canvas', 'thumb-popup-image', page.ocr_data || [], selectedBlockIndex);
}

function renderBlocksList(ocrData) {
    const container = document.getElementById('blocks-list');
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

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
        handle.title = editorText('editor.dragReorder');
        handle.innerHTML = '⋮⋮';
        handle.dataset.handle = '1';

        const header = document.createElement('div');
        header.className = 'block-header';

        const label = document.createElement('span');
        label.className = 'block-label';
        label.style.color = color;
        label.textContent = getCategoryNameAR(element.category || 'Text');
        label.title = editorText('editor.changeType');

        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'block-review-btn' + (element.reviewed ? ' reviewed' : '');
        reviewBtn.textContent = element.reviewed ? editorText('editor.done') : editorText('editor.reviewed');

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'block-delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.title = editorText('editor.deleteUndo');

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
            
            document.querySelectorAll('#sticky-toolbar button[data-align]').forEach(b =>
                b.classList.toggle('active', b.dataset.align === (element.align || '')));
            document.querySelectorAll('#sticky-toolbar button[data-dir]').forEach(b =>
                b.classList.toggle('active', b.dataset.dir === (element.dir || 'rtl')));
                
            preEditSnapshot = JSON.parse(JSON.stringify(currentProject.pages[currentPageIndex].ocr_data));
            if (typeof window.updateTrackingHighlight === 'function') window.updateTrackingHighlight(content, element); else if (typeof updateTrackingHighlight === 'function') updateTrackingHighlight(content, element);
        });

        content.addEventListener('input', () => { const fn = window.debouncedTrackingUpdate || (typeof debouncedTrackingUpdate !== 'undefined' ? debouncedTrackingUpdate : null); if (fn) fn(content, element); });
        content.addEventListener('keyup', (e) => {
            if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') {
                const fn = window.debouncedTrackingUpdate || (typeof debouncedTrackingUpdate !== 'undefined' ? debouncedTrackingUpdate : null);
                if (fn) fn(content, element);
            }
        });
        content.addEventListener('click', () => { const fn = window.debouncedTrackingUpdate || (typeof debouncedTrackingUpdate !== 'undefined' ? debouncedTrackingUpdate : null); if (fn) fn(content, element); });
        
        content.addEventListener('blur', async () => {
            if (typeof window.setTrackingHighlight === 'function') window.setTrackingHighlight(null); else if (typeof setTrackingHighlight === 'function') setTrackingHighlight(null);
            let changed = syncElementFromContent(element, content);

            if (!element.reviewed && window.__appSettings?.autoMarkReviewed !== false) {
                element.reviewed = true;
                changed = true; 
            }

            if (changed) {
                pushHistory(currentPageIndex, preEditSnapshot);
                await autoSaveBlock();
                reviewBtn.textContent = element.reviewed ? editorText('editor.done') : editorText('editor.reviewed');
                reviewBtn.classList.toggle('reviewed', element.reviewed);
                refreshIndicatorsFor(wrapper, element);
            }
        }, true);

        wrapper.appendChild(header);
        wrapper.appendChild(content);

        setupBlockDrag(wrapper, index);
        fragment.appendChild(wrapper);
    });

    container.appendChild(fragment);
}

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
            reviewBtn.textContent = element.reviewed ? editorText('editor.done') : editorText('editor.reviewed');
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


// Expose globally for legacy and new code
window.updateReviewPanel = updateReviewPanel;
window.updateBlockSelectionUI = updateBlockSelectionUI;
window.selectBlock = selectBlock;
window.syncElementFromContent = syncElementFromContent;
window.refreshIndicatorsFor = refreshIndicatorsFor;
window.renderBlocksList = renderBlocksList;
window.setupBlocksListDelegation = setupBlocksListDelegation;
window.setupBlockDrag = setupBlockDrag;
window.reorderBlocks = reorderBlocks;
window.deleteBlock = deleteBlock;
