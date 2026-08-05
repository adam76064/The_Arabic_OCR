/**
 * pages/review/category.js - category picker and table handling
 */

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
}

window.handleTableCategoryChange = handleTableCategoryChange;
window.setupCategoryPicker = setupCategoryPicker;
window.openCategoryPicker = openCategoryPicker;
