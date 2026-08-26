const dashboardText = (key, params) => window.AppI18n?.t(key, params) || key;

/**
 * pages/project-dashboard/table.js - Modern Dual-View (Grid / Table), Multi-Selection, Thumbnail Layout Overlays & Context Menu
 */

let selectedPageIndices = new Set();
let dashboardViewMode = localStorage.getItem('dash_view_mode') || 'grid';
let contextMenuTargetIndex = -1;
let lastClickedPageIndex = -1;

function iconBadge(iconName, label) {
    const icon = window.AppIcons ? window.AppIcons.get(iconName) : '';
    return `${icon}<span>${label}</span>`;
}

function initDashboardViewControls() {
    const gridBtn = document.getElementById('view-mode-grid');
    const tableBtn = document.getElementById('view-mode-table');
    const gridContainer = document.getElementById('pages-grid-container');
    const tableWrapper = document.getElementById('pages-table-wrapper');

    const updateView = (mode) => {
        dashboardViewMode = mode;
        localStorage.setItem('dash_view_mode', mode);
        if (mode === 'grid') {
            gridBtn?.classList.add('active');
            tableBtn?.classList.remove('active');
            gridContainer?.classList.remove('hidden');
            tableWrapper?.classList.add('hidden');
            initThumbnailObserver();
        } else {
            tableBtn?.classList.add('active');
            gridBtn?.classList.remove('active');
            tableWrapper?.classList.remove('hidden');
            gridContainer?.classList.add('hidden');
            if (thumbnailIntersectionObserver) {
                thumbnailIntersectionObserver.disconnect();
            }
        }
    };

    gridBtn?.addEventListener('click', () => updateView('grid'));
    tableBtn?.addEventListener('click', () => updateView('table'));
    updateView(dashboardViewMode);

    // Select All Checkbox
    const selectAllCb = document.getElementById('dash-select-all-cb');
    const tableHeaderCb = document.getElementById('dash-table-header-cb');

    const toggleSelectAll = (checked) => {
        if (!currentProject?.pages) return;
        if (checked) {
            currentProject.pages.forEach((_, idx) => selectedPageIndices.add(idx));
        } else {
            selectedPageIndices.clear();
        }
        updateSelectionUI();
    };

    selectAllCb?.addEventListener('change', (e) => {
        toggleSelectAll(e.target.checked);
        if (tableHeaderCb) tableHeaderCb.checked = e.target.checked;
    });

    tableHeaderCb?.addEventListener('change', (e) => {
        toggleSelectAll(e.target.checked);
        if (selectAllCb) selectAllCb.checked = e.target.checked;
    });

    // Floating batch bar actions
    document.getElementById('btn-batch-clear')?.addEventListener('click', () => {
        selectedPageIndices.clear();
        if (selectAllCb) selectAllCb.checked = false;
        if (tableHeaderCb) tableHeaderCb.checked = false;
        updateSelectionUI();
    });

    document.getElementById('btn-batch-ocr')?.addEventListener('click', () => {
        if (selectedPageIndices.size === 0) return;
        const indices = Array.from(selectedPageIndices);
        if (typeof openPaddleModalForBatch === 'function') {
            openPaddleModalForBatch(indices);
        } else if (typeof openPaddleModalForSinglePage === 'function') {
            openPaddleModalForSinglePage(indices[0]);
        }
    });

    document.getElementById('btn-batch-preprocess')?.addEventListener('click', () => {
        if (selectedPageIndices.size === 0) return;
        const indices = Array.from(selectedPageIndices).sort((a, b) => a - b);
        const firstIdx = indices[0];
        const pagesStr = indices.join(',');
        window.location.href = `preprocessing.html?id=${currentProjectId}&page=${firstIdx}&pages=${pagesStr}`;
    });

    document.getElementById('btn-batch-layout')?.addEventListener('click', () => {
        if (selectedPageIndices.size === 0) return;
        const firstIdx = Array.from(selectedPageIndices)[0];
        window.location.href = `layout-editor.html?id=${currentProjectId}&page=${firstIdx}`;
    });

    // Pipeline steps clicks
    document.getElementById('step-preprocess')?.addEventListener('click', () => {
        window.location.href = `preprocessing.html?id=${currentProjectId}&page=0`;
    });
    document.getElementById('step-ocr')?.addEventListener('click', () => {
        if (typeof openPaddleModalForFullFile === 'function') {
            openPaddleModalForFullFile();
        } else if (typeof openPaddleModalForBatch === 'function') {
            const allIdx = currentProject?.pages ? currentProject.pages.map((_, i) => i) : [];
            openPaddleModalForBatch(allIdx);
        }
    });
    document.getElementById('step-layout')?.addEventListener('click', () => {
        window.location.href = `layout-editor.html?id=${currentProjectId}&page=0`;
    });
    document.getElementById('step-review')?.addEventListener('click', () => {
        window.location.href = `review.html?id=${currentProjectId}&page=0`;
    });
    document.getElementById('step-export')?.addEventListener('click', () => {
        window.location.href = `export.html?id=${currentProjectId}`;
    });
}

