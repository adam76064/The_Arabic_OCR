/**
 * pages/layout-editor/properties.js - extracted from monolith
 */

const propertiesText = (key) => window.AppI18n?.t(key) || key;

function injectPropertiesPanel() {
    const oldPanel = document.getElementById('block-props-panel');
    if (oldPanel) oldPanel.remove();

    const panelHTML = `
        <div id="block-props-panel" style="position: fixed; top: 90px; inset-inline-start: 30px; background: var(--color-surface); padding: 16px; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); border: 1px solid var(--color-border); width: 230px; display: none; z-index: 1000; direction: inherit; color: var(--color-text);">
            <div id="prop-panel-header" style="font-size: 14px; font-weight: bold; margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; color: var(--color-text); cursor: grab; user-select: none; display: flex; align-items: center;">
                <span style="color: var(--color-text-muted); margin-inline-end: 8px; cursor: inherit; font-size: 16px;">⋮⋮</span> ${propertiesText('properties.title')}
            </div>
            
            <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: var(--color-text-secondary);">${propertiesText('properties.type')}</label>
            <div class="category-quick-chips" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 12px;">
                <button type="button" class="btn-secondary cat-quick-btn" data-cat="Text" style="padding: 4px 6px; font-size: 11px; justify-content: start;">${propertiesText('category.Text')}</button>
                <button type="button" class="btn-secondary cat-quick-btn" data-cat="Title" style="padding: 4px 6px; font-size: 11px; justify-content: start;">${propertiesText('category.Title')}</button>
                <button type="button" class="btn-secondary cat-quick-btn" data-cat="Section-header" style="padding: 4px 6px; font-size: 11px; justify-content: start;">${propertiesText('category.Section-header')}</button>
                <button type="button" class="btn-secondary cat-quick-btn" data-cat="Quran" style="padding: 4px 6px; font-size: 11px; justify-content: start;">${propertiesText('category.Quran')}</button>
                <button type="button" class="btn-secondary cat-quick-btn" data-cat="Poem" style="padding: 4px 6px; font-size: 11px; justify-content: start;">${propertiesText('category.Poem')}</button>
                <button type="button" class="btn-secondary cat-quick-btn" data-cat="Footnote" style="padding: 4px 6px; font-size: 11px; justify-content: start;">${propertiesText('category.Footnote')}</button>
                <button type="button" class="btn-secondary cat-quick-btn" data-cat="Table" style="padding: 4px 6px; font-size: 11px; justify-content: start;">${propertiesText('category.Table')}</button>
                <button type="button" class="btn-secondary cat-quick-btn" data-cat="Picture" style="padding: 4px 6px; font-size: 11px; justify-content: start;">${propertiesText('category.Picture')}</button>
            </div>
            <select id="prop-category" style="width: 100%; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-bottom: 14px; font-size: 12px; outline: none; cursor: pointer; background: var(--color-bg-alt); color: var(--color-text);">
                ${getAllCategories().map(c => `<option value="${c}" style="background: var(--color-surface); color: var(--color-text);">${getCategoryNameAR(c)}</option>`).join('')}
            </select>
            
            <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: var(--color-text-secondary);">${propertiesText('properties.order')}</label>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button id="prop-move-up" class="btn-secondary" style="padding: 6px; flex: 1; border-radius: var(--radius-md);">▲</button>
                <input type="number" id="prop-order" min="1" style="width: 60px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-md); text-align: center; background: var(--color-bg-alt); color: var(--color-text);">
                <button id="prop-move-down" class="btn-secondary" style="padding: 6px; flex: 1; border-radius: var(--radius-md);">▼</button>
            </div>

            <div id="prop-table-tools" style="display: none; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--color-border);">
                <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: #d35400;">${propertiesText('properties.method')}</label>
                <select id="table-extract-method" style="width: 100%; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-bottom: 8px; font-size: 12px; outline: none; background: var(--color-bg-alt); color: var(--color-text);">
                    <option value="auto" style="background: var(--color-surface); color: var(--color-text);">${propertiesText('properties.auto')}</option>
                    <option value="native" style="background: var(--color-surface); color: var(--color-text);">${propertiesText('properties.native')}</option>
                    <option value="coordinates" style="background: var(--color-surface); color: var(--color-text);">${propertiesText('properties.coordinates')}</option>
                    <option value="smear" style="background: var(--color-surface); color: var(--color-text);">${propertiesText('properties.smear')}</option>
                </select>
                <button id="btn-auto-table" class="btn-secondary" style="width: 100%; padding: 8px; border-radius: var(--radius-md); border-color: #d35400; color: #d35400; font-weight: bold; margin-bottom: 6px;">${propertiesText('properties.tableLayout')}</button>
                <div style="font-size: 11px; color: var(--color-text-muted); text-align: center;">${propertiesText('properties.tableHint')}</div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // --- Drag and Move logic with free positioning ---
    const panel = document.getElementById('block-props-panel');
    const header = document.getElementById('prop-panel-header');
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Reset conflicting directional styles
        panel.style.insetInlineStart = 'auto';
        panel.style.insetInlineEnd = 'auto';
        panel.style.right = 'auto';
        panel.style.left = initialLeft + 'px';
        panel.style.top = initialTop + 'px';

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        header.style.cursor = 'grabbing';
    }

    function elementDrag(e) {
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newTop = initialTop + dy;
        let newLeft = initialLeft + dx;

        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
        const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
        newTop = Math.max(0, Math.min(newTop, maxTop));
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));

        panel.style.top = newTop + "px";
        panel.style.left = newLeft + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        header.style.cursor = 'grab';
    }
    // --------------------------------

    // Event listeners
    document.querySelectorAll('.cat-quick-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (selectedBoxes.size === 0) return;
            const newCat = e.currentTarget.dataset.cat;
            const catSelect = document.getElementById('prop-category');
            if (catSelect) catSelect.value = newCat;
            
            saveHistoryState();
            const idx = Array.from(selectedBoxes)[0];
            const oldCat = ocrData[idx].category;
            ocrData[idx].category = newCat;
            if (isTableLike(newCat)) {
                await handleTableCategoryChangeInLayout(idx, newCat, oldCat);
            } else {
                updateSelectionUI(); drawCanvas();
                autoSaveLayoutData();
            }
        });
    });

    document.getElementById('prop-category').addEventListener('change', async (e) => {
        saveHistoryState();
        const idx = Array.from(selectedBoxes)[0];
        const oldCat = ocrData[idx].category;
        const newCat = e.target.value;
        ocrData[idx].category = newCat;
        if (isTableLike(newCat)) {
            await handleTableCategoryChangeInLayout(idx, newCat, oldCat);
        } else {
            updateSelectionUI(); drawCanvas();
            autoSaveLayoutData();
        }
    });

    document.getElementById('btn-auto-table').addEventListener('click', async () => {
        saveHistoryState();
        const idx = Array.from(selectedBoxes)[0];
        const btn = document.getElementById('btn-auto-table');
        const method = document.getElementById('table-extract-method').value;
        
        btn.textContent = propertiesText('properties.analyzing'); btn.disabled = true;
        try {
            await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
            const response = await window.pywebview.api.auto_layout_table_block(currentProject.id, currentPageIndex, idx, method);
            if (response.ok && response.table_structure) {
                ocrData[idx].table_structure = response.table_structure;
                drawCanvas(); 
            } else alert(propertiesText('properties.tableAnalyzeFailed')); 
        } catch (e) { alert(propertiesText('properties.backendError')); } 
        finally { btn.textContent = propertiesText('properties.tableLayout'); btn.disabled = false; }
    });
}

async function handleTableCategoryChangeInLayout(idx, newCat, oldCat) {
    const remember = localStorage.getItem('autoTableParse_remember') === 'true';
    const savedAction = localStorage.getItem('autoTableParse_action');

    const executeAutoParse = async () => {
        try {
            if (window.pywebview?.api?.auto_layout_table_block) {
                await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
                const res = await window.pywebview.api.auto_layout_table_block(currentProject.id, currentPageIndex, idx, "smear");
                const updatedProj = await window.pywebview.api.load_project(currentProject.id);
                if (updatedProj && updatedProj.pages[currentPageIndex]) {
                    currentProject = updatedProj;
                    ocrData = JSON.parse(JSON.stringify(updatedProj.pages[currentPageIndex].ocr_data || []));
                }
            }
        } catch (err) {
            console.error("Auto table layout failed:", err);
        } finally {
            updateSelectionUI(); drawCanvas();
            autoSaveLayoutData();
        }
    };

    if (remember) {
        if (savedAction === 'yes') {
            await executeAutoParse();
        } else {
            updateSelectionUI(); drawCanvas();
            autoSaveLayoutData();
        }
        return;
    }

    const catNameAR = getCategoryNameAR(newCat);
    const i18n = (key, values) => window.AppI18n.t(key, values);
    const modalContent = `
        <div style="font-size: 14px; color: var(--color-text); line-height: 1.6; margin-bottom: 16px;">
            ${i18n('review.autoTableMessage', { category: catNameAR })}
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-secondary); cursor: pointer; user-select: none;">
            <input type="checkbox" id="chk-remember-table-parse-layout" style="accent-color: var(--color-primary);">
            <span>${i18n('review.rememberChoice')}</span>
        </label>
    `;

    if (window.AestheticDialog?.show) {
        window.AestheticDialog.show(window.AppI18n.t('review.autoTableTitle'), modalContent, async (overlay) => {
            const chk = overlay.querySelector('#chk-remember-table-parse-layout');
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
                        const chk = overlay.querySelector('#chk-remember-table-parse-layout');
                        if (chk && chk.checked) {
                            localStorage.setItem('autoTableParse_remember', 'true');
                            localStorage.setItem('autoTableParse_action', 'no');
                        }
                        overlay.remove();
                        updateSelectionUI(); drawCanvas();
                        autoSaveLayoutData();
                    };
                }
            }
        }, 10);
    } else {
        updateSelectionUI(); drawCanvas();
        autoSaveLayoutData();
    }
}
