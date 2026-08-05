/**
 * pages/review/toolbar.js - toolbar setup (alignment, direction, thumbnail, save)
 * Extracted from review.js
 */

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

window.setupToolbar = setupToolbar;
