const dashboardText = (key) => window.AppI18n?.t(key) || key;

/**
 * pages/project-dashboard/table.js - extracted from monolith
 */

// Small helper: builds an "icon + label" status-badge string from the
// shared AppIcons set (js/icons.js), so the OCR/review status pills use
// the same SVG icon language as the review-page toolbar instead of the
// previous ✔/⏳ text glyphs.
function iconBadge(iconName, label) {
    const icon = window.AppIcons ? window.AppIcons.get(iconName) : '';
    return `${icon}<span>${label}</span>`;
}

function renderPagesTable() {
    const tbody = document.getElementById('pages-table-body');
    tbody.innerHTML = '';

    if (!currentProject.pages || currentProject.pages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">${dashboardText('dashboard.noPages')}</td></tr>`;
        return;
    }

    currentProject.pages.forEach((page, index) => {
        const isOcred = page.ocr_data && page.ocr_data.length > 0;
        
        // Auto-detect if all blocks are reviewed
        const allBlocksReviewed = isOcred && page.ocr_data.every(b => b.category === 'Picture' || b.reviewed === true);
        const isReviewed = (page.status === 'reviewed' || allBlocksReviewed) && page.status !== 'pending' && page.status !== 'unreviewed';
        
        // Dynamic Layout Status
        const layoutStatusText = isOcred ? dashboardText('dashboard.autoLayout') : dashboardText('dashboard.notLaidOut');
        const layoutStatusStyle = isOcred ? 'background: #e0f2fe; color: #0369a1;' : 'background: #f1f5f9; color: #64748b;';
        
        const pageNum = index + 1;
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${pageNum}</strong></td>
            <td>
                <span class="status-badge ${isOcred ? 'parsed' : 'unparsed'}">
                    ${isOcred ? iconBadge('check', dashboardText('dashboard.extracted')) : iconBadge('clock', dashboardText('dashboard.waitingOcr'))}
                </span>
            </td>
            <td>
                <span class="status-badge" style="border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: bold; ${layoutStatusStyle}">
                    ${layoutStatusText}
                </span>
            </td>
            <td>
                <span class="status-badge" style="border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: bold; ${isReviewed ? 'background: #d1fae5; color: #059669;' : 'background: #fef3c7; color: #d97706;'}">
                    ${isReviewed ? iconBadge('check', dashboardText('dashboard.reviewed')) : iconBadge('clock', dashboardText('dashboard.waitingReview'))}
                </span>
            </td>
            <td style="text-align: end; display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn-primary layout-editor-btn" data-index="${index}">${dashboardText('dashboard.layout')}</button>
                <button class="btn-secondary open-page-btn" data-index="${index}">${dashboardText('dashboard.review')}</button>
                <button class="btn-secondary single-ocr-btn" data-index="${index}">OCR</button>
                <button class="btn-danger remove-page-btn" data-index="${index}">${dashboardText('dashboard.delete')}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    bindTableButtons();
}

function bindTableButtons() {

    // الزر الجديد للانتقال إلى محرر الكتل
    document.querySelectorAll('.layout-editor-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.index;
            window.location.href = `layout-editor.html?id=${currentProjectId}&page=${idx}`;
        });
    });


    document.querySelectorAll('.open-page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.index;
            // Navigates to review page. We pass a page parameter so review.js knows where to jump.
            // Note: you may need a small tweak in review.js later to parse &page=idx on load.
            window.location.href = `review.html?id=${currentProjectId}&page=${idx}`;
        });
    });

    document.querySelectorAll('.single-ocr-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.dataset.index;
            openPaddleModalForSinglePage(parseInt(idx));
        });
    });

    document.querySelectorAll('.remove-page-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(e.target.dataset.index);
            const pageNum = idx + 1;
            
            const executeDeletion = async (deleteFiles) => {
                const res = await window.pywebview.api.delete_page(currentProjectId, idx, deleteFiles);
                if (res && res.ok) {
                    currentProject = await window.pywebview.api.load_project(currentProjectId);
                    renderPagesTable();
                    if (typeof renderDashboardStats === 'function') renderDashboardStats();
                } else {
                    alert('تعذّر حذف الصفحة: ' + (res?.error || 'خطأ غير معروف'));
                }
            };

            const prompt = window.__appSettings?.promptDeletePage !== false;
            const defaultDeleteFiles = !!(window.__appSettings?.deletePageFiles);

            if (prompt && window.AestheticDialog?.deleteConfirm) {
                window.AestheticDialog.deleteConfirm({
                    title: 'حذف الصفحة',
                    message: `هل أنت متأكد من رغبتك في حذف الصفحة رقم <strong>${pageNum}</strong> من هذا المشروع؟`,
                    deleteFilesLabel: 'حذف الصور والملفات المرتبطة بهذه الصفحة من القرص الصلب أيضاً',
                    defaultDeleteFiles: defaultDeleteFiles,
                    showRemember: true,
                    onConfirm: async ({ deleteFiles, remember }) => {
                        if (remember) {
                            window.__appSettings.promptDeletePage = false;
                            window.__appSettings.deletePageFiles = deleteFiles;
                            if (typeof saveAppSettings === 'function') saveAppSettings();
                        }
                        await executeDeletion(deleteFiles);
                    }
                });
            } else {
                await executeDeletion(defaultDeleteFiles);
            }
        });
    });
}