function updateSelectionUI() {
    const count = selectedPageIndices.size;
    const floatingBar = document.getElementById('floating-batch-bar');
    const countBadge = document.getElementById('batch-selected-count');

    if (countBadge) countBadge.textContent = count;

    if (floatingBar) {
        if (count > 0) {
            floatingBar.classList.add('visible');
        } else {
            floatingBar.classList.remove('visible');
        }
    }

    // Sync all checkboxes and card selected states
    document.querySelectorAll('.page-checkbox').forEach(cb => {
        const idx = parseInt(cb.dataset.index, 10);
        cb.checked = selectedPageIndices.has(idx);
    });

    document.querySelectorAll('.page-card').forEach(card => {
        const idx = parseInt(card.dataset.index, 10);
        if (selectedPageIndices.has(idx)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    document.querySelectorAll('#pages-table-body tr').forEach(row => {
        const idx = parseInt(row.dataset.index, 10);
        if (selectedPageIndices.has(idx)) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
}

function handlePageItemClick(index, event) {
    if (isNaN(index)) return;

    if (event.ctrlKey || event.metaKey) {
        // Toggle single item
        if (selectedPageIndices.has(index)) {
            selectedPageIndices.delete(index);
        } else {
            selectedPageIndices.add(index);
        }
        lastClickedPageIndex = index;
    } else if (event.shiftKey && lastClickedPageIndex >= 0) {
        // Range select
        const start = Math.min(lastClickedPageIndex, index);
        const end = Math.max(lastClickedPageIndex, index);
        for (let i = start; i <= end; i++) {
            selectedPageIndices.add(i);
        }
    } else {
        // Toggle or single select
        if (selectedPageIndices.has(index) && selectedPageIndices.size === 1) {
            selectedPageIndices.clear();
        } else {
            selectedPageIndices.clear();
            selectedPageIndices.add(index);
        }
        lastClickedPageIndex = index;
    }

    updateSelectionUI();
}

function renderPagesTable() {
    const tbody = document.getElementById('pages-table-body');
    const gridContainer = document.getElementById('pages-grid-container');
    if (tbody) tbody.innerHTML = '';
    if (gridContainer) gridContainer.innerHTML = '';

    if (!currentProject.pages || currentProject.pages.length === 0) {
        const emptyMsg = `<div style="text-align: center; color: var(--color-text-muted); padding: 40px;">${dashboardText('dashboard.noPages')}</div>`;
        if (tbody) tbody.innerHTML = `<tr><td colspan="6">${emptyMsg}</td></tr>`;
        if (gridContainer) gridContainer.innerHTML = emptyMsg;
        return;
    }

    currentProject.pages.forEach((page, index) => {
        const isOcred = page.ocr_data && page.ocr_data.length > 0;
        const allBlocksReviewed = isOcred && page.ocr_data.every(b => b.category === 'Picture' || b.reviewed === true);
        const isReviewed = (page.status === 'reviewed' || allBlocksReviewed) && page.status !== 'pending' && page.status !== 'unreviewed';
        const pageNum = index + 1;
        const isChecked = selectedPageIndices.has(index);

        const thumbUrl = window.__appDataPath 
            ? `file:///${window.__appDataPath}/projects/${currentProjectId}/thumbs/${page.image_path}` 
            : `projects/${currentProjectId}/thumbs/${page.image_path}`;
        const fallbackUrl = window.__appDataPath 
            ? `file:///${window.__appDataPath}/projects/${currentProjectId}/images/${page.image_path}` 
            : `projects/${currentProjectId}/images/${page.image_path}`;

        // 1. Render Table Row
        if (tbody) {
            const tr = document.createElement('tr');
            tr.dataset.index = index;
            if (isChecked) tr.classList.add('selected');
            tr.innerHTML = `
                <td><input type="checkbox" class="page-checkbox" data-index="${index}" ${isChecked ? 'checked' : ''} style="accent-color: var(--color-primary);"></td>
                <td><strong>${pageNum}</strong></td>
                <td>
                    <span class="status-badge ${isOcred ? 'parsed' : 'unparsed'}">
                        ${isOcred ? iconBadge('check', dashboardText('dashboard.extracted')) : iconBadge('clock', dashboardText('dashboard.waitingOcr'))}
                    </span>
                </td>
                <td>
                    <span class="status-badge" style="border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: bold; ${isOcred ? 'background: #e0f2fe; color: #0369a1;' : 'background: #f1f5f9; color: #64748b;'}">
                        ${isOcred ? dashboardText('dashboard.autoLayout') : dashboardText('dashboard.notLaidOut')}
                    </span>
                </td>
                <td>
                    <span class="status-badge" style="border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: bold; ${isReviewed ? 'background: #d1fae5; color: #059669;' : 'background: #fef3c7; color: #d97706;'}">
                        ${isReviewed ? iconBadge('check', dashboardText('dashboard.reviewed')) : iconBadge('clock', dashboardText('dashboard.waitingReview'))}
                    </span>
                </td>
                <td style="text-align: end;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
                        <button class="btn-secondary single-ocr-btn" data-index="${index}" style="padding: 4px 8px; font-size: 12px;" data-icon="ocr">OCR</button>
                        <button class="btn-secondary preprocess-page-btn" data-index="${index}" style="padding: 4px 8px; font-size: 12px;">${dashboardText('dash.preprocessing')}</button>
                        <button class="btn-secondary layout-editor-btn" data-index="${index}" style="padding: 4px 8px; font-size: 12px;">${dashboardText('dashboard.layout')}</button>
                        <button class="btn-primary open-page-btn" data-index="${index}" style="padding: 4px 8px; font-size: 12px;">${dashboardText('dash.review')}</button>
                        <button class="btn-danger remove-page-btn" data-index="${index}" style="padding: 4px 8px; font-size: 12px;" data-icon="delete"></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }

        // 2. Render Grid Card
        if (gridContainer) {
            const card = document.createElement('div');
            card.className = `page-card ${isChecked ? 'selected' : ''}`;
            card.dataset.index = index;
            card.innerHTML = `
                <div class="page-card-thumb" data-index="${index}" style="position: relative; overflow: hidden; border-radius: var(--radius-md); background: #f8fafc;">
                    <div class="page-card-header">
                        <span class="page-num-pill">${pageNum}</span>
                        <input type="checkbox" class="page-checkbox" data-index="${index}" ${isChecked ? 'checked' : ''} style="accent-color: var(--color-primary); width: 18px; height: 18px;">
                    </div>
                    <img src="${thumbUrl}" alt="Page ${pageNum}" loading="lazy" class="page-thumb-img" data-index="${index}" onerror="if(this.src!=='${fallbackUrl}'){this.src='${fallbackUrl}';}else{this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'140\\' fill=\\'%23cbd5e1\\'><rect width=\\'100\\' height=\\'140\\' fill=\\'%23f1f5f9\\'/><text x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'12\\'>${pageNum}</text></svg>';}">
                    <canvas class="page-thumb-canvas" data-index="${index}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
                </div>
                <div class="page-card-footer">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-bottom: 6px;">
                        <span class="status-badge ${isOcred ? 'parsed' : 'unparsed'}" style="font-size: 10px; padding: 2px 6px;">
                            ${isOcred ? iconBadge('check', 'OCR') : iconBadge('clock', 'OCR')}
                        </span>
                        <span class="status-badge ${isReviewed ? 'completed' : 'pending'}" style="font-size: 10px; padding: 2px 6px;">
                            ${isReviewed ? iconBadge('check', dashboardText('dashboard.reviewed')) : iconBadge('clock', dashboardText('dashboard.waitingReview'))}
                        </span>
                    </div>
                    <div class="page-card-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                        <button class="btn-secondary single-ocr-btn" data-index="${index}" style="font-size: 11px; padding: 4px 6px;">OCR</button>
                        <button class="btn-secondary preprocess-page-btn" data-index="${index}" style="font-size: 11px; padding: 4px 6px;">معالجة</button>
                        <button class="btn-secondary layout-editor-btn" data-index="${index}" style="font-size: 11px; padding: 4px 6px;">تخطيط</button>
                        <button class="btn-primary open-page-btn" data-index="${index}" style="font-size: 11px; padding: 4px 6px;">مراجعة</button>
                    </div>
                </div>
            `;
            gridContainer.appendChild(card);
        }
    });

    bindTableButtons();
    initDashboardViewControls();
    setupContextMenu();
    initThumbnailObserver();
}

const DASHBOARD_CATEGORY_COLORS = {
    'Title': '#7c3aed',
    'Section-header': '#8b5cf6',
    'Text': '#2563eb',
    'Footnote': '#64748b',
    'Picture': '#059669',
    'Table': '#0284c7',
    'Formula': '#d97706',
    'Quran': '#059669',
    'Vertical-poetry': '#d97706',
    'Staggered-poetry': '#d97706',
    'Caption': '#475569',
    'List-item': '#2563eb',
    'Page-number': '#0284c7'
};

let thumbnailIntersectionObserver = null;

function drawSingleThumbnailLayout(canvas) {
    if (!canvas) return;
    const index = parseInt(canvas.dataset.index, 10);
    const page = currentProject?.pages?.[index];
    const ctx = canvas.getContext('2d');
    if (!page || !page.ocr_data || page.ocr_data.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas._drawn = true;
        return;
    }

    const thumbContainer = canvas.parentElement;
    const img = thumbContainer?.querySelector('.page-thumb-img');
    if (!img) return;

    const cw = thumbContainer.clientWidth || 130;
    const ch = thumbContainer.clientHeight || 180;
    if (!cw || !ch) return;

    const natW = img.naturalWidth || page.width || (page.native_width ? (page.native_width / 72 * 200) : 1000);
    const natH = img.naturalHeight || page.height || (page.native_height ? (page.native_height / 72 * 200) : 1400);
    if (!natW || !natH) return;

    const imgRatio = natW / natH;
    const containerRatio = cw / ch;

    let renderW, renderH, renderX, renderY;
    if (containerRatio > imgRatio) {
        renderH = ch;
        renderW = ch * imgRatio;
        renderX = (cw - renderW) / 2;
        renderY = 0;
    } else {
        renderW = cw;
        renderH = cw / imgRatio;
        renderX = 0;
        renderY = (ch - renderH) / 2;
    }

    canvas.style.top = `${Math.round(renderY)}px`;
    canvas.style.left = `${Math.round(renderX)}px`;
    canvas.style.width = `${Math.round(renderW)}px`;
    canvas.style.height = `${Math.round(renderH)}px`;

    canvas.width = Math.round(renderW);
    canvas.height = Math.round(renderH);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nativeW = page.native_width || (natW / 200 * 72);
    const nativeH = page.native_height || (natH / 200 * 72);

    const scaleX = renderW / nativeW;
    const scaleY = renderH / nativeH;

    page.ocr_data.forEach(block => {
        let bbox = block.bbox;
        if (!bbox && block.geometry) {
            bbox = [block.geometry.x, block.geometry.y, block.geometry.x + block.geometry.width, block.geometry.y + block.geometry.height];
        }
        if (!bbox || bbox.length < 4) return;
        const bx = bbox[0] * scaleX;
        const by = bbox[1] * scaleY;
        const bw = (bbox[2] - bbox[0]) * scaleX;
        const bh = (bbox[3] - bbox[1]) * scaleY;

        const color = DASHBOARD_CATEGORY_COLORS[block.category] || '#2563eb';
        ctx.fillStyle = color + '33';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = color + 'cc';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);
    });

    canvas._drawn = true;
}

function initThumbnailObserver() {
    if (dashboardViewMode !== 'grid') {
        if (thumbnailIntersectionObserver) {
            thumbnailIntersectionObserver.disconnect();
        }
        return;
    }

    if (thumbnailIntersectionObserver) {
        thumbnailIntersectionObserver.disconnect();
    }

    if ('IntersectionObserver' in window) {
        thumbnailIntersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const canvas = entry.target.querySelector('.page-thumb-canvas');
                    const img = entry.target.querySelector('.page-thumb-img');
                    if (canvas && !canvas._drawn) {
                        if (img && (!img.complete || img.naturalWidth === 0)) {
                            img.onload = () => drawSingleThumbnailLayout(canvas);
                        } else {
                            drawSingleThumbnailLayout(canvas);
                        }
                    }
                }
            });
        }, { rootMargin: '250px 0px' });

        document.querySelectorAll('.page-card').forEach(card => {
            thumbnailIntersectionObserver.observe(card);
        });
    } else {
        document.querySelectorAll('.page-thumb-canvas').forEach(canvas => {
            drawSingleThumbnailLayout(canvas);
        });
    }
}

function bindTableButtons() {
    // Thumbnail card direct click selection (with Ctrl / Shift support)
    document.querySelectorAll('.page-card-thumb').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-checkbox')) return;
            const idx = parseInt(thumb.dataset.index, 10);
            handlePageItemClick(idx, e);
        });
    });

    // Table row direct click selection
    document.querySelectorAll('#pages-table-body tr').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.classList.contains('page-checkbox')) return;
            const idx = parseInt(row.dataset.index, 10);
            handlePageItemClick(idx, e);
        });
    });

    // Checkbox event binding
    document.querySelectorAll('.page-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            if (e.target.checked) selectedPageIndices.add(idx);
            else selectedPageIndices.delete(idx);
            lastClickedPageIndex = idx;
            updateSelectionUI();
        });
    });

    document.querySelectorAll('.preprocess-page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = e.currentTarget.dataset.index;
            window.location.href = `preprocessing.html?id=${currentProjectId}&page=${idx}`;
        });
    });

    document.querySelectorAll('.layout-editor-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = e.currentTarget.dataset.index;
            window.location.href = `layout-editor.html?id=${currentProjectId}&page=${idx}`;
        });
    });

    document.querySelectorAll('.open-page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = e.currentTarget.dataset.index;
            window.location.href = `review.html?id=${currentProjectId}&page=${idx}`;
        });
    });

    document.querySelectorAll('.single-ocr-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            if (typeof openPaddleModalForSinglePage === 'function') {
                openPaddleModalForSinglePage(idx);
            }
        });
    });

    document.querySelectorAll('.remove-page-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            const shouldPrompt = window.__appSettings?.promptDeletePage !== false;
            if (shouldPrompt) {
                if (!confirm(`هل أنت متأكد من حذف الصفحة رقم ${idx + 1}؟`)) return;
            }
            try {
                await window.pywebview.api.delete_project_page(currentProjectId, idx);
                selectedPageIndices.delete(idx);
                currentProject = await window.pywebview.api.load_project(currentProjectId);
                renderPagesTable();
                renderDashboardStats();
            } catch (err) {
                alert('فشل حذف الصفحة: ' + err);
            }
        });
    });
}

function setupContextMenu() {
    const menu = document.getElementById('page-context-menu');
    if (!menu) return;

    // Attach right-click on table rows and grid cards
    document.querySelectorAll('#pages-table-body tr, .page-card').forEach(el => {
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const idx = parseInt(el.dataset.index, 10);
            if (isNaN(idx)) return;
            contextMenuTargetIndex = idx;

            // If right-clicked page is not part of multi-selection, select only this page
            if (!selectedPageIndices.has(contextMenuTargetIndex)) {
                selectedPageIndices.clear();
                selectedPageIndices.add(contextMenuTargetIndex);
                lastClickedPageIndex = contextMenuTargetIndex;
                updateSelectionUI();
            }

            const titleEl = document.getElementById('ctx-page-title');
            if (titleEl) {
                titleEl.textContent = selectedPageIndices.size > 1 
                    ? `إجراءات ${selectedPageIndices.size} صفحات محددة` 
                    : `إجراءات صفحة ${contextMenuTargetIndex + 1}`;
            }

            // Position context menu
            menu.classList.remove('hidden');
            let posX = e.clientX;
            let posY = e.clientY;

            if (posX + 240 > window.innerWidth) posX = window.innerWidth - 250;
            if (posY + 270 > window.innerHeight) posY = window.innerHeight - 280;

            menu.style.left = `${posX}px`;
            menu.style.top = `${posY}px`;
        });
    });

    // Close menu on outside click or Escape
    if (!menu._listenersBound) {
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target)) menu.classList.add('hidden');
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') menu.classList.add('hidden');
        });

        // Context menu actions
        document.getElementById('ctx-action-ocr')?.addEventListener('click', () => {
            menu.classList.add('hidden');
            const indices = selectedPageIndices.size > 0 ? Array.from(selectedPageIndices) : [contextMenuTargetIndex];
            if (typeof openPaddleModalForBatch === 'function') {
                openPaddleModalForBatch(indices);
            } else if (typeof openPaddleModalForSinglePage === 'function') {
                openPaddleModalForSinglePage(indices[0]);
            }
        });

        document.getElementById('ctx-action-layout')?.addEventListener('click', () => {
            menu.classList.add('hidden');
            const first = selectedPageIndices.size > 0 ? Array.from(selectedPageIndices)[0] : contextMenuTargetIndex;
            if (first >= 0) window.location.href = `layout-editor.html?id=${currentProjectId}&page=${first}`;
        });

        document.getElementById('ctx-action-preprocess')?.addEventListener('click', () => {
            menu.classList.add('hidden');
            const first = selectedPageIndices.size > 0 ? Array.from(selectedPageIndices)[0] : contextMenuTargetIndex;
            if (first >= 0) window.location.href = `preprocessing.html?id=${currentProjectId}&page=${first}`;
        });

        document.getElementById('ctx-action-review')?.addEventListener('click', () => {
            menu.classList.add('hidden');
            const first = selectedPageIndices.size > 0 ? Array.from(selectedPageIndices)[0] : contextMenuTargetIndex;
            if (first >= 0) window.location.href = `review.html?id=${currentProjectId}&page=${first}`;
        });

        document.getElementById('ctx-action-mark-reviewed')?.addEventListener('click', async () => {
            menu.classList.add('hidden');
            const indices = selectedPageIndices.size > 0 ? Array.from(selectedPageIndices) : [contextMenuTargetIndex];
            indices.forEach(idx => {
                if (currentProject.pages[idx]) {
                    currentProject.pages[idx].status = 'reviewed';
                    if (currentProject.pages[idx].ocr_data) {
                        currentProject.pages[idx].ocr_data.forEach(b => b.reviewed = true);
                    }
                }
            });
            await window.pywebview.api.update_project(currentProjectId, currentProject);
            renderPagesTable();
            renderDashboardStats();
            if (window.showNotif) window.showNotif('تم تحديد الصفحات كـ "تمت المراجعة"', 'success');
        });

        document.getElementById('ctx-action-mark-unreviewed')?.addEventListener('click', async () => {
            menu.classList.add('hidden');
            const indices = selectedPageIndices.size > 0 ? Array.from(selectedPageIndices) : [contextMenuTargetIndex];
            indices.forEach(idx => {
                if (currentProject.pages[idx]) {
                    currentProject.pages[idx].status = 'pending';
                    if (currentProject.pages[idx].ocr_data) {
                        currentProject.pages[idx].ocr_data.forEach(b => b.reviewed = false);
                    }
                }
            });
            await window.pywebview.api.update_project(currentProjectId, currentProject);
            renderPagesTable();
            renderDashboardStats();
            if (window.showNotif) window.showNotif('تم إلغاء حالة المراجعة للصفحات المحددة', 'info');
        });

        document.getElementById('ctx-action-delete')?.addEventListener('click', async () => {
            menu.classList.add('hidden');
            const indices = selectedPageIndices.size > 0 ? Array.from(selectedPageIndices) : [contextMenuTargetIndex];
            if (indices.length === 0 || indices[0] < 0) return;
            if (!confirm(`هل أنت متأكد من حذف ${indices.length} صفحة من المشروع؟`)) return;
            const sortedDesc = indices.sort((a, b) => b - a);
            for (const idx of sortedDesc) {
                await window.pywebview.api.delete_project_page(currentProjectId, idx);
            }
            selectedPageIndices.clear();
            currentProject = await window.pywebview.api.load_project(currentProjectId);
            renderPagesTable();
            renderDashboardStats();
        });

        menu._listenersBound = true;
    }
}
