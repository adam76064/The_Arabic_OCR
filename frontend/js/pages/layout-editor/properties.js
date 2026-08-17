/**
 * pages/layout-editor/properties.js - extracted from monolith
 */

const propertiesText = (key) => window.AppI18n?.t(key) || key;

function injectPropertiesPanel() {
    const oldPanel = document.getElementById('block-props-panel');
    if (oldPanel) oldPanel.remove();

    const panelHTML = `
        <div id="block-props-panel" style="position: fixed; top: 90px; inset-inline-start: 30px; background: white; padding: 16px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; width: 220px; display: none; z-index: 1000; direction: inherit;">
            <!-- تم إضافة المعرف prop-panel-header وتنسيقات السحب هنا -->
            <div id="prop-panel-header" style="font-size: 14px; font-weight: bold; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; color: #1e293b; cursor: grab; user-select: none; display: flex; align-items: center;">
                <span style="color:#94a3b8; margin-inline-end:8px; cursor: inherit; font-size: 16px;">⋮⋮</span> ${propertiesText('properties.title')}
            </div>
            
            <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: #64748b;">${propertiesText('properties.type')}</label>
            <select id="prop-category" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 16px; font-size: 13px; outline: none; cursor: pointer;">
                ${getAllCategories().map(c => `<option value="${c}">${getCategoryNameAR(c)}</option>`).join('')}
            </select>
            
            <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: #64748b;">${propertiesText('properties.order')}</label>
            <div style="display: flex; gap: 6px; align-items: center;">
                <button id="prop-move-up" class="btn-secondary" style="padding: 6px; flex: 1; border-radius: 6px;">⬆️</button>
                <input type="number" id="prop-order" min="1" style="width: 60px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center;">
                <button id="prop-move-down" class="btn-secondary" style="padding: 6px; flex: 1; border-radius: 6px;">⬇️</button>
            </div>

            <div id="prop-table-tools" style="display: none; margin-top: 14px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
                <label style="font-size: 12px; display: block; margin-bottom: 6px; font-weight: bold; color: #d35400;">${propertiesText('properties.method')}</label>
                <select id="table-extract-method" style="width: 100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 8px; font-size: 12px; outline: none;">
                    <option value="auto">${propertiesText('properties.auto')}</option>
                    <option value="native">${propertiesText('properties.native')}</option>
                    <option value="coordinates">${propertiesText('properties.coordinates')}</option>
                    <option value="smear">${propertiesText('properties.smear')}</option>
                </select>
                <button id="btn-auto-table" class="btn-secondary" style="width: 100%; padding: 8px; border-radius: 6px; border-color: #d35400; color: #d35400; font-weight: bold; margin-bottom: 6px;">${propertiesText('properties.tableLayout')}</button>
                <div style="font-size: 11px; color: #7f8c8d; text-align: center;">${propertiesText('properties.tableHint')}</div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', panelHTML);

    // --- منطق سحب وتحريك اللوحة ---
    const panel = document.getElementById('block-props-panel');
    const header = document.getElementById('prop-panel-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        header.style.cursor = 'grabbing';
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        let newTop = panel.offsetTop - pos2;
        let newLeft = panel.offsetLeft - pos1;

        // منع اللوحة من الخروج خارج الشاشة
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));

        panel.style.top = newTop + "px";
        panel.style.left = newLeft + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        header.style.cursor = 'grab';
    }
    // --------------------------------

    // تفعيل الأحداث الخاصة بالخصائص
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
        
        btn.textContent = '⏳ جاري التحليل...'; btn.disabled = true;
        try {
            await window.pywebview.api.update_page_ocr(currentProject.id, currentPageIndex, ocrData);
            const response = await window.pywebview.api.auto_layout_table_block(currentProject.id, currentPageIndex, idx, method);
            if (response.ok && response.table_structure) {
                ocrData[idx].table_structure = response.table_structure;
                drawCanvas(); 
            } else alert("Failed to analyze table."); 
        } catch (e) { alert('Error communicating with backend.'); } 
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
        <div style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
            ${i18n('review.autoTableMessage', { category: catNameAR })}
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; cursor: pointer; user-select: none;">
            <input type="checkbox" id="chk-remember-table-parse-layout" style="accent-color: #2563eb;">
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

